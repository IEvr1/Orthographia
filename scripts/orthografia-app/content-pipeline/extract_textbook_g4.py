#!/usr/bin/env python3
"""Grade-4 textbook helpers: merge curated grade4.csv into words.json."""

from __future__ import annotations

from pathlib import Path

from extract_textbook import append_textbooks

PIPELINE = Path(__file__).resolve().parent
TEXTBOOK_DIR = PIPELINE / "inputs" / "textbooks"
OUTPUT_CSV = TEXTBOOK_DIR / "grade4.csv"
DEFAULT_CAP = 450
GRADE = 4


def append_textbooks_g4(
    base_words: list[dict],
    csv_path: Path = OUTPUT_CSV,
    cap: int = DEFAULT_CAP,
) -> tuple[list[dict], dict[int, int], int]:
    return append_textbooks(base_words, csv_path=csv_path, cap=cap, grade=GRADE)
