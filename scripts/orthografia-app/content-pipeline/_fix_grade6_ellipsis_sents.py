#!/usr/bin/env python3
"""Restore full sentences for Στ΄ canvas rows that end with ... (clip artifacts)."""
from __future__ import annotations

import json
import re
from pathlib import Path

CANVAS = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases"
    r"\grade6-spelling-words.canvas.tsx"
)
ANALYSIS = (
    Path(__file__).resolve().parent / "inputs" / "textbooks" / "grade6_analysis.json"
)
CSV = Path(__file__).resolve().parent / "inputs" / "textbooks" / "grade6.csv"


def ends_ellipsis(s: str) -> bool:
    s = (s or "").rstrip()
    return s.endswith("...") or s.endswith("…")


def clean_sent(s: str) -> str:
    s = (s or "").strip().replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s)
    return s


def main() -> None:
    data = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    by_word = {w["word"]: clean_sent(w.get("sent") or "") for w in data["words"]}

    text = CANVAS.read_text(encoding="utf-8")
    m = re.search(r"(const WORDS: WordRow\[\] = \[)(.*?)(\];)", text, re.S)
    if not m:
        raise SystemExit("WORDS not found")

    fixed = 0
    missing: list[str] = []

    def repl_obj(mo: re.Match) -> str:
        nonlocal fixed
        obj = mo.group(0)
        wm = re.search(r'word:("(?:\\.|[^"\\])*")', obj)
        sm = re.search(r'sent:("(?:\\.|[^"\\])*")', obj)
        if not wm or not sm:
            return obj
        word = json.loads(wm.group(1))
        sent = json.loads(sm.group(1))
        if not ends_ellipsis(sent):
            return obj
        full = by_word.get(word, "")
        if not full or ends_ellipsis(full):
            missing.append(word)
            return obj
        new = json.dumps(full, ensure_ascii=False)
        fixed += 1
        return obj[: sm.start(1)] + new + obj[sm.end(1) :]

    body = re.sub(r"\{[^{}]+\}", repl_obj, m.group(2))
    if missing:
        raise SystemExit(f"no full sentence for: {missing}")

    out = text[: m.start(2)] + body + text[m.end(2) :]
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    CANVAS.write_text(out, encoding="utf-8", newline="\n")

    # verify
    left = []
    for o in re.findall(
        r"\{[^{}]+\}",
        re.search(r"const WORDS: WordRow\[\] = \[(.*?)\];", out, re.S).group(1),
    ):
        sm = re.search(r'sent:("(?:\\.|[^"\\])*")', o)
        wm = re.search(r'word:("(?:\\.|[^"\\])*")', o)
        if not sm or not wm:
            continue
        if ends_ellipsis(json.loads(sm.group(1))):
            left.append(json.loads(wm.group(1)))

    # sync CSV hint column if present
    if CSV.exists():
        import csv

        with CSV.open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
            fields = list(rows[0].keys()) if rows else []
        n_csv = 0
        if "hint" in fields:
            for r in rows:
                w = r.get("word") or ""
                if w in by_word and ends_ellipsis(r.get("hint") or ""):
                    r["hint"] = by_word[w]
                    n_csv += 1
            with CSV.open("w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
                w.writeheader()
                w.writerows(rows)
        else:
            n_csv = -1
    else:
        n_csv = -1

    print(f"fixed={fixed} remaining={len(left)} bytes={CANVAS.stat().st_size} csv={n_csv}")
    if left:
        print("left:", left[:20])


if __name__ == "__main__":
    main()
