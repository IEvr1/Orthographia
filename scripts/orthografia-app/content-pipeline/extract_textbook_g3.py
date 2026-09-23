#!/usr/bin/env python3
"""Grade-3 textbook helpers: merge curated grade3.csv into words.json.

Full PDF extraction lived here; the curated list is now maintained via
inputs/textbooks/grade3.csv + the Cursor canvas. Use --merge-only to import.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from extract_textbook import append_textbooks
from import_helexkids import count_by_grade

PIPELINE = Path(__file__).resolve().parent
TEXTBOOK_DIR = PIPELINE / "inputs" / "textbooks"
OUTPUT_CSV = TEXTBOOK_DIR / "grade3.csv"
DEFAULT_CAP = 450
GRADE = 3


def append_textbooks_g3(
    base_words: list[dict],
    csv_path: Path = OUTPUT_CSV,
    cap: int = DEFAULT_CAP,
) -> tuple[list[dict], dict[int, int], int]:
    return append_textbooks(base_words, csv_path=csv_path, cap=cap, grade=GRADE)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge Γλώσσα Γ΄ grade3.csv into words.json (tb-g3-…)"
    )
    parser.add_argument("--cap", type=int, default=DEFAULT_CAP)
    parser.add_argument(
        "--merge-only",
        action="store_true",
        help="Merge existing grade3.csv into words.json via generate_seed base",
    )
    args = parser.parse_args()

    if not OUTPUT_CSV.exists():
        raise SystemExit(f"Missing {OUTPUT_CSV}")

    if not args.merge_only:
        print("PDF extract is not bundled here. Use existing grade3.csv.")
        print(f"  python extract_textbook_g3.py --merge-only")
        print(f"  or: python generate_seed.py")
        return

    from generate_seed import build_words, main as seed_main

    # Prefer full seed pipeline so G2 + G3 stay consistent
    print("Run generate_seed.py to merge Β΄ + Γ΄ textbooks together.")
    seed_main()


if __name__ == "__main__":
    main()
