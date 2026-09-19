#!/usr/bin/env python3
"""Find hint sentences that look like OCR garbage."""

import json
import re
from pathlib import Path

WEB_WORDS = Path(__file__).resolve().parent.parent / "web" / "public" / "content" / "words.json"

GARBLED_MARKERS = re.compile(
    r"(ντιβιντί|πληιυντικί|Άεν|◊|άιλημα|Ώοιάζει|αριιμ|αδιάιετος|αιονάτη|ενδιαφέρεται για τη μίδα)",
    re.I,
)

# Hints that don't look like proper sentences (no verb/noun start pattern)
BAD_START = re.compile(r"^[a-zα-ωά-ώ]{1,3}\.|^[a-zα-ωά-ώ]{1,8}\s+\.")

data = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
garbled = []
for entry in data["words"]:
    hint = entry.get("hintSentence", "")
    if GARBLED_MARKERS.search(hint):
        garbled.append((entry["id"], entry["word"], hint))
    elif hint and hint[0].islower() and not hint.startswith("___"):
        garbled.append((entry["id"], entry["word"], hint))

out = Path(__file__).resolve().parent / "garbled_hints.json"
out.write_text(
    json.dumps([{"id": i, "word": w, "hint": h} for i, w, h in garbled], ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Found {len(garbled)} garbled hints -> {out}")
