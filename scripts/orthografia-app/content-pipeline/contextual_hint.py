#!/usr/bin/env python3
"""Detect garbled hints and generate grammatical Greek cloze sentences."""

from __future__ import annotations

import re
import unicodedata

BLANK = "___"

GARBLED_MARKERS = re.compile(
    r"(ντιβιντί|πληιυντικ|Άεν|◊|άιλημα|Ώοιάζει|αριιμ|αδιάιετος|αιονάτη|"
    r"μίδα|δρίμο|πολιυρίνα|νιώι|ιυμών|δίναι|διασκεδαστικί|ιείος|Ύεί|"
    r"άνιρωπος|αγνίτητα|\.{3,}|…………)",
    re.I,
)

GOOD_STARTERS = re.compile(
    r"^(___|[Α-ΩΆΈΉΊΌΎΏ]|Στο|Στη|Στον|Στην|Στα|Στις|Με|Μια|Ένα|Μπορ|Θέλ|"
    r"Πήγ|Έφα|Έμα|Έχω|Είμ|Είσ|Είχ|Δεν|Δια|Κάθ|Όταν|Όλοι|Όλα|Χθες|Σήμερα|"
    r"Το |Τα |Τη |Την |Ο |Η |Εμείς|Εσύ|Εγώ|Αυτ|Βλέπ|Γράφ|Λύν|Πίν|Πέτ|"
    r"Κοίτ|Φορά|Πολλ|Μετά|Πριν|Μετ|Ήμουν|Ήταν|Ήθελ|Ήρθ|Ήπια)",
)

VERB_TEMPLATES = [
    "Σήμερα στο σπίτι θα ___.",
    "Μπορώ να ___ καλά.",
    "Θέλω να ___ μαζί σου.",
    "Στην τάξη, ___ ήρεμα.",
    "Χθες ___ στον κήπο.",
    "Κάθε μέρα ___ στο σχολείο.",
]

NOUN_TEMPLATES = [
    "Στο βιβλίο διάβασα για ___.",
    "Μιλήσαμε για ___ στην τάξη.",
    "Έμαθα τη λέξη ___ σήμερα.",
    "Η ___ είναι στο κείμενο.",
    "Βλέπω ___ στην εικόνα.",
    "Γράφω τη λέξη ___ στο τετράδιο.",
]

ADJ_TEMPLATES = [
    "Ο φίλος μου είναι ___.",
    "Είναι πολύ ___ σήμερα.",
    "Η απάντηση ήταν ___.",
    "Φαίνεται ___ στο μάθημα.",
    "Μου φάνηκε ___ η ιδέα.",
]

DEFAULT_TEMPLATES = [
    "Στην άσκηση γράφουμε τη λέξη ___.",
    "Διάβασα την πρόταση με τη λέξη ___.",
    "Η πρόταση χρειάζεται τη λέξη ___.",
    "Στο τετράδιο έγραψα τη λέξη ___.",
    "Η λέξη της ημέρας είναι ___.",
]


def normalize_word(word: str) -> str:
    base = unicodedata.normalize("NFD", word.strip().lower())
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def infer_pos(word: str, entry_pos: str = "") -> str:
    if entry_pos in ("verb", "noun", "adj", "adverb"):
        return entry_pos
    key = normalize_word(word)
    if key.endswith(
        (
            "ω",
            "ώ",
            "εις",
            "ουν",
            "ουμε",
            "αμε",
            "ησα",
            "ηκε",
            "ηκαν",
            "ησε",
            "ισε",
            "ασε",
            "ησαν",
            "ουσα",
            "ηκα",
        )
    ):
        return "verb"
    if key.endswith(
        (
            "ος",
            "η",
            "ο",
            "ές",
            "ής",
            "ικό",
            "ική",
            "ικός",
            "ιστος",
            "ιστη",
            "ίς",
            "ικίς",
            "ικη",
            "ικο",
            "ικό",
            "ιος",
            "ια",
            "ιο",
            "υος",
            "υα",
        )
    ):
        return "adj"
    if key.endswith(("α", "ας", "η", "ος", "ι", "ες", "ους", "ών", "ιο", "είο", "μα")):
        return "noun"
    return "default"


def is_garbled_hint(hint: str) -> bool:
    if not hint or BLANK not in hint:
        return True
    if GARBLED_MARKERS.search(hint):
        return True
    stripped = hint.strip()
    if not GOOD_STARTERS.match(stripped):
        return True
    if stripped.count(".") > 2:
        return True
    if len(stripped) < 12:
        return True
    return False


def generate_contextual_hint(word: str, pos: str = "", index: int = 0) -> str:
    kind = infer_pos(word, pos)
    templates = {
        "verb": VERB_TEMPLATES,
        "noun": NOUN_TEMPLATES,
        "adj": ADJ_TEMPLATES,
        "adverb": ADJ_TEMPLATES,
    }.get(kind, DEFAULT_TEMPLATES)
    return templates[index % len(templates)]
