#!/usr/bin/env python3
"""Quick probe of Γλώσσα Γ΄ pupil-book PDFs."""
from __future__ import annotations

from pathlib import Path

import pymupdf

DOWNLOADS = Path.home() / "Downloads"
NAMES = [
    "c_dim_glossa_tefchos_1_vivlio_mathiti.pdf",
    "c_dim_glossa_tefchos_2_vivlio_mathiti.pdf",
    "c_dim_glossa_tefchos_3_vivlio_mathiti.pdf",
]
NEEDLES = [
    "Μάθε να γράφεις",
    "Γλωσσάριο",
    "Αντίθετα",
    "χρώμα",
    "μήνας",
    "Δευτέρα",
    "Ελλάδα",
    "επίθετ",
]


def main() -> None:
    out_dir = Path(__file__).resolve().parent / "inputs" / "textbooks" / "_extract"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        path = DOWNLOADS / name
        doc = pymupdf.open(str(path))
        pages = []
        for page in doc:
            pages.append(page.get_text("text") or "")
        text = "\n".join(pages)
        (out_dir / f"{path.stem}.txt").write_text(text, encoding="utf-8")
        greek = sum(1 for c in text if ("\u0370" <= c <= "\u03ff") or ("\u1f00" <= c <= "\u1fff") or c == "ς")
        print(f"=== {name}: {len(doc)} pages, {len(text):,} chars, {greek:,} greek ===")
        for needle in NEEDLES:
            print(f"  {needle}: {text.count(needle)}")
        for i, t in enumerate(pages):
            if "Μάθε να γράφεις" in t:
                snippet = " | ".join(line.strip() for line in t.splitlines() if line.strip())[:240]
                print(f"  SPELL page {i + 1}: {snippet}")
            if "Γλωσσάριο" in t:
                letters = sum(
                    1 for c in t if ("\u0370" <= c <= "\u03ff") or ("\u1f00" <= c <= "\u1fff") or c == "ς"
                )
                print(f"  GLOSS page {i + 1}: {letters} greek letters on page")
        doc.close()


if __name__ == "__main__":
    main()
