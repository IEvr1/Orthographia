"""Hand-curated KNE word lists by grade. Imported by generate_seed.py.

Intentionally empty — rebuild content from scratch.
"""

from __future__ import annotations

from typing import Any

WordDict = dict[str, Any]


def _w(
    word: str,
    grade: int,
    axis: str,
    hint: str,
    rule: str,
    slug: str,
    root: str,
    suffix: str,
    *,
    difficulty: int = 2,
    homophone: bool = False,
    rule_id: str | None = None,
) -> WordDict:
    entry: WordDict = {
        "word": word,
        "grade": grade,
        "axis": axis,
        "hintSentence": hint,
        "feedbackRule": rule,
        "audioFile": f"audio/{slug}.mp3",
        "morphemes": {"root": root, "suffix": suffix},
    }
    if difficulty != 2:
        entry["difficulty"] = difficulty
    if homophone:
        entry["homophone"] = True
    if rule_id:
        entry["ruleId"] = rule_id
    return entry


# Rebuild these lists when starting content again.
GRADE_2: list[WordDict] = []
GRADE_3_EXTRA: list[WordDict] = []
GRADE_4: list[WordDict] = []
