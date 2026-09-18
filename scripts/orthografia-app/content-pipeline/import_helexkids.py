#!/usr/bin/env python3
"""Scaffold for importing HelexKids word lists into words.json.

Expected input: CSV in inputs/helexkids.csv with columns:
  word, grade, axis, hintSentence, feedbackRule, root, suffix

Usage (when data is available):
  python import_helexkids.py --input inputs/helexkids.csv --merge

Until HelexKids data is licensed/obtained, use generate_seed.py for hand-curated words.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
INPUTS = PIPELINE / "inputs"
OUTPUT = PIPELINE / "outputs" / "words.json"


def slugify(word: str) -> str:
    import unicodedata

    base = unicodedata.normalize("NFD", word.lower())
    base = "".join(c for c in base if unicodedata.category(c) != "Mn")
    return base.replace("ς", "s").encode("ascii", "ignore").decode("ascii")


def row_to_entry(row: dict[str, str], index: int) -> dict:
    word = row["word"].strip()
    grade = int(row["grade"])
    return {
        "id": f"hk-{index:04d}",
        "word": word,
        "grade": grade,
        "axis": row.get("axis", "R").strip(),
        "hintSentence": row["hintSentence"].strip(),
        "feedbackRule": row["feedbackRule"].strip(),
        "audioFile": f"audio/{slugify(word)}.mp3",
        "morphemes": {"root": row["root"].strip(), "suffix": row["suffix"].strip()},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import HelexKids CSV into words.json")
    parser.add_argument("--input", type=Path, default=INPUTS / "helexkids.csv")
    parser.add_argument("--merge", action="store_true", help="Merge with existing words.json")
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(
            f"Missing {args.input}. Place a HelexKids CSV in inputs/ (see inputs/README.md)."
        )

    imported: list[dict] = []
    with args.input.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            imported.append(row_to_entry(row, i))

    if args.merge and OUTPUT.exists():
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        existing_ids = {w["id"] for w in payload["words"]}
        for entry in imported:
            if entry["id"] not in existing_ids:
                payload["words"].append(entry)
    else:
        payload = {"version": 2, "grade": 0, "words": imported}

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Imported {len(imported)} words → {OUTPUT}")


if __name__ == "__main__":
    main()
