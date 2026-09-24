#!/usr/bin/env python3
"""Rebuild a slim Στ΄ review canvas that opens reliably in Cursor UI."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"c:\AI_apps\Orthographia\scripts\orthografia-app\content-pipeline")
ANALYSIS = ROOT / "inputs" / "textbooks" / "grade6_analysis.json"
CANVAS = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases"
    r"\grade6-spelling-words.canvas.tsx"
)
G5 = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases"
    r"\grade5-spelling-words.canvas.tsx"
)

MAX_SENT = 72


def js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def clip(s: str, n: int) -> str:
    s = (s or "").strip().replace("\u00a0", " ")
    # normalize fancy punctuation that can confuse some parsers
    s = (
        s.replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("…", "...")
    )
    s = re.sub(r"\s+", " ", s)
    if len(s) <= n:
        return s
    return s[: n - 3].rstrip() + "..."


def word_line(w: dict) -> str:
    return (
        "{word:"
        + js_str(w["word"])
        + ",source:"
        + js_str(w.get("source") or "")
        + ",ph:"
        + js_str(w.get("ph") or "")
        + ",cat:"
        + js_str(w.get("cat") or "")
        + ",ex:"
        + ("true" if w.get("ex") else "false")
        + ",gl:"
        + ("true" if w.get("gl") else "false")
        + ",sent:"
        + js_str(clip(w.get("sent") or "", MAX_SENT))
        + ",expl:"
        + js_str(clip(w.get("expl") or "", 40))
        + "},"
    )


def main() -> None:
    data = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    words = sorted(data["words"], key=lambda w: w["word"].casefold())
    total = len(words)
    pages = max(1, (total + 79) // 80)

    g5 = G5.read_text(encoding="utf-8")
    header = g5.split("const WORDS: WordRow[] = [")[0]
    # strip unused Stat-heavy bits already gone in g5 — keep type + imports
    ui = g5.split("export default function Grade5SpellingWords()")[1]
    ui = "export default function Grade6SpellingWords()" + ui
    ui = ui.replace("Ορθογραφία Ε΄", "Ορθογραφία Στ΄")
    ui = re.sub(
        r"\{WORDS\.length\} λέξεις · \d+ σελίδες",
        f"{{WORDS.length}} λέξεις · {pages} σελίδες",
        ui,
    )
    ui = ui.replace("--grade 5", "--grade 6")

    words_block = "\n".join(word_line(w) for w in words)
    helpers = g5.split("];\n\nconst FILTERS")[1]
    helpers = "const FILTERS" + helpers.split("export default function")[0]

    out = header + "const WORDS: WordRow[] = [\n" + words_block + "\n];\n\n" + helpers + ui
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    # ensure no BOM / NULs
    out = out.encode("utf-8").decode("utf-8")
    CANVAS.write_text(out, encoding="utf-8", newline="\n")
    print(f"wrote {CANVAS.name}: {total} words, {pages} pages, {CANVAS.stat().st_size} bytes")


if __name__ == "__main__":
    main()
