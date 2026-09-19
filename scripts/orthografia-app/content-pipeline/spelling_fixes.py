#!/usr/bin/env python3
"""Apply lexika headword spelling corrections."""

from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path
from typing import Any

from audio_slug import slugify
from import_helexkids import WEB_AUDIO, WEB_WORDS, audio_path_for_word, guess_morphemes, normalize_word, write_words

PIPELINE = Path(__file__).resolve().parent
FIXES_FILE = PIPELINE / "inputs" / "lexika" / "word_spelling_fixes.json"
LEXIKA_DIR = PIPELINE / "inputs" / "lexika"


def load_spelling_fixes() -> dict[str, str]:
    if not FIXES_FILE.exists():
        return {}
    data = json.loads(FIXES_FILE.read_text(encoding="utf-8"))
    return dict(data.get("fixes", {}))


def apply_spelling_fix(word: str, fixes: dict[str, str] | None = None) -> str:
    fixes = fixes if fixes is not None else load_spelling_fixes()
    return fixes.get(word, word)


def _audio_for_corrected(
    old_word: str,
    new_word: str,
    existing_by_word: dict[str, str],
) -> str:
    new_path = audio_path_for_word(new_word, existing_by_word)
    new_slug = slugify(new_word)
    new_file = WEB_AUDIO / f"{new_slug}.mp3"
    if new_file.exists():
        return new_path

    old_slug = slugify(old_word)
    old_file = WEB_AUDIO / f"{old_slug}.mp3"
    if old_file.exists() and not new_file.exists():
        new_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(old_file, new_file)
        return f"audio/{new_slug}.mp3"

    old_key = normalize_word(old_word)
    if old_key in existing_by_word:
        return existing_by_word[old_key]
    return new_path


def fix_words_list(words: list[dict[str, Any]], fixes: dict[str, str]) -> tuple[list[dict[str, Any]], int]:
    existing_audio = {
        normalize_word(w["word"]): w.get("audioFile", "")
        for w in words
        if w.get("audioFile")
    }
    changed = 0
    updated: list[dict[str, Any]] = []

    for entry in words:
        old_word = entry.get("word", "")
        new_word = apply_spelling_fix(old_word, fixes)
        if new_word == old_word:
            updated.append(entry)
            continue

        morphemes = guess_morphemes(new_word)
        new_entry = dict(entry)
        new_entry["word"] = new_word
        new_entry["morphemes"] = morphemes
        new_entry["audioFile"] = _audio_for_corrected(old_word, new_word, existing_audio)
        if new_entry.get("familyId") == old_word:
            new_entry["familyId"] = new_word
        updated.append(new_entry)
        changed += 1

    return updated, changed


def fix_lexika_csvs(fixes: dict[str, str]) -> int:
    changed_rows = 0
    for path in sorted(LEXIKA_DIR.glob("grade*.csv")):
        rows: list[dict[str, str]] = []
        fieldnames: list[str] = []
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            fieldnames = list(reader.fieldnames or [])
            for row in reader:
                word = (row.get("word") or "").strip()
                if word in fixes:
                    row["word"] = fixes[word]
                    changed_rows += 1
                rows.append(row)
        with path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    return changed_rows


def main() -> None:
    fixes = load_spelling_fixes()
    if not fixes:
        print("No spelling fixes configured.")
        return

    payload = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
    words, word_changes = fix_words_list(payload["words"], fixes)
    payload["words"] = words
    write_words(words)

    csv_changes = fix_lexika_csvs(fixes)

    manual = json.loads(FIXES_FILE.read_text(encoding="utf-8")).get("needs_manual_review", [])
    print(f"Spelling fixes applied: {len(fixes)} mappings")
    print(f"words.json entries updated: {word_changes}")
    print(f"CSV rows updated: {csv_changes}")
    if manual:
        print("Needs manual review:", ", ".join(manual), flush=True)


if __name__ == "__main__":
    main()
