#!/usr/bin/env python3
"""Merge school lexicon CSV exports into words.json v2."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from contextual_hint import GARBLED_MARKERS, generate_contextual_hint, is_garbled_hint
from fix_hints import mask_word_in_hint
from spelling_fixes import apply_spelling_fix, load_spelling_fixes
from hint_generator import generate_hint, is_generic_hint, is_homophone_prone, load_overrides
from import_helexkids import (
    audio_path_for_word,
    count_by_grade,
    feedback_rule,
    guess_morphemes,
    merge_words,
    normalize_word,
    repair_all_audio_paths,
    write_words,
)

PIPELINE = Path(__file__).resolve().parent
LEXIKA_DIR = PIPELINE / "inputs" / "lexika"
WEB_CONTENT = PIPELINE.parent / "web" / "public" / "content"
FAMILIES_SRC = LEXIKA_DIR / "families.json"
RULES_SRC = LEXIKA_DIR / "rules_snippets.json"

# Caps after canvas review (ABC cleaned · DE/ST curated)
CAPS = {2: 180, 3: 180, 4: 100, 5: 100, 6: 200}


def load_lexika_rows(input_dir: Path = LEXIKA_DIR) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    spelling_fixes = load_spelling_fixes()
    if not input_dir.is_dir():
        return rows
    for path in sorted(input_dir.glob("grade*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as f:
            for raw in csv.DictReader(f):
                word = apply_spelling_fix((raw.get("word") or "").strip(), spelling_fixes)
                if not word:
                    continue
                try:
                    grade = int(raw.get("grade") or 0)
                except ValueError:
                    continue
                if grade < 2 or grade > 6:
                    continue
                rows.append(
                    {
                        "word": word,
                        "grade": grade,
                        "pos": (raw.get("pos") or "noun").strip() or "noun",
                        "hint": (raw.get("hint") or "").strip(),
                        "definition": (raw.get("definition") or "").strip(),
                        "family": (raw.get("family") or "").strip(),
                        "source": raw.get("source") or path.name,
                        "difficulty": int(raw.get("difficulty") or 1),
                    }
                )
    return rows


def infer_rule_id(word: str, entry: dict[str, Any]) -> str | None:
    if any(c in word for c in "άέήίόύώΆΈΉΊΌΎΏ"):
        if entry.get("grade", 0) >= 5:
            return "tonos-advanced"
        return "tonos-basic"
    if entry.get("family"):
        return None
    key = normalize_word(word)
    if len(key) >= 2 and key[-1] == key[-2]:
        return "double-consonant"
    return None


def build_lexika_entries(
    rows: list[dict[str, Any]],
    existing_words: list[dict[str, Any]],
    caps: dict[int, int] | None = None,
) -> list[dict[str, Any]]:
    caps = caps or CAPS
    existing_keys = {(normalize_word(w["word"]), w["grade"]) for w in existing_words}
    existing_audio = {
        normalize_word(w["word"]): w.get("audioFile", "")
        for w in existing_words
        if w.get("audioFile")
    }
    overrides = load_overrides()

    by_grade: dict[int, list[dict[str, Any]]] = {g: [] for g in range(2, 7)}
    seen: set[tuple[str, int]] = set()
    for row in rows:
        key = (normalize_word(row["word"]), row["grade"])
        if key in seen or key in existing_keys:
            continue
        seen.add(key)
        by_grade[row["grade"]].append(row)

    entries: list[dict[str, Any]] = []
    counters: dict[int, int] = {g: 0 for g in range(2, 7)}

    for grade in range(2, 7):
        cap = caps.get(grade, 90)
        for i, row in enumerate(by_grade[grade][:cap]):
            counters[grade] += 1
            morphemes = guess_morphemes(row["word"])
            raw_hint = (row.get("hint") or "").strip()
            root = morphemes.get("root")
            # Full curated sentences lack ___; is_garbled_hint treats those as bad.
            # Mask the headword first, then fall back to generators.
            if raw_hint and "___" in raw_hint and not is_garbled_hint(raw_hint):
                hint = raw_hint
            elif (
                raw_hint
                and not is_generic_hint(raw_hint)
                and not GARBLED_MARKERS.search(raw_hint)
                and len(raw_hint.strip()) >= 12
            ):
                masked = mask_word_in_hint(raw_hint, row["word"], root)
                hint = (
                    masked
                    if "___" in masked
                    else generate_contextual_hint(
                        row["word"], pos=row.get("pos", "noun"), index=i
                    )
                )
            elif is_generic_hint(raw_hint) or is_garbled_hint(raw_hint):
                hint = generate_contextual_hint(row["word"], pos=row.get("pos", "noun"), index=i)
            else:
                hint = generate_hint(
                    row["word"], pos=row.get("pos", "noun"), index=i, overrides=overrides
                )
            if "___" not in hint:
                hint = generate_contextual_hint(row["word"], pos=row.get("pos", "noun"), index=i)

            axis = "K" if row.get("family") or infer_rule_id(row["word"], row) else "R"
            entry: dict[str, Any] = {
                "id": f"lx-g{grade}-{counters[grade]:04d}",
                "word": row["word"],
                "grade": grade,
                "axis": axis,
                "hintSentence": hint,
                "feedbackRule": feedback_rule(row["word"], morphemes),
                "audioFile": audio_path_for_word(row["word"], existing_audio),
                "morphemes": morphemes,
                "difficulty": min(3, max(1, int(row.get("difficulty") or 1))),
            }
            if row.get("definition"):
                entry["definition"] = row["definition"][:200]
            if row.get("family"):
                entry["familyId"] = row["word"]
            rule_id = infer_rule_id(row["word"], row)
            if rule_id:
                entry["ruleId"] = rule_id
            if is_homophone_prone(row["word"]):
                entry["homophone"] = True
            entries.append(entry)
    return entries


def sync_families_and_rules() -> tuple[int, int]:
    families_count = 0
    rules_count = 0

    if FAMILIES_SRC.exists():
        families = json.loads(FAMILIES_SRC.read_text(encoding="utf-8"))
        WEB_CONTENT.mkdir(parents=True, exist_ok=True)
        (WEB_CONTENT / "families.json").write_text(
            json.dumps(families, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        families_count = len(families)

    # Start empty after content reset; fill via rules_snippets.json / grammar_rules.json.
    base_rules: list[dict[str, Any]] = []
    if RULES_SRC.exists():
        snippets = json.loads(RULES_SRC.read_text(encoding="utf-8"))
        base_rules.extend(snippets.get("rules", []))
    grammar_rules_path = LEXIKA_DIR / "grammar_rules.json"
    if grammar_rules_path.exists():
        grammar = json.loads(grammar_rules_path.read_text(encoding="utf-8"))
        existing_ids = {r["id"] for r in base_rules}
        for rule in grammar.get("rules", []):
            if rule["id"] not in existing_ids:
                base_rules.append(rule)

    (WEB_CONTENT / "rules.json").write_text(
        json.dumps({"rules": base_rules}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    rules_count = len(base_rules)
    return families_count, rules_count


def append_lexika(
    base_words: list[dict[str, Any]],
    input_dir: Path = LEXIKA_DIR,
    caps: dict[int, int] | None = None,
) -> tuple[list[dict[str, Any]], dict[int, int], int]:
    rows = load_lexika_rows(input_dir)
    if not rows:
        return base_words, count_by_grade(base_words), 0
    imported = build_lexika_entries(rows, base_words, caps)
    merged = merge_words(base_words, imported)
    return merged, count_by_grade(imported), len(imported)
