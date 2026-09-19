#!/usr/bin/env python3
import json
from pathlib import Path

from hint_generator import get_override, is_generic_hint, load_overrides
from validate_hints import classify_hint

WEB_WORDS = Path(__file__).resolve().parent.parent / "web" / "public" / "content" / "words.json"
data = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
overrides = load_overrides()

needs_override: list[dict] = []
needs_cloze: list[dict] = []
needs_spacing: list[dict] = []

for entry in data["words"]:
    word = entry["word"]
    hint = entry.get("hintSentence", "")
    issues = classify_hint(word, hint)
    override = get_override(word, overrides)

    if hint.count("___") == 0:
        needs_cloze.append({"id": entry["id"], "word": word, "hint": hint, "override": override})
    if any("space_before_period" in i or "double_space" in i for i in issues):
        needs_spacing.append({"id": entry["id"], "word": word, "hint": hint})
    if is_generic_hint(hint) or any(i.startswith("fallback_") for i in issues):
        if not override:
            needs_override.append(
                {"id": entry["id"], "word": word, "hint": hint, "pos": entry.get("pos", ""), "grade": entry.get("grade")}
            )

out = {
    "needs_cloze": needs_cloze,
    "needs_spacing": needs_spacing,
    "needs_override": needs_override,
}
Path("needs_fix.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"needs_cloze: {len(needs_cloze)}")
print(f"needs_spacing: {len(needs_spacing)}")
print(f"needs_override (no curated hint): {len(needs_override)}")
