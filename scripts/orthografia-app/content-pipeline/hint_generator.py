#!/usr/bin/env python3
"""Contextual hint generation and homophone detection for Orthographia words."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

PIPELINE = Path(__file__).resolve().parent
OVERRIDES_FILE = PIPELINE / "inputs" / "hint_overrides.json"

GENERIC_HINT_MARKERS = (
    "Συμπληρώνουμε με τη λέξη ___.",
    "Στην πρόταση γράφουμε το ρήμα ___.",
    "Συμπληρώνουμε με το επίθετο ___.",

    "Η λέξη ___ χρησιμοποιείται σε μια πρόταση για να ονομάσουμε κάτι.",
    "Γράφουμε τη λέξη ___ όταν μιλάμε για ένα αντικείμενο ή ιδέα.",
    "Στην πρόταση μπαίνει η λέξη ___.",
    "Η λέξη ___ είναι ρήμα· δείχνει μια ενέργεια.",
    "Συμπληρώνουμε με τη λέξη ___ την πρόταση που περιγράφει κάτι που κάνουμε.",
    "Γράφουμε το ρήμα ___ στη σωστή ορθογραφία.",
    "Η λέξη ___ είναι επίθετο· περιγράφει κάτι.",
    "Συμπληρώνουμε με το επίθετο ___ την πρόταση.",
    "Χρησιμοποιούμε την λέξη ___ για να περιγράψουμε.",
    "Χρησιμοποιούμε τη λέξη ___ σε μια πρόταση.",
    "Γράφουμε σωστά τη λέξη ___ στο κείμενο.",
)


def strip_accents(text: str) -> str:
    base = unicodedata.normalize("NFD", text)
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


# Elementary spelling ambiguity: η/ι/υ/ει/οι and ο/ω
HOMOPHONE_VOWEL_RE = re.compile(r"(η|ι|υ|ει|οι|ω|ο)", re.I)

# Words where accent or vowel choice is a common dictation trap
KNOWN_HOMOPHONE_WORDS = frozenset(
    strip_accents(w)
    for w in (
        "ειναι",
        "είναι",
        "ηταν",
        "ήταν",
        "εχει",
        "έχει",
        "εχουν",
        "έχουν",
        "εχεις",
        "έχεις",
        "εχουμε",
        "έχουμε",
        "εχω",
        "έχω",
        "ειπε",
        "είπε",
        "ειχε",
        "είχε",
        "ειχαν",
        "είχαν",
        "ηλιος",
        "ήλιος",
        "θαλασσα",
        "θάλασσα",
        "σχολειο",
        "σχολείο",
        "σχολειό",
        "αυτο",
        "αυτό",
        "αυτη",
        "αυτή",
        "αυτα",
        "αυτά",
        "αυτος",
        "αυτός",
        "αυτες",
        "αυτές",
        "ωρα",
        "ώρα",
        "μερα",
        "μέρα",
        "ποιος",
        "ποιό",
        "ποιός",
        "ποιο",
        "ποια",
        "ολοι",
        "όλοι",
        "ολα",
        "όλα",
        "ιδιο",
        "ίδιο",
        "ιδια",
        "ίδια",
        "γινεται",
        "γίνεται",
        "γινει",
        "γίνει",
        "γραφω",
        "γράφω",
        "γραψε",
        "γράψε",
        "γραφεις",
        "γράφεις",
        "διαβασε",
        "διάβασε",
        "λεξεις",
        "λέξεις",
        "λεξη",
        "λέξη",
        "λεξικο",
        "λεξικό",
        "ιστορια",
        "ιστορία",
        "ζωη",
        "ζωή",
        "ζωα",
        "ζώα",
        "κοσμο",
        "κόσμο",
        "κοσμου",
        "κόσμου",
        "νερο",
        "νερό",
        "γλωσσα",
        "γλώσσα",
        "εικονα",
        "εικόνα",
        "εικονες",
        "εικόνες",
        "χρωμα",
        "χρώμα",
        "χρωματα",
        "χρώματα",
        "χρονια",
        "χρονιά",
        "δημοτικου",
        "δημοτικού",
        "κεφαλαιο",
        "κεφαλαίο",
        "κεφάλαιο",
        "κειμενο",
        "κείμενο",
        "κειμενό",
        "κειμενό",
        "μπορει",
        "μπορεί",
        "μπορεις",
        "μπορείς",
        "μπορουμε",
        "μπορούμε",
        "υπαρχουν",
        "υπάρχουν",
        "υπολογιζω",
        "υπολογίζω",
        "θεος",
        "θεός",
        "θεο",
        "θεό",
        "λογια",
        "λόγια",
        "λειπουν",
        "λείπουν",
        "πρεπει",
        "πρέπει",
        "πολυ",
        "πολύ",
        "μονο",
        "μόνο",
        "καθε",
        "κάθε",
        "αλλο",
        "άλλο",
        "αλλα",
        "άλλα",
        "αλλη",
        "άλλη",
        "αλλες",
        "άλλες",
        "εποχη",
        "εποχή",
        "φορα",
        "φορά",
        "φορες",
        "φορές",
        "δρομο",
        "δρόμο",
        "ποδι",
        "πόδι",
        "χερι",
        "χέρι",
        "χερια",
        "χέρια",
        "μικρο",
        "μικρό",
        "μικρος",
        "μικρός",
        "μεγαλη",
        "μεγάλη",
        "κυκλο",
        "κύκλο",
        "πολη",
        "πόλη",
        "πολεις",
        "πόλεις",
        "παιδι",
        "παιδί",
        "παιδια",
        "παιδιά",
        "μηλο",
        "μήλο",
        "βιβλιο",
        "βιβλίο",
        "μολυβι",
        "μολύβι",
        "σπιτι",
        "σπίτι",
        "σκυλος",
        "σκύλος",
        "γατα",
        "γάτα",
        "μαμα",
        "μαμά",
        "αγαπη",
        "αγάπη",
        "ανθρωποι",
        "άνθρωποι",
        "ανθρωποι",
        "ανθρώπους",
        "ανθρωποι",
        "ανθρώποι",
    )
)

IMPROVED_FALLBACKS: dict[str, list[str]] = {
    "noun": [
        "Στο σχολείο, μιλάμε για ___.",
        "Στην τάξη, γράφουμε τη λέξη που σημαίνει ___.",
        "Με αυτή τη λέξη ονομάζουμε κάτι γύρω μας: ___.",
    ],
    "verb": [
        "Με αυτό το ρήμα λέμε τι κάνουμε: ___.",
        "Στην πρόταση περιγράφουμε μια ενέργεια: ___.",
        "Όταν κάνουμε κάτι, χρησιμοποιούμε το ρήμα ___.",
    ],
    "adj": [
        "Με αυτό περιγράφουμε πώς είναι κάτι: ___.",
        "Στην πρόταση μπαίνει λέξη που περιγράφει: ___.",
        "Για να πούμε πώς φαίνεται κάτι, γράφουμε ___.",
    ],
    "default": [
        "Συμπληρώνουμε την πρόταση με ___.",
        "Στο κείμενο χρειαζόμαστε τη λέξη ___.",
        "Η σωστή λέξη για την πρόταση είναι ___.",
    ],
}


def guess_morphemes(word: str) -> dict[str, str]:
    from import_helexkids import guess_morphemes as _guess

    return _guess(word)


def normalize_word(word: str) -> str:
    base = unicodedata.normalize("NFD", word.strip().lower())
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def normalize_for_match(text: str) -> str:
    return normalize_word(text).replace("ς", "σ")


def is_generic_hint(hint: str) -> bool:
    return any(marker in hint for marker in GENERIC_HINT_MARKERS)


def is_homophone_prone(word: str) -> bool:
    key = normalize_word(word)
    if key in KNOWN_HOMOPHONE_WORDS:
        return True
    if not HOMOPHONE_VOWEL_RE.search(key):
        return False
    # Missing accent on longer words often signals spelling difficulty
    if len(key) >= 4 and word == word.lower() and not any(
        c in word for c in "άέήίόύώΆΈΉΊΌΎΏ"
    ):
        return True
    return bool(re.search(r"(ει|οι|η|υ|ω)", key))


def load_overrides() -> dict[str, dict[str, Any]]:
    if not OVERRIDES_FILE.exists():
        return {}
    data = json.loads(OVERRIDES_FILE.read_text(encoding="utf-8"))
    return data.get("overrides", data)


def get_override(word: str, overrides: dict[str, dict[str, Any]] | None = None) -> dict[str, Any] | None:
    overrides = overrides if overrides is not None else load_overrides()
    if word in overrides:
        return overrides[word]
    key = normalize_word(word)
    for candidate, entry in overrides.items():
        if normalize_word(candidate) == key:
            return entry
    return None


def tokenize_hint(hint: str) -> list[tuple[str, bool]]:
    parts: list[tuple[str, bool]] = []
    last = 0
    for match in re.finditer(r"\S+", hint):
        if match.start() > last:
            parts.append((hint[last : match.start()], False))
        parts.append((match.group(0), True))
        last = match.end()
    if last < len(hint):
        parts.append((hint[last:], False))
    return parts


def split_token_punctuation(token: str) -> tuple[str, str]:
    match = re.match(r"^(.+?)([.,!?;:»«""…]*)$", token)
    if not match:
        return token, ""
    return match.group(1), match.group(2)


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


def hint_leaks_word(hint: str, word: str, root: str | None = None) -> bool:
    if root is None:
        root = guess_morphemes(word).get("root")
    for token, is_word in tokenize_hint(hint):
        if not is_word or token == "___":
            continue
        word_part, _ = split_token_punctuation(token)
        if should_mask_token(word_part, word, root):
            return True
    return False


def definition_leaks_word(definition: str, word: str) -> bool:
    """True if the headword appears as a token in its own definition (gives away matching)."""
    w = normalize_for_match(word.strip())
    t = normalize_for_match(definition.strip())
    if len(w) < 2 or not t:
        return False
    pattern = rf"(?<![a-zα-ω]){re.escape(w)}(?![a-zα-ω])"
    return bool(re.search(pattern, t))


def usable_matching_definition(definition: str | None, word: str) -> str | None:
    """Return a trimmed definition safe for matching, or None if empty/leaking."""
    d = (definition or "").strip()
    if not d or definition_leaks_word(d, word):
        return None
    return d


def ensure_placeholder(hint: str) -> str:
    if "___" in hint:
        return hint
    return f"{hint.rstrip('.')} ___.".replace("..", ".")


def fallback_hint(pos: str, index: int) -> str:
    key = pos if pos in IMPROVED_FALLBACKS else "default"
    templates = IMPROVED_FALLBACKS[key]
    return templates[index % len(templates)]


def generate_hint(
    word: str,
    pos: str = "default",
    index: int = 0,
    overrides: dict[str, dict[str, Any]] | None = None,
) -> str:
    override = get_override(word, overrides)
    if override and override.get("hint"):
        hint = ensure_placeholder(str(override["hint"]))
    else:
        hint = fallback_hint(pos, index)
    morphemes = guess_morphemes(word)
    if hint_leaks_word(hint, word, morphemes.get("root")):
        hint = fallback_hint(pos, index + 1)
    return hint


def enrich_entry(
    entry: dict[str, Any],
    *,
    overrides: dict[str, dict[str, Any]] | None = None,
    force: bool = False,
    index: int = 0,
) -> tuple[dict[str, Any], bool, bool]:
    """Return (entry, hint_changed, homophone_changed)."""
    overrides = overrides if overrides is not None else load_overrides()
    word = entry["word"]
    current_hint = entry.get("hintSentence", "")
    override = get_override(word, overrides)
    pos = entry.get("pos", "default")

    hint_changed = False
    homophone_changed = False
    updated = dict(entry)

    should_replace = force or is_generic_hint(current_hint)
    if should_replace:
        new_hint = generate_hint(word, pos=pos, index=index, overrides=overrides)
        if new_hint != current_hint:
            updated["hintSentence"] = new_hint
            hint_changed = True

    homophone = bool(override.get("homophone")) if override else is_homophone_prone(word)
    if homophone and not entry.get("homophone"):
        updated["homophone"] = True
        homophone_changed = True
    elif not homophone and entry.get("homophone"):
        updated.pop("homophone", None)
        homophone_changed = True

    return updated, hint_changed, homophone_changed
