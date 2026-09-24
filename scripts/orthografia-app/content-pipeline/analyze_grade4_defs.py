"""Analyze grade4 definitions: many are filled cloze hints, not real defs."""
from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def norm(s: str) -> str:
    s = s.casefold()
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def main() -> None:
    p = ROOT / "inputs" / "lexika" / "grade4.csv"
    rows = list(csv.DictReader(p.open(encoding="utf-8")))
    same = 0
    leaks = 0
    filled_examples: list[str] = []
    for r in rows:
        d = (r.get("definition") or "").strip()
        h = (r.get("hint") or "").strip()
        w = (r.get("word") or "").strip()
        if not d:
            continue
        if "___" in h and h.replace("___", w).strip() == d:
            same += 1
            if len(filled_examples) < 8:
                filled_examples.append(f"{w}: {d}")
        wn = norm(w)
        dn = norm(d)
        if len(wn) >= 2 and re.search(rf"(?<![a-zα-ω]){re.escape(wn)}(?![a-zα-ω])", dn):
            leaks += 1

    with_def = sum(1 for r in rows if (r.get("definition") or "").strip())
    out = ROOT / "grade4_def_analysis.txt"
    lines = [
        f"with_def={with_def}",
        f"def_equals_filled_hint={same}",
        f"leaks_word={leaks}",
        "examples:",
        *filled_examples,
    ]
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
