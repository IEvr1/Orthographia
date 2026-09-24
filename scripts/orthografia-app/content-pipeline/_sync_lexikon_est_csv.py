#!/usr/bin/env python3
"""Sync reviewed Ε΄/Στ΄ lexikon canvases → grade5/grade6 CSV, then ready for seed."""
from __future__ import annotations

import csv
import re
from pathlib import Path

CANVAS = Path(r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases")
LEXIKA = Path(__file__).resolve().parent / "inputs" / "lexika"
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


def parse_canvas(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    rows: list[dict] = []
    for m in re.finditer(
        r'\{word:"((?:\\.|[^"\\])*)",pos:"((?:\\.|[^"\\])*)",'
        r'sent:"((?:\\.|[^"\\])*)",expl:"((?:\\.|[^"\\])*)",fam:"((?:\\.|[^"\\])*)"\}',
        text,
    ):
        rows.append(
            {
                "word": m.group(1).replace('\\"', '"'),
                "pos": m.group(2).replace('\\"', '"'),
                "hint": m.group(3).replace('\\"', '"'),
                "definition": m.group(4).replace('\\"', '"'),
                "family": m.group(5).replace('\\"', '"'),
            }
        )
    return rows


def write_grade(grade: int, rows: list[dict], out: Path) -> None:
    out_rows = []
    for r in rows:
        out_rows.append(
            {
                "word": r["word"],
                "grade": str(grade),
                "pos": r.get("pos") or "noun",
                "hint": r.get("hint") or "",
                "definition": r.get("definition") or "",
                "family": r.get("family") or "",
                "synonyms": "",
                "source": "d_est_lexiko",
                "difficulty": "3",
            }
        )
    out_rows.sort(key=lambda r: r["word"].casefold())
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out_rows)
    print(f"Wrote {out.name}: {len(out_rows)} words (grade {grade})")


def main() -> None:
    e_rows = parse_canvas(CANVAS / "lexiko-grade5.canvas.tsx")
    st_rows = parse_canvas(CANVAS / "lexiko-grade6.canvas.tsx")
    if not e_rows:
        e_rows = parse_canvas(CANVAS / "lexikon-e.canvas.tsx")
    if not st_rows:
        st_rows = parse_canvas(CANVAS / "lexikon-st.canvas.tsx")
    if not e_rows or not st_rows:
        raise SystemExit(f"Missing canvas words: E={len(e_rows)} ST={len(st_rows)}")

    write_grade(5, e_rows, LEXIKA / "grade5.csv")
    write_grade(6, st_rows, LEXIKA / "grade6.csv")


if __name__ == "__main__":
    main()
