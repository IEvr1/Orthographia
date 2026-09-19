#!/usr/bin/env python3
"""Fix hint sentences in words.json for grammatical Greek and cloze format."""

from __future__ import annotations

import json
import re
from pathlib import Path

from contextual_hint import generate_contextual_hint, is_garbled_hint
from hint_generator import (
    get_override,
    guess_morphemes,
    hint_leaks_word,
    is_generic_hint,
    load_overrides,
    normalize_for_match,
    split_token_punctuation,
    tokenize_hint,
)
from import_helexkids import WEB_WORDS, write_words
from validate_hints import classify_hint

PIPELINE = Path(__file__).resolve().parent
NEW_HINTS_FILE = PIPELINE / "inputs" / "new_hints.json"
BLANK = "___"

WEAK_FALLBACKS = (
    "Συμπληρώνουμε την πρόταση με ___.",
    "Στο κείμενο χρειαζόμαστε τη λέξη ___.",
    "Η σωστή λέξη για την πρόταση είναι ___.",
    "Στο σχολείο, μιλάμε για ___.",
    "Στην τάξη, γράφουμε τη λέξη που σημαίνει ___.",
    "Με αυτή τη λέξη ονομάζουμε κάτι γύρω μας: ___.",
)


def _is_weak_fallback(hint: str) -> bool:
    return hint.strip() in WEAK_FALLBACKS


def load_new_hints() -> dict[str, str]:
    if not NEW_HINTS_FILE.exists():
        return {}
    data = json.loads(NEW_HINTS_FILE.read_text(encoding="utf-8"))
    return data.get("hints", data)


def should_mask_token(token: str, word: str, root: str | None) -> bool:
    normalized = normalize_for_match(token)
    if not normalized:
        return False
    if normalized == normalize_for_match(word):
        return True
    if root:
        normalized_root = normalize_for_match(root)
        if normalized_root and normalized.startswith(normalized_root):
            return True
    return False


def mask_word_in_hint(hint: str, word: str, root: str | None = None) -> str:
    parts: list[str] = []
    for token, is_word in tokenize_hint(hint):
        if not is_word:
            parts.append(token)
            continue
        word_part, punct = split_token_punctuation(token)
        if should_mask_token(word_part, word, root):
            parts.append(BLANK + punct)
        else:
            parts.append(token)
    return "".join(parts)


def fix_spacing(hint: str) -> str:
    hint = re.sub(r"\s{2,}", " ", hint)
    hint = re.sub(r"\s+\.", ".", hint)
    hint = re.sub(r"\s+,", ",", hint)
    hint = re.sub(r"\s+;", ";", hint)
    hint = re.sub(r"\s+\?", "?", hint)
    hint = re.sub(r"\s+!", "!", hint)
    return hint.strip()


def resolve_hint(
    entry: dict,
    overrides: dict,
    new_hints: dict[str, str],
    index: int = 0,
) -> str:
    word = entry["word"]
    current = entry.get("hintSentence", "")
    morphemes = guess_morphemes(word)
    root = morphemes.get("root")
    pos = entry.get("pos", "")

    override = get_override(word, overrides)
    if override and override.get("hint"):
        hint = str(override["hint"])
    elif word in new_hints:
        hint = new_hints[word]
    elif is_garbled_hint(current) or is_generic_hint(current) or _is_weak_fallback(current):
        hint = generate_contextual_hint(word, pos=pos, index=index)
    else:
        hint = current

    hint = fix_spacing(hint)
    from_new_hints = word in new_hints and hint == new_hints[word]
    generated = generate_contextual_hint(word, pos=pos, index=index)
    from_generated = (
        (is_garbled_hint(current) or is_generic_hint(current) or _is_weak_fallback(current))
        and hint == generated
    )

    if hint.count(BLANK) == 0:
        masked = mask_word_in_hint(hint, word, root)
        if BLANK in masked and masked.count(BLANK) == 1:
            hint = masked
        elif word in new_hints:
            hint = new_hints[word]
        elif is_generic_hint(hint):
            hint = new_hints.get(word, hint)

    if (
        not from_new_hints
        and not from_generated
        and hint.count(BLANK) == 1
        and hint_leaks_word(hint, word, root)
    ):
        masked = mask_word_in_hint(hint, word, root)
        if BLANK in masked and masked.count(BLANK) == 1:
            hint = masked

    if hint.count(BLANK) == 0 and not is_generic_hint(hint):
        hint = f"{hint.rstrip('.')} {BLANK}."

    return fix_spacing(hint)


def fix_words(words: list[dict]) -> tuple[list[dict], dict[str, int]]:
    overrides = load_overrides()
    new_hints = load_new_hints()
    stats = {"total": len(words), "changed": 0, "remaining_issues": 0}

    updated: list[dict] = []
    for index, entry in enumerate(words):
        old_hint = entry.get("hintSentence", "")
        new_hint = resolve_hint(entry, overrides, new_hints, index=index)
        new_entry = dict(entry)
        if new_hint != old_hint:
            new_entry["hintSentence"] = new_hint
            stats["changed"] += 1
        issues = classify_hint(new_entry["word"], new_hint)
        if issues:
            stats["remaining_issues"] += 1
        updated.append(new_entry)

    return updated, stats


def main() -> None:
    payload = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
    words = payload["words"]
    fixed, stats = fix_words(words)
    write_words(fixed)
    print(f"Processed {stats['total']} words")
    print(f"Changed: {stats['changed']}")
    print(f"Remaining issues: {stats['remaining_issues']}")
    print(f"Wrote {WEB_WORDS}")


if __name__ == "__main__":
    main()
