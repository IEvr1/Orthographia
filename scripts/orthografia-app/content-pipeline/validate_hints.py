#!/usr/bin/env python3
"""Validate hint sentences in words.json and report issues."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

from contextual_hint import is_garbled_hint
from hint_generator import guess_morphemes, hint_leaks_word, is_generic_hint

PIPELINE = Path(__file__).resolve().parent
WEB_WORDS = PIPELINE.parent / "web" / "public" / "content" / "words.json"

# Patterns that suggest poor Greek or machine-generated hints
BAD_PATTERNS = [
    (r"Στην τάξη, γράφουμε τη λέξη που σημαίνει ___\.", "fallback_meaning"),
    (r"Με αυτή τη λέξη ονομάζουμε κάτι γύρω μας: ___\.", "fallback_noun"),
    (r"Με αυτό το ρήμα λέμε τι κάνουμε: ___\.", "fallback_verb"),
    (r"Στην πρόταση περιγράφουμε μια ενέργεια: ___\.", "fallback_verb2"),
    (r"Όταν κάνουμε κάτι, χρησιμοποιούμε το ρήμα ___\.", "fallback_verb3"),
    (r"Με αυτό περιγράφουμε πώς είναι κάτι: ___\.", "fallback_adj"),
    (r"Στην πρόταση μπαίνει λέξη που περιγράφει: ___\.", "fallback_adj2"),
    (r"Για να πούμε πώς φαίνεται κάτι, γράφουμε ___\.", "fallback_adj3"),
    (r"Συμπληρώνουμε την πρόταση με ___\.", "fallback_default"),
    (r"Στο κείμενο χρειαζόμαστε τη λέξη ___\.", "fallback_default2"),
    (r"Η σωστή λέξη για την πρόταση είναι ___\.", "fallback_default3"),
    (r"Στο σχολείο, μιλάμε για ___\.", "fallback_school"),
    (r"Χρησιμοποιούμε την λέξη", "bad_article"),  # should be "τη λέξη"
    (r"___\s+\.", "space_before_period"),
    (r"\s{2,}", "double_space"),
]

# Known grammatical issues in specific hints
KNOWN_BAD = {
    "Τον ___ βρέχει πολύ.": "Should be 'Τον ___ τον βρέχει πολύ' or 'Το καλοκαίρι βρέχει πολύ' - wrong structure",
}


def classify_hint(word: str, hint: str) -> list[str]:
    probs: list[str] = []
    if not hint:
        probs.append("empty")
    if hint.count("___") != 1:
        probs.append(f"placeholder_count={hint.count('___')}")
    if is_generic_hint(hint):
        probs.append("generic")
    if is_garbled_hint(hint):
        probs.append("garbled")
    morphemes = guess_morphemes(word)
    if hint_leaks_word(hint, word, morphemes.get("root")):
        probs.append("leaks_word")
    if re.search(r"[a-zA-Z]{3,}", hint):
        probs.append("english")
    if hint in KNOWN_BAD:
        probs.append(f"known_bad:{KNOWN_BAD[hint]}")
    for pattern, label in BAD_PATTERNS:
        if re.search(pattern, hint):
            probs.append(label)
    return probs


def main() -> None:
    data = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
    words = data["words"]
    issues: list[dict] = []
    hint_counts: Counter[str] = Counter()

    for entry in words:
        word = entry["word"]
        hint = entry.get("hintSentence", "")
        hint_counts[hint] += 1
        probs = classify_hint(word, hint)
        if probs:
            issues.append(
                {
                    "id": entry.get("id", "?"),
                    "word": word,
                    "grade": entry.get("grade"),
                    "pos": entry.get("pos", ""),
                    "hint": hint,
                    "issues": probs,
                }
            )

    by_type: Counter[str] = Counter()
    for item in issues:
        for p in item["issues"]:
            by_type[p.split(":")[0].split("=")[0]] += 1

    report = {
        "total": len(words),
        "unique_hints": len(hint_counts),
        "issue_count": len(issues),
        "by_type": dict(by_type),
        "duplicate_hints": [
            {"hint": h, "count": c}
            for h, c in hint_counts.most_common(30)
            if c > 1
        ],
        "issues": issues,
    }

    out = PIPELINE / "hint_validation_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Total words: {report['total']}")
    print(f"Unique hints: {report['unique_hints']}")
    print(f"Issues found: {report['issue_count']}")
    print(f"By type: {report['by_type']}")
    print(f"Report written to {out}")


if __name__ == "__main__":
    main()
