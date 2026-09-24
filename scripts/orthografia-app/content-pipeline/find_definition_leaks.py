"""Find matching definitions that contain the headword (gives away the answer)."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORDS_JSON = ROOT.parent / "web" / "public" / "content" / "words.json"


def normalize(s: str) -> str:
    s = s.casefold()
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def definition_leaks_word(definition: str, word: str) -> bool:
    w = normalize(word.strip())
    t = normalize(definition.strip())
    if len(w) < 2 or not t:
        return False
    # Whole-token match (Greek letters)
    pattern = rf"(?<![a-zα-ω]){re.escape(w)}(?![a-zα-ω])"
    return bool(re.search(pattern, t))


def main() -> None:
    data = json.loads(WORDS_JSON.read_text(encoding="utf-8"))
    words = data if isinstance(data, list) else data.get("words", data)
    leaks: list[tuple[str, str, str]] = []
    with_def = 0
    for e in words:
        d = (e.get("definition") or "").strip()
        w = (e.get("word") or "").strip()
        if not d:
            continue
        with_def += 1
        if definition_leaks_word(d, w):
            leaks.append((e.get("id", ""), w, d))

    out = ROOT / "definition_leaks_report.txt"
    lines = [f"with_definition={with_def} leaks={len(leaks)}"]
    for i, w, d in leaks:
        lines.append(f"{i}\t{w}\t{d}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(leaks)} leaks)")


if __name__ == "__main__":
    main()
