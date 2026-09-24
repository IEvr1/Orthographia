#!/usr/bin/env python3
"""Restore Δ΄ lexikon CSV from DEST canvas (undo accidental Ε΄ overwrite)."""
from __future__ import annotations

import csv
import re
from pathlib import Path

CANVAS = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases\lexikon-dest-dst.canvas.tsx"
)
OUT = Path(__file__).resolve().parent / "inputs" / "lexika" / "grade4.csv"
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


def main() -> None:
    text = CANVAS.read_text(encoding="utf-8")
    rows: list[dict] = []
    pattern = (
        r'\{word:"((?:\\.|[^"\\])*)",grade:4,pos:"((?:\\.|[^"\\])*)",diff:(\d+),'
        r'sent:"((?:\\.|[^"\\])*)",expl:"((?:\\.|[^"\\])*)",fam:"((?:\\.|[^"\\])*)"\}'
    )
    for m in re.finditer(pattern, text):
        rows.append(
            {
                "word": m.group(1).replace('\\"', '"'),
                "grade": "4",
                "pos": m.group(2).replace('\\"', '"'),
                "hint": m.group(4).replace('\\"', '"'),
                "definition": m.group(5).replace('\\"', '"'),
                "family": m.group(6).replace('\\"', '"'),
                "synonyms": "",
                "source": "d_est_lexiko",
                "difficulty": m.group(3),
            }
        )
    seen: set[str] = set()
    uniq: list[dict] = []
    for r in rows:
        if r["word"] in seen:
            continue
        seen.add(r["word"])
        uniq.append(r)
    uniq.sort(key=lambda r: r["word"].casefold())
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(uniq)
    print(f"Restored grade4.csv: {len(uniq)} words from DEST canvas")


if __name__ == "__main__":
    main()
