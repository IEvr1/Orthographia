#!/usr/bin/env python3
"""Put curated Ε΄ lexikon words into Δ΄, Ε΄ and Στ΄ CSVs.

Στ΄ keeps its existing curated list and merges in the Ε΄ words.
"""
from __future__ import annotations

import csv
from pathlib import Path

LEXIKA = Path(__file__).resolve().parent / "inputs" / "lexika"
SRC = LEXIKA / "grade5.csv"
DST4 = LEXIKA / "grade4.csv"
DST6 = LEXIKA / "grade6.csv"
FIELDS = [
    "word",
    "grade",
    "pos",
    "hint",
    "definition",
    "family",
    "synonyms",
    "source",
    "difficulty",
]


def row_from(r: dict, grade: int) -> dict:
    base = {k: (r.get(k) or "") for k in FIELDS}
    base["word"] = (r.get("word") or "").strip()
    base["source"] = base["source"] or "d_est_lexiko"
    base["grade"] = str(grade)
    return base


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        curated = [r for r in csv.DictReader(f) if (r.get("word") or "").strip()]

    existing6: list[dict] = []
    if DST6.exists():
        with DST6.open(encoding="utf-8-sig", newline="") as f:
            existing6 = [r for r in csv.DictReader(f) if (r.get("word") or "").strip()]

    g5 = [row_from(r, 5) for r in curated]
    g4 = [row_from(r, 4) for r in curated]

    seen6 = {(r.get("word") or "").strip() for r in existing6}
    g6 = [row_from(r, 6) for r in existing6]
    added = 0
    for r in curated:
        word = (r.get("word") or "").strip()
        if not word or word in seen6:
            continue
        g6.append(row_from(r, 6))
        seen6.add(word)
        added += 1

    write_csv(SRC, g5)
    write_csv(DST4, g4)
    write_csv(DST6, g6)
    print(f"Wrote grade5.csv: {len(g5)} words (grade 5)")
    print(f"Wrote grade4.csv: {len(g4)} words (grade 4)")
    print(f"Wrote grade6.csv: {len(g6)} words (grade 6, +{added} from Ε΄)")


if __name__ == "__main__":
    main()
