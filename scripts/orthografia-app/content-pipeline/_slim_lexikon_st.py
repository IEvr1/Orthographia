#!/usr/bin/env python3
"""Rebuild Λεξικό Στ΄ canvas in the slim Ε΄ UI shell."""
from __future__ import annotations

import csv
import re
from pathlib import Path

CANVAS = Path(r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases")
CSV = Path(__file__).resolve().parent / "inputs" / "lexika" / "grade6.csv"
OUT = CANVAS / "lexikon-st.canvas.tsx"
SHELL = CANVAS / "lexikon-e.canvas.tsx"


def js(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def main() -> None:
    e = SHELL.read_text(encoding="utf-8")
    cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""

    existing: dict[str, dict[str, str]] = {}
    for m in re.finditer(
        r'\{word:"([^"]*)",grade:\d+,pos:"([^"]*)",diff:\d+,'
        r'sent:"((?:\\.|[^"\\])*)",expl:"((?:\\.|[^"\\])*)",fam:"((?:\\.|[^"\\])*)"\}',
        cur,
    ):
        existing[m.group(1)] = {
            "pos": m.group(2),
            "sent": m.group(3).replace('\\"', '"'),
            "expl": m.group(4).replace('\\"', '"'),
            "fam": m.group(5).replace('\\"', '"'),
        }

    rows = list(csv.DictReader(CSV.open(encoding="utf-8")))
    lines: list[str] = []
    for r in rows:
        w = r["word"]
        if w in existing:
            pos = existing[w]["pos"]
            sent = existing[w]["sent"]
            expl = existing[w]["expl"]
            fam = existing[w]["fam"]
        else:
            pos = r.get("pos") or "noun"
            sent = (r.get("hint") or "").strip()
            expl = (r.get("definition") or "").strip()
            fam = ((r.get("family") or "").strip())[:80]
        lines.append(
            "{word:"
            + js(w)
            + ",pos:"
            + js(pos)
            + ",sent:"
            + js(sent)
            + ",expl:"
            + js(expl)
            + ",fam:"
            + js(fam)
            + "},"
        )

    words_block = "\n".join(lines)
    out = re.sub(
        r"const WORDS: WordRow\[\] = \[.*?\];",
        "const WORDS: WordRow[] = [\n" + words_block + "\n];",
        e,
        count=1,
        flags=re.S,
    )
    out = out.replace(
        "export default function LexikonE()", "export default function LexikonSt()"
    )
    out = out.replace("<H1>Λεξικό Ε΄</H1>", "<H1>Λεξικό Στ΄</H1>")
    OUT.write_text(out, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.name}: {len(rows)} words, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
