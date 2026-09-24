#!/usr/bin/env python3
"""Rebuild Στ΄ canvas from grade6_analysis.json (post-deletion) using Ε΄ shell."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
ANALYSIS = PIPELINE / "inputs" / "textbooks" / "grade6_analysis.json"
CSV = PIPELINE / "inputs" / "textbooks" / "grade6.csv"
CANVAS_DIR = Path(r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases")
G5 = CANVAS_DIR / "grade5-spelling-words.canvas.tsx"
OUT = CANVAS_DIR / "grade6-spelling-words.canvas.tsx"


def js(s: str) -> str:
    return json.dumps(s or "", ensure_ascii=False)


def word_line(w: dict) -> str:
    return (
        "{word:"
        + js(w["word"])
        + ",source:"
        + js(w.get("source") or "")
        + ",ph:"
        + js(w.get("ph") or "")
        + ",cat:"
        + js(w.get("cat") or "")
        + ",ex:"
        + ("true" if w.get("ex") else "false")
        + ",gl:"
        + ("true" if w.get("gl") else "false")
        + ",sent:"
        + js((w.get("sent") or "").strip())
        + ",expl:"
        + js((w.get("expl") or "").strip())
        + "},"
    )


def sync_csv(words: list[dict]) -> None:
    by = {w["word"]: w for w in words}
    with CSV.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
        fields = list(rows[0].keys()) if rows else []
    kept = []
    for r in rows:
        w = r.get("word") or ""
        if w not in by:
            continue
        src = by[w]
        if "hint" in fields:
            r["hint"] = (src.get("sent") or "").strip()
        if "explanation" in fields:
            r["explanation"] = (src.get("expl") or "").strip()
        if "source" in fields and src.get("source"):
            r["source"] = src["source"]
        kept.append(r)
    # add any analysis words missing from CSV
    have = {r["word"] for r in kept}
    for w in words:
        if w["word"] in have:
            continue
        row = {k: "" for k in fields}
        row["word"] = w["word"]
        if "grade" in fields:
            row["grade"] = "6"
        if "hint" in fields:
            row["hint"] = (w.get("sent") or "").strip()
        if "explanation" in fields:
            row["explanation"] = (w.get("expl") or "").strip()
        if "source" in fields:
            row["source"] = w.get("source") or ""
        if "pos" in fields:
            row["pos"] = "noun"
        kept.append(row)
    kept.sort(key=lambda r: (r.get("word") or "").casefold())
    with CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(kept)
    print(f"CSV synced → {len(kept)} rows")


def main() -> None:
    data = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    words = sorted(data["words"], key=lambda w: w["word"].casefold())
    sync_csv(words)

    g5 = G5.read_text(encoding="utf-8")
    header = g5.split("const WORDS: WordRow[] = [")[0]
    helpers = g5.split("];\n\nconst FILTERS", 1)[1]
    helpers = "const FILTERS" + helpers.split("export default function")[0]
    ui = g5.split("export default function Grade5SpellingWords()")[1]
    ui = "export default function Grade6SpellingWords()" + ui
    ui = ui.replace("Ορθογραφία Ε΄", "Ορθογραφία Στ΄")
    pages = max(1, (len(words) + 79) // 80)
    ui = re.sub(
        r"\{WORDS\.length\} λέξεις · \d+ σελίδες",
        f"{{WORDS.length}} λέξεις · {pages} σελίδες",
        ui,
    )
    ui = ui.replace("--grade 5", "--grade 6")

    block = "\n".join(word_line(w) for w in words)
    out = (
        header
        + "const WORDS: WordRow[] = [\n"
        + block
        + "\n];\n\n"
        + helpers
        + ui
    )
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    OUT.write_text(out, encoding="utf-8", newline="\n")

    # clear stale deleted state
    data_path = CANVAS_DIR / "grade6-spelling-words.canvas.data.json"
    data_path.write_text(
        json.dumps({"selected": [], "deleted": [], "page": 0, "filter": "Όλα"}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(f"canvas → {OUT.name}: {len(words)} words, {pages} pages, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
