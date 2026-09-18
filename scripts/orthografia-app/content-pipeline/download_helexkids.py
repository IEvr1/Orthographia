#!/usr/bin/env python3
"""Download grade word lists from GRADIENCE Wordlist Tool.

POSTs to https://gradience.lit.auth.gr/wordlist_tool/ and saves CSV files
to inputs/helexkids/grade{1-4}.csv in the format expected by import_helexkids.py.
"""

from __future__ import annotations

import csv
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
OUTPUT_DIR = PIPELINE / "inputs" / "helexkids"
BASE_URL = "https://gradience.lit.auth.gr/wordlist_tool/"
POS = ("NOUN", "VERB", "ADJECTIVE")
WORDS_PER_GRADE = 100


def pos_to_import(pos_raw: str) -> str:
    text = pos_raw.upper()
    if "NOUN" in text:
        return "noun"
    if "VERB" in text:
        return "verb"
    if "ADJ" in text:
        return "adj"
    return "noun"


def http_post(url: str, data: list[tuple[str, str]]) -> str:
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": "Orthographia/1.0 (educational; CC BY-NC 4.0 non-commercial)",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html,application/xhtml+xml",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", errors="replace")


def http_get(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Orthographia/1.0 (educational; CC BY-NC 4.0 non-commercial)"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def fetch_grade_csv(grade: int) -> list[dict[str, str]]:
    data = [
        ("lang", "en"),
        ("grade[]", str(grade)),
        *[( "pos[]", p) for p in POS],
        ("wordlist", str(WORDS_PER_GRADE)),
    ]
    html = http_post(BASE_URL, data)
    match = re.search(r'href="([^"]+\.csv)"', html)
    if not match:
        raise RuntimeError(f"Grade {grade}: no CSV download link in response")
    csv_url = BASE_URL + match.group(1)
    raw = http_get(csv_url)

    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(text.splitlines(), delimiter=";")
    rows: list[dict[str, str]] = []
    for row in reader:
        word = (row.get("Word") or "").strip()
        if not word:
            continue
        freq_col = next((k for k in row if k.lower().startswith("freq")), "Freq")
        freq = (row.get(freq_col) or "0").strip()
        pos = pos_to_import(row.get("Part of Speech") or "")
        rows.append(
            {
                "word": word,
                "grade": str(grade),
                "pos": pos,
                "frequency": freq,
            }
        )
    return rows


def write_grade_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["word", "grade", "pos", "frequency"])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    for grade in range(1, 5):
        print(f"Downloading grade {grade}...")
        rows = fetch_grade_csv(grade)
        out = OUTPUT_DIR / f"grade{grade}.csv"
        write_grade_csv(out, rows)
        print(f"  Saved {len(rows)} words -> {out.name}")
        time.sleep(1)

    print("Done.")


if __name__ == "__main__":
    main()
