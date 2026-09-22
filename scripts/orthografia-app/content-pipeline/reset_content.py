#!/usr/bin/env python3
"""Wipe all lexicon content so we can rebuild from scratch.

Clears published JSON, audio, pipeline CSV/JSON inputs, and review packs.
Does NOT delete pipeline scripts or the web app.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
WEB_CONTENT = PIPELINE.parent / "web" / "public" / "content"
INPUTS = PIPELINE / "inputs"
REVIEW = PIPELINE / "review"
OUTPUTS = PIPELINE / "outputs"

EMPTY_WORDS = {"version": 2, "grade": 0, "words": []}
EMPTY_RULES = {"rules": []}
EMPTY_FAMILIES: dict = {}
EMPTY_DECLENSION = {"tables": {}}


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def wipe_csv(path: Path, header: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(header.rstrip() + "\n", encoding="utf-8")


def main() -> None:
    # Published content
    write_json(WEB_CONTENT / "words.json", EMPTY_WORDS)
    write_json(WEB_CONTENT / "rules.json", EMPTY_RULES)
    write_json(WEB_CONTENT / "families.json", EMPTY_FAMILIES)
    write_json(WEB_CONTENT / "declension_tables.json", EMPTY_DECLENSION)
    write_json(OUTPUTS / "words.json", EMPTY_WORDS)

    audio_dir = WEB_CONTENT / "audio"
    removed_audio = 0
    if audio_dir.exists():
        for f in audio_dir.iterdir():
            if f.is_file() and f.suffix.lower() in {".mp3", ".wav", ".ogg"}:
                f.unlink()
                removed_audio += 1

    # Lexika / grammar inputs
    lexika = INPUTS / "lexika"
    for grade in range(2, 7):
        wipe_csv(
            lexika / f"grade{grade}.csv",
            "word,grade,pos,hint,definition,family,synonyms,source,difficulty",
        )
    stale_g1 = lexika / "grade1.csv"
    if stale_g1.exists():
        stale_g1.unlink()
    write_json(lexika / "families.json", EMPTY_FAMILIES)
    write_json(lexika / "rules_snippets.json", EMPTY_RULES)
    write_json(lexika / "grammar_rules.json", EMPTY_RULES)
    write_json(lexika / "word_spelling_fixes.json", {"fixes": {}})

    # HelexKids (keep sample_grade2.csv.example for docs smoke test)
    helex = INPUTS / "helexkids"
    for name in ("grade2.csv", "grade3.csv", "grade4.csv"):
        wipe_csv(helex / name, "word,grade,pos,frequency")
    stale_hk1 = helex / "grade1.csv"
    if stale_hk1.exists():
        stale_hk1.unlink()

    # Textbooks
    wipe_csv(
        INPUTS / "textbooks" / "grade2.csv",
        "word,grade,pos,frequency,hint,source",
    )

    # Hint overrides / review status
    write_json(INPUTS / "hint_overrides.json", {})
    write_json(INPUTS / "new_hints.json", {})
    status = INPUTS / "grade_review_status.json"
    if status.exists():
        status.unlink()

    # Generated review packs + old reports
    if REVIEW.exists():
        shutil.rmtree(REVIEW)
    for report in (
        "hint_validation_report.json",
        "garbled_hints.json",
        "issues_summary.txt",
    ):
        p = PIPELINE / report
        if p.exists():
            p.unlink()

    print("Content wiped.")
    print(f"  words/rules/families/declension -> empty")
    print(f"  audio files removed: {removed_audio}")
    print(f"  input CSVs/JSON overrides cleared")
    print("Next: rebuild word_lists / rules, then generate_seed.py")


if __name__ == "__main__":
    main()
