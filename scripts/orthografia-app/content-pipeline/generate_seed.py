#!/usr/bin/env python3
"""Generate words.json v2 with multi-grade KNE spelling words.

Content lists start empty after reset — add words via word_lists.py / imports.
"""

from __future__ import annotations

import json
from pathlib import Path

from extract_textbook import OUTPUT_CSV as GRADE2_CSV
from extract_textbook import append_textbooks
from extract_textbook_g3 import OUTPUT_CSV as GRADE3_CSV
from extract_textbook_g3 import append_textbooks_g3
from fix_hints import fix_words
from import_helexkids import INPUTS_DIR, append_helexkids, count_by_grade
from import_lexika import append_lexika, sync_families_and_rules
from word_lists import GRADE_2, GRADE_3_EXTRA, GRADE_4

OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
OUTPUT_FILE = OUTPUT_DIR / "words.json"
WEB_WORDS = Path(__file__).resolve().parent.parent / "web" / "public" / "content" / "words.json"

# Legacy Γ΄ seed ids (word-001..) — empty until rebuilt.
GRADE_3_BASE: list[dict] = []


def assign_ids(words: list[dict], prefix: str) -> list[dict]:
    result = []
    for i, word in enumerate(words, start=1):
        entry = dict(word)
        entry["id"] = f"{prefix}-{i:03d}"
        result.append(entry)
    return result


def build_words() -> list[dict]:
    grade_2 = assign_ids(GRADE_2[:50], "g2")
    grade_3_extra = assign_ids(GRADE_3_EXTRA[:100], "g3")
    grade_4 = assign_ids(GRADE_4[:50], "g4")
    return grade_2 + GRADE_3_BASE + grade_3_extra + grade_4


def main() -> None:
    words = build_words()
    seed_count = len(words)
    words, tb2_counts, tb2_imported = append_textbooks(words, GRADE2_CSV)
    words, tb3_counts, tb3_imported = append_textbooks_g3(words, GRADE3_CSV)
    tb_imported = tb2_imported + tb3_imported
    words, hk_counts, imported = append_helexkids(words, INPUTS_DIR)
    words, lx_counts, lx_imported = append_lexika(words)
    sync_families_and_rules()
    words, hint_stats = fix_words(words)
    words = [w for w in words if w.get("grade") != 1]
    by_grade = count_by_grade(words)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"version": 2, "grade": 0, "words": words}
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    OUTPUT_FILE.write_text(text, encoding="utf-8")
    WEB_WORDS.parent.mkdir(parents=True, exist_ok=True)
    WEB_WORDS.write_text(text, encoding="utf-8")

    extra = []
    if tb_imported:
        extra.append(f"{tb_imported} textbooks")
    if imported:
        extra.append(f"{imported} HelexKids")
    if lx_imported:
        extra.append(f"{lx_imported} lexika")
    extra_note = f" + {' + '.join(extra)}" if extra else ""
    print(f"Wrote {len(words)} words to {OUTPUT_FILE} ({seed_count} seed{extra_note})")
    print(
        f"Hints: {hint_stats['changed']} fixed, {hint_stats['remaining_issues']} remaining issues"
    )
    print(f"Synced to {WEB_WORDS}")
    print(
        f"By grade: G2={by_grade[2]}, G3={by_grade[3]}, "
        f"G4={by_grade[4]}, G5={by_grade[5]}, G6={by_grade[6]}"
    )
    if tb2_imported or tb3_imported:
        print(
            f"Textbooks added: G2={tb2_counts.get(2, 0)}, G3={tb3_counts.get(3, 0)}"
        )
    if imported:
        print(
            f"HelexKids added: G2={hk_counts[2]}, "
            f"G3={hk_counts[3]}, G4={hk_counts[4]}"
        )
    if lx_imported:
        print(
            f"Lexika added: G2={lx_counts[2]}, G3={lx_counts[3]}, "
            f"G4={lx_counts[4]}, G5={lx_counts[5]}, G6={lx_counts[6]}"
        )


if __name__ == "__main__":
    main()
