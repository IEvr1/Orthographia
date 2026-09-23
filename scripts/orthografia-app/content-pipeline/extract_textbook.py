#!/usr/bin/env python3
"""Extract grade-2 spelling words (and short cloze hints) from Γλώσσα Β΄ textbooks.

Reads the official pupil books (τεύχος 1–2), not the full running text:
  - vocabulary / "Μάθε να γράφεις" lists
  - frequent content words
  - short original classroom sentences, with the target word blanked

Usage:
  python extract_textbook.py
  python extract_textbook.py --pdf-dir "C:\\Users\\User\\Downloads"
"""

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from hint_generator import generate_hint, is_generic_hint, is_homophone_prone, load_overrides
from import_helexkids import (
    WEB_WORDS,
    audio_path_for_word,
    count_by_grade,
    feedback_rule,
    guess_morphemes,
    merge_words,
    normalize_word,
    repair_all_audio_paths,
    write_words,
)

PIPELINE = Path(__file__).resolve().parent
TEXTBOOK_DIR = PIPELINE / "inputs" / "textbooks"
EXTRACT_DIR = TEXTBOOK_DIR / "_extract"
OUTPUT_CSV = TEXTBOOK_DIR / "grade2.csv"

DEFAULT_PDF_NAMES = (
    "b_dim_glossa_tefchos_1_vivlio_mathiti.pdf",
    "b_dim_glossa_tefchos_2_vivlio_mathiti.pdf",
)

DEFAULT_CAP = 345
GRADE = 2

WORD_RE = re.compile(r"[Α-ΩΆΈΉΊΌΎΏΑα-ωάέήίόύώϊΐϋΰ]+")
PAGE_RE = re.compile(r"===== PAGE \d+ =====")
HYPHEN_RE = re.compile(r"([Α-Ωα-ωά-ώϊΐϋΰ])-\s*\n\s*([α-ωά-ώϊΐϋΰ])")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!;?…])\s+")
EXPLICIT_LIST_RE = re.compile(
    r"Μάθε να γράφεις σωστά τις λέξεις:?\s*([^\n.]+)",
    re.IGNORECASE,
)
STORY_WORDS_RE = re.compile(
    r"τις λέξεις:\s*([α-ωά-ώϊΐϋΰ,.\s]{8,120})",
    re.IGNORECASE,
)
ANTONYM_PAIR_RE = re.compile(
    r"([Α-ΩΆΈΉΊΌΎΏα-ωάέήίόύώϊΐϋΰ]{3,18})\s*[—–]\s*"
    r"([Α-ΩΆΈΉΊΌΎΏα-ωάέήίόύώϊΐϋΰ]{3,18})"
)
GLOSSARY_HEAD_RE = re.compile(r"Γλωσσ[άα]ριο", re.IGNORECASE)

# Pedagogical seed lists for Β΄ — keep forms that appear in the pupil books

def greek_capitalize(word: str) -> str:
    """Uppercase the first Unicode codepoint; preserve accents on the rest."""
    if not word:
        return word
    return word[0].upper() + word[1:]

# (incl. declined), but surface the nominative/lemma for spelling practice.
CURATED_LEMMA: dict[str, tuple[str, str]] = {
    # months → (surface, category)
    "ιανουαριος": ("Ιανουάριος", "μήνας"),
    "φεβρουαριος": ("Φεβρουάριος", "μήνας"),
    "μαρτιος": ("Μάρτιος", "μήνας"),
    "απριλιος": ("Απρίλιος", "μήνας"),
    "μαιος": ("Μάιος", "μήνας"),
    "ιουνιος": ("Ιούνιος", "μήνας"),
    "ιουλιος": ("Ιούλιος", "μήνας"),
    "αυγουστος": ("Αύγουστος", "μήνας"),
    "σεπτεμβριος": ("Σεπτέμβριος", "μήνας"),
    "σεπτεμβρης": ("Σεπτέμβρης", "μήνας"),
    "οκτωβριος": ("Οκτώβριος", "μήνας"),
    "νοεμβριος": ("Νοέμβριος", "μήνας"),
    "νοεμβρης": ("Νοέμβρης", "μήνας"),
    "δεκεμβριος": ("Δεκέμβριος", "μήνας"),
    "δεκεμβρης": ("Δεκέμβρης", "μήνας"),
    # days
    "δευτερα": ("Δευτέρα", "ημέρα"),
    "τριτη": ("Τρίτη", "ημέρα"),
    "τεταρτη": ("Τετάρτη", "ημέρα"),
    "πεμπτη": ("Πέμπτη", "ημέρα"),
    "παρασκευη": ("Παρασκευή", "ημέρα"),
    "σαββατο": ("Σάββατο", "ημέρα"),
    "κυριακη": ("Κυριακή", "ημέρα"),
    # seasons
    "ανοιξη": ("άνοιξη", "εποχή"),
    "καλοκαιρι": ("καλοκαίρι", "εποχή"),
    "φθινοπωρο": ("φθινόπωρο", "εποχή"),
    "χειμωνας": ("χειμώνας", "εποχή"),
    # countries / continents that appear in the books
    "ελλαδα": ("Ελλάδα", "χώρα"),
    "ιταλια": ("Ιταλία", "χώρα"),
    "γαλλια": ("Γαλλία", "χώρα"),
    "κυπρος": ("Κύπρος", "χώρα"),
    "τουρκια": ("Τουρκία", "χώρα"),
    "αμερικη": ("Αμερική", "χώρα"),
    "κινα": ("Κίνα", "χώρα"),
    "ευρωπη": ("Ευρώπη", "ήπειρος"),
    "ασια": ("Ασία", "ήπειρος"),
    "αφρικη": ("Αφρική", "ήπειρος"),
    # ερωτηματικές (accents matter: πού ≠ που, πώς ≠ πως)
    "ποιος": ("ποιος", "ερωτηματική"),
    "που": ("πού", "ερωτηματική"),
    "πως": ("πώς", "ερωτηματική"),
    "ποτε": ("πότε", "ερωτηματική"),
    "μηπως": ("μήπως", "ερωτηματική"),
    "ποσο": ("πόσο", "ερωτηματική"),
    "γιατι": ("γιατί", "ερωτηματική"),
    "τινος": ("τίνος", "ερωτηματική"),
    "τι": ("τι", "ερωτηματική"),
    # χρώματα (citation forms for Β΄)
    "κοκκινος": ("κόκκινος", "χρώμα"),
    "κοκκινο": ("κόκκινο", "χρώμα"),
    "μαυρος": ("μαύρος", "χρώμα"),
    "πρασινος": ("πράσινος", "χρώμα"),
    "πορτοκαλι": ("πορτοκαλί", "χρώμα"),
    "μπλε": ("μπλε", "χρώμα"),
    "θαλασσι": ("θαλασσί", "χρώμα"),
    "ασπρος": ("άσπρος", "χρώμα"),
    "ασπρο": ("άσπρο", "χρώμα"),
    "κιτρινος": ("κίτρινος", "χρώμα"),
    "μοβ": ("μοβ", "χρώμα"),
    "καφε": ("καφέ", "χρώμα"),
    "ροζ": ("ροζ", "χρώμα"),
    "γκρι": ("γκρι", "χρώμα"),
    "λευκος": ("λευκός", "χρώμα"),
    # σχήματα from socks / geometry passage
    "τριγωνο": ("τρίγωνο", "σχήμα"),
    "κυκλος": ("κύκλος", "σχήμα"),
    "ρομβος": ("ρόμβος", "σχήμα"),
    "αστερι": ("αστέρι", "σχήμα"),
    "τετραγωνο": ("τετράγωνο", "σχήμα"),
    "μαιανδρος": ("μαίανδρος", "σχήμα"),
    # αντίθετα (both members)
    "κολλω": ("κολλώ", "αντίθετα"),
    "ξεκολλω": ("ξεκολλώ", "αντίθετα"),
    "διψω": ("διψώ", "αντίθετα"),
    "ξεδιψω": ("ξεδιψώ", "αντίθετα"),
    "μπερδευω": ("μπερδεύω", "αντίθετα"),
    "ξεμπερδευω": ("ξεμπερδεύω", "αντίθετα"),
    "κακος": ("κακός", "αντίθετα"),
    "ακακος": ("άκακος", "αντίθετα"),
    "γνωστος": ("γνωστός", "αντίθετα"),
    "αγνωστος": ("άγνωστος", "αντίθετα"),
    "κινητος": ("κινητός", "αντίθετα"),
    "ακινητος": ("ακίνητος", "αντίθετα"),
    "υπακουος": ("υπάκουος", "αντίθετα"),
    "ανυπακουος": ("ανυπάκουος", "αντίθετα"),
    # επίθετα from textbook gender groups (canonical citation)
    "λεπτος": ("λεπτός", "επίθετο:-ος"),
    "χοντρος": ("χοντρός", "επίθετο:-ος"),
    "αδυνατος": ("αδύνατος", "επίθετο:-ος"),
    "ορθιος": ("όρθιος", "επίθετο:-ος"),
    "καθιστος": ("καθιστός", "επίθετο:-ος"),
    "μονοχρωμη": ("μονόχρωμη", "επίθετο:-η"),
    "πολυχρωμη": ("πολύχρωμη", "επίθετο:-η"),
    "μεγαλη": ("μεγάλη", "επίθετο:-η"),
    "μικρη": ("μικρή", "επίθετο:-η"),
    "ωραιο": ("ωραίο", "επίθετο:-ο"),
    "παλιο": ("παλιό", "επίθετο:-ο"),
    "ασχημο": ("άσχημο", "επίθετο:-ο"),
    "καινουργιο": ("καινούριο", "επίθετο:-ο"),
    "καινουριο": ("καινούριο", "επίθετο:-ο"),
    # αριθμοί — school-friendly orthography (εφτά/οχτώ/εννιά); alts collapse to these
    "ενα": ("ένα", "αριθμός"),
    "ενας": ("ένας", "αριθμός"),
    "μια": ("μία", "αριθμός"),
    "δυο": ("δύο", "αριθμός"),
    "τρια": ("τρία", "αριθμός"),
    "τρεις": ("τρεις", "αριθμός"),
    "τεσσερα": ("τέσσερα", "αριθμός"),
    "τεσσερις": ("τέσσερις", "αριθμός"),
    "πεντε": ("πέντε", "αριθμός"),
    "εξι": ("έξι", "αριθμός"),
    "εφτα": ("εφτά", "αριθμός"),
    "επτα": ("εφτά", "αριθμός"),
    "οχτω": ("οχτώ", "αριθμός"),
    "οκτω": ("οχτώ", "αριθμός"),
    "εννια": ("εννιά", "αριθμός"),
    "εννεα": ("εννιά", "αριθμός"),
    "δεκα": ("δέκα", "αριθμός"),
    "εντεκα": ("έντεκα", "αριθμός"),
    "δωδεκα": ("δώδεκα", "αριθμός"),
    "δεκατρια": ("δεκατρία", "αριθμός"),
    "δεκατρεις": ("δεκατρία", "αριθμός"),
    "δεκατεσσερα": ("δεκατέσσερα", "αριθμός"),
    "δεκατεσσερις": ("δεκατέσσερα", "αριθμός"),
    "δεκαπεντε": ("δεκαπέντε", "αριθμός"),
    "δεκαεξι": ("δεκαέξι", "αριθμός"),
    "δεκαεφτα": ("δεκαεφτά", "αριθμός"),
    "δεκαεπτα": ("δεκαεφτά", "αριθμός"),
    "δεκαοχτω": ("δεκαοχτώ", "αριθμός"),
    "δεκαοκτω": ("δεκαοχτώ", "αριθμός"),
    "δεκαεννια": ("δεκαεννιά", "αριθμός"),
    "δεκαεννεα": ("δεκαεννιά", "αριθμός"),
    "εικοσι": ("είκοσι", "αριθμός"),
    "εικοσιενα": ("είκοσι ένα", "αριθμός"),
    "εικοσιδυο": ("είκοσι δύο", "αριθμός"),
    "εικοσιτρια": ("είκοσι τρία", "αριθμός"),
    "εικοσιτρεις": ("είκοσι τρία", "αριθμός"),
    "εικοσιτεσσερα": ("είκοσι τέσσερα", "αριθμός"),
    "εικοσιτεσσερις": ("είκοσι τέσσερα", "αριθμός"),
    "εικοσιπεντε": ("είκοσι πέντε", "αριθμός"),
    "εικοσιεξι": ("είκοσι έξι", "αριθμός"),
    "εικοσιεφτα": ("είκοσι εφτά", "αριθμός"),
    "εικοσιεπτα": ("είκοσι εφτά", "αριθμός"),
    "εικοσιοχτω": ("είκοσι οχτώ", "αριθμός"),
    "εικοσιοκτω": ("είκοσι οχτώ", "αριθμός"),
    "εικοσιεννια": ("είκοσι εννιά", "αριθμός"),
    "εικοσιεννεα": ("είκοσι εννιά", "αριθμός"),
    "τριαντα": ("τριάντα", "αριθμός"),
    "σαραντα": ("σαράντα", "αριθμός"),
    "πενηντα": ("πενήντα", "αριθμός"),
    "εξηντα": ("εξήντα", "αριθμός"),
    "εβδομηντα": ("εβδομήντα", "αριθμός"),
    "ογδοντα": ("ογδόντα", "αριθμός"),
    "ενενηντα": ("ενενήντα", "αριθμός"),
    "εκατο": ("εκατό", "αριθμός"),
}

# Normalize curated keys (final σ) so lookups after ς→σ match.
CURATED_LEMMA = {
    normalize_word(k).replace("ς", "σ"): v for k, v in CURATED_LEMMA.items()
}

# Always emit these αριθμοί even if absent from PDF text (freq may be 0).
# One primary form per number 1–30 + tens/100; gender variants only where useful.
FORCE_INCLUDE_NUMBERS: list[str] = [
    "ένα",
    "μία",
    "ένας",
    "δύο",
    "τρία",
    "τρεις",
    "τέσσερα",
    "τέσσερις",
    "πέντε",
    "έξι",
    "εφτά",
    "οχτώ",
    "εννιά",
    "δέκα",
    "έντεκα",
    "δώδεκα",
    "δεκατρία",
    "δεκατέσσερα",
    "δεκαπέντε",
    "δεκαέξι",
    "δεκαεφτά",
    "δεκαοχτώ",
    "δεκαεννιά",
    "είκοσι",
    "είκοσι ένα",
    "είκοσι δύο",
    "είκοσι τρία",
    "είκοσι τέσσερα",
    "είκοσι πέντε",
    "είκοσι έξι",
    "είκοσι εφτά",
    "είκοσι οχτώ",
    "είκοσι εννιά",
    "τριάντα",
    "σαράντα",
    "πενήντα",
    "εξήντα",
    "εβδομήντα",
    "ογδόντα",
    "ενενήντα",
    "εκατό",
]

# Seed antonym pairs (prefix morphology) used when ranking extract candidates.
ANTONYM_PAIRS: list[tuple[str, str, str]] = [
    ("κολλώ", "ξεκολλώ", "ξε-"),
    ("διψώ", "ξεδιψώ", "ξε-"),
    ("μπερδεύω", "ξεμπερδεύω", "ξε-"),
    ("κακός", "άκακος", "ά-"),
    ("γνωστός", "άγνωστος", "ά-"),
    ("κινητός", "ακίνητος", "α-"),
    ("υπάκουος", "ανυπάκουος", "αν-"),
]

# Declined color/adjective stems → lemma key (normalized, no accents).
COLOR_STEMS: list[tuple[str, str]] = [
    ("κοκκιν", "κοκκινος"),
    ("μαυρ", "μαυρος"),
    ("πρασιν", "πρασινος"),
    ("ασπρ", "ασπρος"),
    ("κιτριν", "κιτρινος"),
    ("λευκ", "λευκος"),
]

# Stem → lemma key (handles genitive / vocative / accusative in running text)
CURATED_STEMS: list[tuple[str, str]] = [
    ("ιανουαρ", "ιανουαριος"),
    ("φεβρουαρ", "φεβρουαριος"),
    ("μαρτι", "μαρτιος"),
    ("απριλι", "απριλιος"),
    ("μαιου", "μαιος"),
    ("μαιο", "μαιος"),
    ("ιουνι", "ιουνιος"),
    ("ιουλι", "ιουλιος"),
    ("αυγουστ", "αυγουστος"),
    ("σεπτεμβρ", "σεπτεμβριος"),
    ("οκτωβρ", "οκτωβριος"),
    ("νοεμβρ", "νοεμβριος"),
    ("δεκεμβρ", "δεκεμβριος"),
    ("δευτερ", "δευτερα"),
    ("τριτ", "τριτη"),
    ("τεταρτ", "τεταρτη"),
    ("πεμπτ", "πεμπτη"),
    ("παρασκευ", "παρασκευη"),
    ("σαββατ", "σαββατο"),
    ("κυριακ", "κυριακη"),
    ("ανοιξ", "ανοιξη"),
    ("καλοκαιρ", "καλοκαιρι"),
    ("φθινοπωρ", "φθινοπωρο"),
    ("χειμων", "χειμωνας"),
    ("ελλαδ", "ελλαδα"),
    ("ιταλι", "ιταλια"),
    ("γαλλι", "γαλλια"),
    ("τουρκι", "τουρκια"),
    ("κυπρ", "κυπρος"),
    ("αμερικ", "αμερικη"),
    ("κινα", "κινα"),
    ("κιναισ", "κινα"),
    ("ευρωπ", "ευρωπη"),
    ("ασια", "ασια"),
    ("αφρικ", "αφρικη"),
    # colors / shapes / adjectives (declined)
    ("κοκκιν", "κοκκινος"),
    ("μαυρ", "μαυρος"),
    ("πρασιν", "πρασινος"),
    ("ασπρ", "ασπρος"),
    ("κιτριν", "κιτρινος"),
    ("λευκ", "λευκος"),
    ("τριγων", "τριγωνο"),
    ("κυκλ", "κυκλος"),
    ("ρομβ", "ρομβος"),
    ("αστερ", "αστερι"),
    ("τετραγων", "τετραγωνο"),
    ("μαιανδρ", "μαιανδρος"),
]

NOUN_ENDINGS = (
    "ος", "ης", "ας", "ους", "η", "α", "ω", "ι", "ο", "υ",
    "εις", "ες", "οι", "ια", "εια", "ωμα", "ιμο",
)
VERB_ENDINGS = (
    "ω", "εις", "ει", "ουμε", "ετε", "ουν", "ουνε",
    "αω", "αει", "αμε", "ατε", "ανε",
    "ησα", "ησες", "ησε", "ησαμε", "ησατε", "ησαν",
    "ηκα", "ηκες", "ηκε",
)

# Instruction / layout noise — drop sentences that look like exercises, not stories.
NOISE_MARKERS = (
    "τετράδιο",
    "άσκηση",
    "ασκήσεις",
    "σελίδα",
    "σελίδες",
    "μάθε να γράφεις",
    "πήγαινε",
    "περιεχόμενα",
    "υπουργείο",
    "συγγραφ",
    "παιδαγωγικ",
    "isbn",
    "ινστιτούτο",
    "γλωσσάριο",
    "ανθολόγιο",
    "κ.π.σ",
    "διοφαντος",
    "διοφάντος",
    "ονομαστική",
    "αιτιατική",
    "κλητική",
    "ενικός",
    "πληθυντικός",
    "οριστικό άρθρο",
    "έντονα γράμματα",
    "κεφαλαίο",
)

# Attributed literary works — do not reuse verses as hints.
LITERARY_MARKERS = (
    "ρίτσος",
    "σολωμός",
    "ροντάρι",
    "αισώπου",
    "παπαντωνίου",
    "εκδ.",
)

CHARACTER_NAMES = {
    "λουκας",
    "αρμπεν",
    "γαλενη",
    "γαληνη",
    "βαγια",
    "κουκουβαγια",
    "χωχαρουπα",
    "λιλιμερα",
    "ρουμπη",
    "κουμπη",
    "φιλιππος",
    "αδαμαντιος",
    "κοραης",
}

STOPWORDS = {
    "ο", "η", "το", "οι", "τα", "τον", "την", "τους", "τις", "του", "της", "των",
    "στο", "στη", "στην", "στον", "στα", "στις", "στους", "στης",
    "και", "κι", "να", "θα", "για", "με", "σε", "απο", "ως", "προς", "κατα",
    "ειναι", "ειμαι", "εισαι", "ειμαστε", "ειστε", "ηταν",
    "εχω", "εχει", "εχεις", "εχουμε", "εχουν", "ειχε",
    "αυτο", "αυτη", "αυτος", "αυτα", "αυτες", "αυτοι", "εγω", "εσυ", "εμεις", "εσεις",
    "που", "πως", "αν", "αλλα", "ομως", "οτι", "οταν", "ενω", "ωστε",
    "μου", "σου", "μας", "σας",
    "εδω", "εκει", "τωρα", "τοτε", "ποτε",
    "πολυ", "πιο", "λιγο",
    "ενα", "ενας", "μια", "εναν",
    "δε", "δεν", "μην", "μη",
    "σαν", "οπως",
    "καθε", "ολα", "ολοι", "ολες",
    "μπορει", "μπορεις", "μπορουμε",
    "πρεπει", "θελω", "θελει",
    "εκεινο", "εκεινη",
    "κτλ", "πχ",
    "ναι", "οχι", "μα", "γιατι", "τι", "ποιος", "ποια", "ποιο",
    "μετα", "πριν", "πανω", "κατω", "μεσα", "εξω",
    "ακομα", "ηδη", "μονο", "επισης", "μηπως", "λοιπον", "παρακατω",
    "λεει", "λεω", "πες", "πει",
    "αλλες", "αλλους", "αλλοι", "αλλη", "αλλο",
    "πολλα", "πολλες", "ποσο", "αυριο", "σειρα", "επειτα",
    "τρεις", "πρωτη", "κανει", "ειπε", "ξερεις", "μαθεις", "τινος",
    "τελος", "αρχη", "μεση", "απεξω", "αλλιως", "αλλοτε",
}

INSTRUCTION_VERBS = {
    "διαβασε", "διαβαζω", "γραφεις", "γραφω", "γραψε", "μαθε", "μαθαινω",
    "πηγαινε", "παρατηρησε", "χρωματισε", "ενωσε", "σκεψου", "υπογραμμισε",
    "συμπληρωσε", "κυκλωσε", "αντιγραψε", "βαλε", "βρες", "δες", "κοιταξε",
    "απαντησε", "χωρισε", "συγκρινε", "φαντασου",
}

GRAMMAR_TERMS = {
    "αιτιατικη", "γενικη", "ονομαστικη", "κλητικη", "αρσενικο", "θηλυκο",
    "ουδετερο", "πληθυντικος", "ενικος", "αρθρο", "οριστικο", "επιθετο",
    "ρημα", "ουσιαστικο", "επιρρημα", "συλλαβη", "τονος", "κεφαλαιο",
}

META_WORDS = {
    "σελιδα", "σελιδες", "ασκηση", "ασκησεις", "τετραδιο", "εργασιων",
    "ενοτητα", "περιεχομενα", "γλωσσαριο", "δημοτικου", "τευχος",
    "γλωσσα", "ταξιδι", "κοσμο", "πινακας", "προταση", "προτασεις",
    "κειμενο", "κειμενα", "διαλογος", "συλλαβη", "συλλαβες",
    "γραμμα", "γραμματα", "λεξη", "λεξεις", "μαθημα", "σχολικο",
    "βιβλιο", "συγγραφεις", "εικονογραφηση", "παιδαγωγικο",
    "ινστιτουτο", "υπουργειο", "πρωτο", "δευτερο", "σωστα",
    "υπογραμμισμενη", "εντονα", "χρωματιστα", "εξωφυλλο", "αλληλογραφω",
    "νιωθω", "νιωθετε", "χαρα", "τετραδιου", "γλωσσας",
    "συγγραφη", "συγγραφης", "συγγραφεας", "δηλωνουν",
    "μπαινουν", "βγαινουν", "ανοιγε", "δρομε", "καιρε",
    "γιαννης", "αγγελικη", "προσωπου", "χαρακτηριστικα",
    "λεξικο", "διψηφα", "συμφωνα", "φωνηεντα", "πληθυντικο",
    "στιξης", "γραμματικος", "πληροφοριες", "φρασεις", "φραση",
}

# Verb stems that usually come from exercise rubrics, not stories.
EXERCISE_VERB_STEMS = (
    "γραφ", "διαβασ", "μαθαιν", "μαθ", "βρ", "δειξ", "φτιαξ", "φτιαχ",
    "ψαχν", "περιγραφ", "υπογραμμ", "κυκλωσ", "συμπληρωσ", "αντιγραφ",
    "χρωματισ", "παρατηρησ", "απαντησ", "συγκριν", "φαντασ", "χωρισ",
)

GREEK_LETTERS = set("αβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώϊΐϋΰ")


def strip_accents(text: str) -> str:
    base = unicodedata.normalize("NFD", text)
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def canon_key(token: str) -> str:
    """Accent-stripped key; final σ/ς normalized to σ for stable lookups."""
    return normalize_word(token).replace("ς", "σ")


def curated_lemma_for(token: str) -> tuple[str, str] | None:
    """Map a declined form to a curated spelling lemma + category, if any."""
    k = canon_key(token)
    if k in CURATED_LEMMA:
        return CURATED_LEMMA[k]
    # Multi-word numbers: «είκοσι ένα» ↔ εικοσιενα
    k_nospace = k.replace(" ", "")
    if k_nospace in CURATED_LEMMA:
        return CURATED_LEMMA[k_nospace]
    # Also try with final ς in case a key was authored that way
    k_alt = normalize_word(token)
    if k_alt in CURATED_LEMMA:
        return CURATED_LEMMA[k_alt]
    if k_alt.replace(" ", "") in CURATED_LEMMA:
        return CURATED_LEMMA[k_alt.replace(" ", "")]
    # Avoid verb lookalikes for άνοιξη (άνοιξε / άνοιξα …)
    if k.startswith("ανοιξ") and not (k == "ανοιξη" or k.startswith("ανοιξη")):
        return None
    for stem, lemma_key in COLOR_STEMS:
        lk = canon_key(lemma_key)
        if k.startswith(stem) and len(k) <= len(stem) + 4 and lk in CURATED_LEMMA:
            return CURATED_LEMMA[lk]
        if k.startswith(stem) and len(k) <= len(stem) + 4 and lemma_key in CURATED_LEMMA:
            return CURATED_LEMMA[lemma_key]
    for stem, lemma_key in CURATED_STEMS:
        if lemma_key == "ανοιξη" and k.startswith("ανοιξ") and k != "ανοιξη":
            continue
        if k == stem or k.startswith(stem):
            if len(k) <= len(stem) + 4:
                lk = canon_key(lemma_key)
                if lk in CURATED_LEMMA:
                    return CURATED_LEMMA[lk]
                if lemma_key in CURATED_LEMMA:
                    return CURATED_LEMMA[lemma_key]
    return None


def adjective_gender_category(word: str) -> str | None:
    """Return gender-group category only for known/curated adjectives."""
    curated = curated_lemma_for(word)
    if curated and curated[1].startswith("επίθετο:"):
        return curated[1]
    return None


def canonicalize_adjective(word: str) -> tuple[str, str] | None:
    curated = curated_lemma_for(word)
    if curated and curated[1].startswith("επίθετο:"):
        return curated
    return None


def extract_textbook_adjectives(text: str) -> dict[str, str]:
    """Pull the explicit gender-grouped adjective list from the pupil book."""
    found: dict[str, str] = {}
    # Masculine -ος row, feminine -η, neuter -ο (as in the octagon box)
    patterns = [
        (r"λεπτός\s+χοντρός\s+αδύνατος\s+όρθιος\s+καθιστός", "επίθετο:-ος"),
        (r"μονόχρωμη\s+πολύχρωμη\s+μεγάλη\s+μικρή", "επίθετο:-η"),
        (r"ωραίο\s+παλιό\s+άσχημο\s+καινούριο", "επίθετο:-ο"),
    ]
    for pat, cat in patterns:
        if re.search(pat, text, flags=re.IGNORECASE):
            for tok in WORD_RE.findall(pat.encode().decode() if False else pat):
                # pat contains the words themselves
                pass
    seed = {
        "λεπτός": "επίθετο:-ος",
        "χοντρός": "επίθετο:-ος",
        "αδύνατος": "επίθετο:-ος",
        "όρθιος": "επίθετο:-ος",
        "καθιστός": "επίθετο:-ος",
        "μονόχρωμη": "επίθετο:-η",
        "πολύχρωμη": "επίθετο:-η",
        "μεγάλη": "επίθετο:-η",
        "μικρή": "επίθετο:-η",
        "ωραίο": "επίθετο:-ο",
        "παλιό": "επίθετο:-ο",
        "άσχημο": "επίθετο:-ο",
        "καινούριο": "επίθετο:-ο",
    }
    low = strip_accents(text.lower())
    for surface, cat in seed.items():
        if strip_accents(surface.lower()) in low or surface.lower() in text.lower():
            found[normalize_word(surface)] = cat
            # ensure curated surface
            CURATED_LEMMA.setdefault(
                normalize_word(surface).replace("ς", "σ"),
                (surface, cat),
            )
    return found


def guess_pos(word: str) -> str:
    curated = curated_lemma_for(word)
    if curated:
        cat = curated[1]
        if cat.startswith("επίθετο:") or cat == "χρώμα":
            return "adjective"
        if cat == "αντίθετα":
            k0 = strip_accents(curated[0].lower())
            return "verb" if k0.endswith(("ω", "ώ")) else "adjective"
        if cat == "αριθμός":
            return "number"
        if cat == "ερωτηματική":
            return "other"
        return "noun"
    if canonicalize_adjective(word):
        return "adjective"
    k = strip_accents(word.lower())
    if any(k.endswith(suf) for suf in VERB_ENDINGS) and len(k) >= 4:
        if k.endswith(("ω", "ουν", "ουμε", "ησε", "ησα", "ηκαν", "ηκε")):
            return "verb"
        if k.endswith(("εις", "ει", "ετε", "αμε", "ατε")) and not k.endswith(
            ("σης", "της", "νης", "ρεις", "δεις")
        ):
            if not any(k.endswith(n) for n in ("ος", "ης", "ας", "ους")):
                return "verb"
    if any(k.endswith(suf) for suf in NOUN_ENDINGS):
        return "noun"
    return "noun"


def is_exercise_verb(word: str) -> bool:
    k = strip_accents(word.lower()).replace("ς", "σ")
    return any(k.startswith(stem) for stem in EXERCISE_VERB_STEMS)

def discover_pdfs(pdf_dir: Path | None) -> list[Path]:
    candidates: list[Path] = []
    search_dirs = []
    if pdf_dir:
        search_dirs.append(pdf_dir)
    search_dirs.extend(
        [
            TEXTBOOK_DIR,
            Path.home() / "Downloads",
            Path(r"C:\Users\User\Downloads"),
        ]
    )
    seen: set[str] = set()
    for folder in search_dirs:
        if not folder.is_dir():
            continue
        for name in DEFAULT_PDF_NAMES:
            path = folder / name
            key = name.lower()
            if path.exists() and key not in seen:
                seen.add(key)
                candidates.append(path)
        for path in sorted(folder.glob("b_dim_glossa_tefchos_*_vivlio_mathiti.pdf")):
            key = path.name.lower()
            if key not in seen:
                seen.add(key)
                candidates.append(path)
    return candidates


def extract_pdf_text(pdf_path: Path) -> str:
    import pymupdf

    doc = pymupdf.open(str(pdf_path))
    parts: list[str] = []
    for i, page in enumerate(doc):
        parts.append(f"\n\n===== PAGE {i + 1} =====\n")
        parts.append(page.get_text("text") or "")
    doc.close()
    return "".join(parts)


def repair_text(raw: str) -> str:
    text = HYPHEN_RE.sub(r"\1\2", raw)
    text = PAGE_RE.sub("\n", text)
    text = text.replace("\u0007", " ").replace("\u00ad", "")
    text = re.sub(r"[ \t]+", " ", text)
    return text


def isolated_line_words(raw: str) -> set[str]:
    found: set[str] = set()
    for line in raw.splitlines():
        line = line.strip()
        if WORD_RE.fullmatch(line) and 4 <= len(line) <= 16:
            found.add(line)
    return found


def explicit_spelling_words(text: str) -> set[str]:
    found: set[str] = set()
    for pattern in (EXPLICIT_LIST_RE, STORY_WORDS_RE):
        for match in pattern.finditer(text):
            chunk = match.group(1)
            for token in re.split(r"[,·;]| και ", chunk):
                token = token.strip(" .")
                words = WORD_RE.findall(token)
                if len(words) == 1:
                    found.add(words[0])
                elif 1 < len(words) <= 3 and all(len(w) >= 3 for w in words):
                    # e.g. λούνα παρκ → skip multiword loans as spelling targets
                    continue
    return found


def glossary_words(raw: str) -> set[str]:
    """Collect spelling targets from Γλωσσάριο sections when text is present.

    Note: in these pupil-book PDFs the TOC points to Γλωσσάριο but the
    end pages are often empty in the text layer (image-only / blank), so
    this set may be small.
    """
    found: set[str] = set()
    # Process each PDF extract separately so book-2 TOC is not mistaken
    # for a late glossary just because it follows book-1 in a join.
    parts = re.split(r"(?====== PAGE 1 =====)", raw)
    if len(parts) <= 1:
        parts = [raw]
    for part in parts:
        if not part.strip():
            continue
        hits = list(GLOSSARY_HEAD_RE.finditer(part))
        if not hits:
            continue
        # Prefer the last heading in the last 25% of the book
        threshold = int(len(part) * 0.75)
        late = [m for m in hits if m.start() >= threshold]
        for m in late or []:
            chunk = part[m.end() : m.end() + 6000]
            letters = sum(1 for c in chunk if c.lower() in GREEK_LETTERS or c == "ς")
            if letters < 120:
                continue
            for token in WORD_RE.findall(chunk):
                if curated_lemma_for(token) or is_content_word(token, explicit=True):
                    found.add(token)
    return found


def extract_antonym_pairs(text: str) -> list[tuple[str, str, str]]:
    """Find em-dash opposite pairs; keep known pedagogical pairs + similar."""
    pairs: list[tuple[str, str, str]] = list(ANTONYM_PAIRS)
    seen = {(normalize_word(a), normalize_word(b)) for a, b, _ in pairs}
    for a, b in ANTONYM_PAIR_RE.findall(text):
        ka, kb = normalize_word(a), normalize_word(b)
        if ka == kb or len(a) < 3 or len(b) < 3:
            continue
        kb_raw = strip_accents(b.lower())
        ka_raw = strip_accents(a.lower())
        prefix = ""
        if kb_raw.startswith("ξε") and len(kb_raw) > len(ka_raw):
            prefix = "ξε-"
        elif kb_raw.startswith("αν") and ka_raw and kb_raw[2:].endswith(ka_raw[-5:]):
            prefix = "αν-"
        elif b.lower().startswith("ά") and kb_raw.startswith("α"):
            prefix = "ά-"
        elif kb_raw.startswith("α") and not kb_raw.startswith("αν") and len(kb_raw) > len(ka_raw):
            prefix = "α-"
        if not prefix:
            continue
        key = (ka, kb)
        if key in seen:
            continue
        seen.add(key)
        pairs.append((a.lower(), b.lower(), prefix))
    return pairs


def is_noise_sentence(sentence: str) -> bool:
    low = strip_accents(sentence.lower())
    if any(marker in low for marker in NOISE_MARKERS):
        return True
    if any(marker in low for marker in LITERARY_MARKERS):
        return True
    letters = [c for c in low if c in GREEK_LETTERS or c == "ς"]
    if len(letters) < 12:
        return True
    return False


def split_sentences(text: str) -> list[str]:
    collapsed = re.sub(r"\n+", " ", text)
    collapsed = re.sub(r" {2,}", " ", collapsed).strip()
    sentences = []
    for part in SENTENCE_SPLIT_RE.split(collapsed):
        part = part.strip(" \t«»\"'")
        part = re.sub(r"\.{5,}", "", part).strip()
        if not part:
            continue
        words = WORD_RE.findall(part)
        if 5 <= len(words) <= 16 and not is_noise_sentence(part):
            if part[0].isupper() or part[0] in "«\"":
                sentences.append(part)
    return sentences


def spelling_interest(word: str) -> int:
    key = strip_accents(word.lower())
    score = 0
    if re.search(r"(.)\1", key):
        score += 25
    if re.search(r"(ει|οι|υι|ω|η|υ)", key):
        score += 15
    if re.search(r"(μπ|ντ|γκ|τσ|τζ|ξ|ψ)", key):
        score += 10
    if 5 <= len(word) <= 11:
        score += 8
    if len(word) > 14:
        score -= 20
    return score


def is_content_word(word: str, explicit: bool = False) -> bool:
    if not re.search(r"[α-ωά-ώΑ-ΩΆ-Ώ]", word):
        return False
    if any(ch.isascii() and ch.isalpha() for ch in word):
        return False
    key = normalize_word(word)
    curated = curated_lemma_for(word)
    if curated:
        return True
    if key in STOPWORDS or key in META_WORDS or key in CHARACTER_NAMES:
        return False
    if key in INSTRUCTION_VERBS or key in GRAMMAR_TERMS:
        return False
    if is_exercise_verb(word) and not explicit:
        return False
    if not explicit and len(word) < 4:
        return False
    if len(word) > 16:
        return False
    if word.isupper() and len(word) <= 4:
        return False
    if len(set(key.replace("ς", "σ"))) < 2:
        return False
    return True


def _token_core(token: str) -> tuple[str, str, str]:
    """Split a surface token into (prefix punct, core, suffix punct)."""
    core = re.sub(r"^[«»\"']+|[«»\"',.;:!?…]+$", "", token)
    punct_prefix = token[: len(token) - len(token.lstrip("«»\"'"))]
    punct_suffix = token[len(core) + len(punct_prefix) :]
    return punct_prefix, core, punct_suffix


def greek_stem(word: str) -> str:
    """Lightweight stem for cloze matching of declined classroom forms."""
    key = normalize_word(word).replace("ς", "σ")
    endings = (
        "ουσ",
        "ουν",
        "εις",
        "εισ",
        "ων",
        "ου",
        "οι",
        "εσ",
        "ασ",
        "ησ",
        "οσ",
        "ω",
        "α",
        "η",
        "ο",
        "ι",
        "υ",
        "ε",
    )
    for end in endings:
        if len(key) > len(end) + 2 and key.endswith(end):
            return key[: -len(end)]
    return key


def mask_multiword(sentence: str, word: str) -> str | None:
    targets = [t for t in re.split(r"\s+", word.strip()) if t]
    if len(targets) < 2:
        return None
    target_norms = [normalize_word(t).replace("ς", "σ") for t in targets]
    tokens = list(re.finditer(r"\S+", sentence))
    n = len(targets)
    hit_at: int | None = None
    for i in range(len(tokens) - n + 1):
        ok = True
        for j, target in enumerate(target_norms):
            _prefix, core, _suffix = _token_core(tokens[i + j].group(0))
            if normalize_word(core).replace("ς", "σ") != target:
                ok = False
                break
        if ok:
            if hit_at is not None:
                return None
            hit_at = i
    if hit_at is None:
        return None

    parts: list[str] = []
    last = 0
    start = tokens[hit_at]
    end = tokens[hit_at + n - 1]
    if start.start() > last:
        parts.append(sentence[last : start.start()])
    prefix, _core, _ = _token_core(start.group(0))
    _, _, suffix = _token_core(end.group(0))
    parts.append(f"{prefix}___{suffix}")
    last = end.end()
    if last < len(sentence):
        parts.append(sentence[last:])
    cloze = "".join(parts)
    return cloze if "___" in cloze else None


def mask_word(sentence: str, word: str) -> str | None:
    """Blank the target once. Supports multi-word targets and light inflection."""
    if len(re.split(r"\s+", word.strip())) > 1:
        return mask_multiword(sentence, word)

    target = normalize_word(word).replace("ς", "σ")
    target_stem = greek_stem(word) if len(target) >= 4 else target

    def collect(match_fn) -> str | None:
        parts: list[str] = []
        last = 0
        hits = 0
        for match in re.finditer(r"\S+", sentence):
            if match.start() > last:
                parts.append(sentence[last : match.start()])
            token = match.group(0)
            punct_prefix, core, punct_suffix = _token_core(token)
            if match_fn(core):
                parts.append(f"{punct_prefix}___{punct_suffix}")
                hits += 1
            else:
                parts.append(token)
            last = match.end()
        if last < len(sentence):
            parts.append(sentence[last:])
        if hits != 1:
            return None
        cloze = "".join(parts)
        return cloze if "___" in cloze else None

    exact = collect(lambda core: normalize_word(core).replace("ς", "σ") == target)
    if exact:
        return exact
    if len(target) < 4:
        return None
    return collect(lambda core: greek_stem(core) == target_stem and len(normalize_word(core)) >= 3)


def is_good_cloze(hint: str) -> bool:
    if "___" not in hint:
        return False
    low = strip_accents(hint.lower())
    if any(marker in low for marker in NOISE_MARKERS):
        return False
    if any(marker in low for marker in LITERARY_MARKERS):
        return False
    if any(name in low for name in ("λουκας", "αρμπεν", "βαγια", "λοϊζου", "χατζηχαννα")):
        return False
    words = WORD_RE.findall(hint)
    if not (5 <= len(words) <= 14):
        return False
    if hint.rstrip().endswith((",", "·", "—", "-")):
        return False
    return True


ORIGINAL_HINTS = {
    "αλεπού": "Η ___ έφαγε τα σταφύλια στο αμπέλι.",
    "αρκούδα": "Η μεγάλη ___ κοιμάται τον χειμώνα.",
    "κροκόδειλος": "Ο ___ κολυμπά στο ποτάμι.",
    "βάτραχος": "Ο ___ κάνει πλάτς στο νερό.",
    "παπαγάλος": "Ο ___ μιλάει δυνατά στο κλουβί.",
    "παπαρούνα": "Η κόκκινη ___ άνοιξε στο χωράφι.",
    "καλάμι": "Έκοψε ένα μακρύ ___ στην όχθη.",
    "πυξίδα": "Ο ναύτης κοιτάζει την ___ για τον δρόμο.",
    "πειρατής": "Ο ___ έχει καπέλο και παπαγάλο.",
    "διαμάντι": "Το ___ λάμπει πάνω στο δαχτυλίδι.",
    "άμαξα": "Η ___ πέρασε στον χωματόδρομο.",
    "νησί": "Το καράβι έφτασε στο μικρό ___.",
    "βαρέλι": "Στο ___ βάζουν το κρασί.",
    "βιολί": "Παίζει ___ στη γιορτή του σχολείου.",
    "ακορντεόν": "Ο άντρας έπαιξε ___ στην πλατεία.",
    "άρπα": "Η ___ έχει πολλές χορδές.",
    "μπράβο": "Τα παιδιά φώναξαν ___ στον νικητή.",
    "ημερολόγιο": "Γράφω κάθε μέρα στο ___.",
    "επιστολή": "Έστειλα μια ___ στη γιαγιά μου.",
    "αποστολέας": "Ο ___ έγραψε το όνομά του στον φάκελο.",
    "παραλήπτης": "Ο ___ άνοιξε το γράμμα χαρούμενος.",
    "οικογένεια": "Η ___ μου μένει στο χωριό.",
    "αυλή": "Τα παιδιά παίζουν στην ___.",
    "ομπρέλα": "Πήρα την ___ γιατί βρέχει.",
    "παντελόνι": "Φόρεσα το μπλε ___.",
    "φούστα": "Η Μαρία φόρεσε κόκκινη ___.",
    "κάλτσες": "Φόρεσα ζεστές ___ το πρωί.",
    "γάντια": "Φορώ ___ όταν κάνει κρύο.",
    "σκουφάκι": "Έβαλε το ___ στο κεφάλι του.",
    "μπουφάν": "Φόρεσε το ___ γιατί φυσούσε.",
    "ειρήνη": "Θέλουμε ___ σε όλο τον κόσμο.",
    "άνθρωπος": "Ο ___ περπατά στον δρόμο.",
    "άντρας": "Ο ___ κουβαλά μια μεγάλη τσάντα.",
    "αλεπούδες": "Οι ___ τρέχουν στο δάσος.",
    "θαυμαστικό": "Στο τέλος της φωναχτής πρότασης μπαίνει ___.",
    "ερωτηματικό": "Η ερώτηση τελειώνει με ___.",
    "τελεία": "Κάθε πρόταση τελειώνει με ___.",
    "κόμμα": "Βάζουμε ___ ανάμεσα στις λέξεις της λίστας.",
    "παύλα": "Η ___ χωρίζει τα λόγια στον διάλογο.",
    "εισαγωγικά": "Βάζουμε ___ γύρω από τα λόγια κάποιου.",
    "ρούχα": "Μάζεψε τα ___ στην ντουλάπα.",
    "κύριος": "Ο ___ μας χαιρέτησε στον δρόμο.",
    "γλωσσοδέτες": "Λέμε ___ γρήγορα και γελάμε.",
    "λαχανόκηπος": "Στον ___ φυτρώνουν ντομάτες.",
    "σαλιγκάρι": "Το ___ περπατά αργά στο φύλλο.",
    "δασκάλα": "Η ___ έγραψε στον πίνακα.",
    "παραμύθι": "Η γιαγιά διάβασε ένα ___.",
    "ποίημα": "Απαγγείλαμε ένα ___ στην τάξη.",
    "μουσείο": "Πήγαμε εκδρομή στο ___.",
    "κατάλογος": "Έγραψε έναν ___ με ψώνια.",
    "πορτοκαλί": "Το καρότο είναι ___.",
    "πράσινος": "Ο βάτραχος είναι ___.",
    "Σαββατοκύριακα": "Τα ___ πάμε βόλτα με την οικογένεια.",
    "ψηλόλιγνος": "Ο ___ κύριος περπατά γρήγορα.",
    "μπαινοβγαίνουν": "Τα παιδιά ___ στην αυλή στο διάλειμμα.",
    "κρουασάν": "Έφαγα ένα ___ στο πρωινό.",
    "πατινάζ": "Κάνει ___ στον πάγο τον χειμώνα.",
    "ευχαριστώ": "Λέμε ___ όταν μας βοηθούν.",
    "επίσκεψη": "Κάναμε ___ στο μουσείο της πόλης.",
    "παιδιά": "Τα ___ παίζουν στην αυλή.",
    "εσώρουχα": "Έβαλε τα καθαρά ___ στο συρτάρι.",
    "νυχτικιά": "Φόρεσε την ___ πριν κοιμηθεί.",
    "αδιάβροχο": "Πήρε το ___ γιατί έβρεχε.",
    "ζακέτα": "Φόρεσε τη ___ στην αυλή.",
    "αεροπλάνο": "Το ___ πέταξε πάνω από τα σύννεφα.",
    "καράβι": "Το ___ σάλπαρε από το λιμάνι.",
    "σοκολάτα": "Έφαγε μια γλυκιά ___.",
    "γραμματόσημα": "Κολλάμε ___ στον φάκελο.",
    "φεγγάρι": "Το ___ φώτισε τη νύχτα.",
    "θάλασσα": "Κολυμπάμε στη ___ το καλοκαίρι.",
    "εγγονή": "Η γιαγιά αγκαλιάζει την ___.",
    "παππούς": "Ο ___ διαβάζει παραμύθια.",
    "πινέλο": "Ζωγραφίζω με το ___ και μπογιές.",
    "μήνυμα": "Άφησα ένα ___ στο τηλέφωνο.",
    "προσοχή": "Περνάμε τον δρόμο με ___.",
    "ψώνια": "Κουβαλάμε τα ___ από την αγορά.",
    "αποστέλλω": "___ το γράμμα στο ταχυδρομείο.",
    "παραλαμβάνω": "___ το δέμα από τον ταχυδρόμο.",
    "ποιητής": "Ο ___ έγραψε ένα όμορφο ποίημα.",
    # Μήνες / ημέρες / εποχές / χώρες
    "ιανουάριος": "Ο ___ είναι ο πρώτος μήνας του χρόνου.",
    "φεβρουάριος": "Τον ___ συχνά έχει κρύο.",
    "μάρτιος": "Τον ___ αρχίζει η άνοιξη.",
    "απρίλιος": "Τον ___ ανοίγουν πολλά λουλούδια.",
    "μάιος": "Τον ___ γιορτάζουμε την Πρωτομαγιά.",
    "ιούνιος": "Τον ___ τελειώνει το σχολείο.",
    "ιούλιος": "Τον ___ πάμε διακοπές.",
    "αύγουστος": "Τον ___ πολλές οικογένειες ταξιδεύουν.",
    "σεπτέμβριος": "Τον ___ ανοίγουν τα σχολεία.",
    "σεπτέμβρης": "Τον ___ ανοίγουν τα σχολεία.",
    "οκτώβριος": "Τον ___ πέφτουν τα φύλλα.",
    "νοέμβριος": "Τον ___ φυσάει δυνατά.",
    "νοέμβρης": "Τον ___ φυσάει δυνατά.",
    "δεκέμβριος": "Τον ___ στολίζουμε το δέντρο.",
    "δεκέμβρης": "Τον ___ στολίζουμε το δέντρο.",
    "δευτέρα": "Η ___ είναι η πρώτη μέρα της σχολικής εβδομάδας.",
    "τρίτη": "Την ___ έχουμε γυμναστική.",
    "τετάρτη": "Την ___ πάμε στη βιβλιοθήκη.",
    "πέμπτη": "Την ___ γράφουμε ορθογραφία.",
    "παρασκευή": "Την ___ ανυπομονούμε για το Σαββατοκύριακο.",
    "σάββατο": "Το ___ παίζουμε με τους φίλους μας.",
    "κυριακή": "Την ___ τρώμε όλοι μαζί.",
    "άνοιξη": "Την ___ ανθίζουν τα δέντρα.",
    "καλοκαίρι": "Το ___ κολυμπάμε στη θάλασσα.",
    "φθινόπωρο": "Το ___ μαζεύουμε φύλλα στην αυλή.",
    "χειμώνας": "Τον ___ φοράμε ζεστά ρούχα.",
    "Ελλάδα": "Ζούμε στην ___.",
    "Ιταλία": "Η ___ έχει το σχήμα μπότας.",
    "Γαλλία": "Στη ___ είναι το Παρίσι.",
    "Κύπρος": "Η ___ είναι ένα μεγάλο νησί.",
    "Τουρκία": "Η ___ είναι δίπλα στην Ελλάδα.",
    "Αμερική": "Η ___ είναι μια μεγάλη ήπειρος και χώρα.",
    "Κίνα": "Η ___ είναι μια μεγάλη χώρα στην Ασία.",
    "Ευρώπη": "Η Ελλάδα ανήκει στην ___.",
    "Ασία": "Η ___ είναι η μεγαλύτερη ήπειρος.",
    "Αφρική": "Στην ___ ζουν λιοντάρια και ελέφαντες.",
    "ποιος": "___ ήρθε πρώτος στην τάξη;",
    "πού": "___ μένεις;",
    "πώς": "___ σε λένε;",
    "πότε": "___ αρχίζει το μάθημα;",
    "μήπως": "___ ξέρεις τον δρόμο;",
    "πόσο": "___ κάνει αυτό το βιβλίο;",
    "γιατί": "___ χαμογελάς;",
    "τίνος": "___ είναι αυτή η τσάντα;",
    "τι": "___ θέλεις να φάμε;",
    "κόκκινος": "Ο ___ κύκλος είναι ζωηρός.",
    "κόκκινο": "Το μήλο είναι ___.",
    "μαύρος": "Ο ___ σκύλος τρέχει στην αυλή.",
    "πράσινος": "Ο ___ βάτραχος κάθεται στο φύλλο.",
    "πορτοκαλί": "Το καρότο είναι ___.",
    "μπλε": "Ο ουρανός είναι ___.",
    "θαλασσί": "Η θάλασσα έχει χρώμα ___.",
    "άσπρος": "Ο ___ τοίχος λάμπει στον ήλιο.",
    "άσπρο": "Το χιόνι είναι ___.",
    "κίτρινος": "Ο ___ ήλιος λάμπει.",
    "μοβ": "Το λουλούδι είναι ___.",
    "καφέ": "Η σοκολάτα είναι ___.",
    "ροζ": "Το φόρεμα είναι ___.",
    "γκρι": "Το σύννεφο είναι ___.",
    "λευκός": "Ο ___ κύκνος κολυμπά στη λίμνη.",
    "τρίγωνο": "Το ___ έχει τρεις πλευρές.",
    "κύκλος": "Ο ___ είναι στρογγυλός.",
    "ρόμβος": "Ο ___ μοιάζει με στραβό τετράγωνο.",
    "αστέρι": "Το ___ λάμπει στον ουρανό.",
    "τετράγωνο": "Το ___ έχει τέσσερις ίσες πλευρές.",
    "κολλώ": "Με την κόλλα ___ τα χαρτιά.",
    "ξεκολλώ": "Προσπαθώ να ___ το αυτοκόλλητο.",
    "διψώ": "Όταν τρέχω πολύ, ___.",
    "ξεδιψώ": "Με το νερό ___ αμέσως.",
    "μπερδεύω": "Μην ___ τις λέξεις όταν διαβάζεις.",
    "ξεμπερδεύω": "Η δασκάλα με βοηθά να ___ την άσκηση.",
    "κακός": "Ο λύκος στο παραμύθι είναι ___.",
    "άκακος": "Το αρνάκι είναι ___ και ήσυχο.",
    "γνωστός": "Αυτός ο δρόμος μου είναι ___.",
    "άγνωστος": "Ένας ___ χτύπησε την πόρτα.",
    "κινητός": "Ο ___ τροχός γυρίζει.",
    "ακίνητος": "Ο στρατιώτης έμεινε ___.",
    "υπάκουος": "Ο ___ μαθητής ακούει τη δασκάλα.",
    "ανυπάκουος": "Το ___ παιδί δεν κάθεται ήσυχα.",
    "λεπτός": "Ο ___ κύριος περπατά γρήγορα.",
    "χοντρός": "Το ___ βιβλίο είναι βαρύ.",
    "αδύνατος": "Μετά την αρρώστια ήταν ___.",
    "όρθιος": "Ο μαθητής στέκεται ___.",
    "καθιστός": "Η γιαγιά είναι ___ στην καρέκλα.",
    "μονόχρωμη": "Η ___ ομπρέλα είναι μόνο μπλε.",
    "πολύχρωμη": "Η ___ σημαία έχει πολλά χρώματα.",
    "μεγάλη": "Η ___ πόρτα ανοίγει δύσκολα.",
    "μικρή": "Η ___ γάτα κοιμάται στο καλάθι.",
    "ωραίο": "Τι ___ σπίτι!",
    "παλιό": "Το ___ ποδήλατο σκουριάζει.",
    "άσχημο": "Το ___ σύννεφο φέρνει βροχή.",
    "καινούριο": "Φόρεσα το ___ παλτό.",
    "ένα": "Έχω ___ μήλο στο χέρι.",
    "ένας": "___ φίλος με περίμενε.",
    "μία": "Έφαγα ___ τούρτα στη γιορτή.",
    "δύο": "Έχω ___ αδέρφια.",
    "τρία": "Βλέπω ___ αστέρια.",
    "τρεις": "Οι ___ φίλοι παίζουν μαζί.",
    "τέσσερα": "Το τετράγωνο έχει ___ πλευρές.",
    "τέσσερις": "Έχουμε ___ εποχές.",
    "πέντε": "Το χέρι έχει ___ δάχτυλα.",
    "έξι": "Το ζάρι δείχνει ___.",
    "εφτά": "Η εβδομάδα έχει ___ μέρες.",
    "επτά": "Η εβδομάδα έχει ___ μέρες.",
    "οχτώ": "Το χταπόδι έχει ___ πόδια.",
    "οκτώ": "Το χταπόδι έχει ___ πόδια.",
    "εννιά": "Το ___ είναι πριν από το δέκα.",
    "εννέα": "Το ___ είναι πριν από το δέκα.",
    "δέκα": "Μετράω μέχρι το ___.",
    "έντεκα": "Το ρολόι δείχνει ___.",
    "δώδεκα": "Ο χρόνος έχει ___ μήνες.",
    "δεκατρία": "Μετά το δώδεκα έρχεται το ___.",
    "δεκατέσσερα": "Δύο εβδομάδες έχουν ___ μέρες.",
    "δεκαπέντε": "Στα γενέθλιά μου έγινα ___.",
    "δεκαέξι": "Στη γιορτή ήρθαν ___ παιδιά.",
    "δεκαεφτά": "Το ___ έρχεται μετά το δεκαέξι.",
    "δεκαοχτώ": "Στα ___ ψηφίζουμε.",
    "δεκαεννιά": "Το ___ είναι πριν από το είκοσι.",
    "είκοσι": "Μετράω μέχρι το ___.",
    "είκοσι ένα": "Μετά το είκοσι έρχεται το ___.",
    "είκοσι δύο": "Μετράω: είκοσι, ___, είκοσι τρία.",
    "είκοσι τρία": "Το ___ είναι μετά το είκοσι δύο.",
    "είκοσι τέσσερα": "Το ___ είναι δύο δωδεκάδες.",
    "είκοσι πέντε": "Το ένα τέταρτο της εκατοντάδας είναι ___.",
    "είκοσι έξι": "Το ___ έρχεται μετά το είκοσι πέντε.",
    "είκοσι εφτά": "Το ___ είναι πριν από το είκοσι οχτώ.",
    "είκοσι οχτώ": "Το ___ είναι τέσσερις εβδομάδες.",
    "είκοσι εννιά": "Το ___ είναι πριν από το τριάντα.",
    "τριάντα": "Το ___ έρχεται μετά το είκοσι εννιά.",
    "σαράντα": "Μέτρησα ___ καραμέλες.",
    "πενήντα": "Το ___ είναι μισό εκατό.",
    "εξήντα": "Η ώρα έχει ___ λεπτά.",
    "εβδομήντα": "Ο παππούς είναι περίπου ___.",
    "ογδόντα": "Η γιαγιά πλησιάζει τα ___.",
    "ενενήντα": "Το ___ είναι πριν από το εκατό.",
    "εκατό": "Μέτρησα μέχρι το ___.",
}


def pick_hint(word: str, sentences: list[str], index: int) -> str:
    key = normalize_word(word)
    for candidate, hint in ORIGINAL_HINTS.items():
        if normalize_word(candidate) == key:
            return hint
    for sentence in sentences:
        cloze = mask_word(sentence, word)
        if cloze and is_good_cloze(cloze):
            return cloze
    return generate_hint(word, pos="noun", index=index, overrides=load_overrides())


def collect_candidates(texts: list[str]) -> list[dict[str, Any]]:
    joined = "\n".join(texts)
    repaired_blob = repair_text(joined)
    explicit = {w for w in explicit_spelling_words(repaired_blob) if is_content_word(w, explicit=True)}
    isolated = {w for w in isolated_line_words(joined) if is_content_word(w)}
    glossary = {w for w in glossary_words(joined) if curated_lemma_for(w) or is_content_word(w, explicit=True)}
    antonym_pairs = extract_antonym_pairs(repaired_blob)
    antonym_words = set()
    for a, b, _pfx in antonym_pairs:
        antonym_words.add(normalize_word(a))
        antonym_words.add(normalize_word(b))
    sentences = split_sentences(repaired_blob)

    freq: Counter[str] = Counter()
    forms: dict[str, Counter[str]] = defaultdict(Counter)
    sentence_index: dict[str, list[str]] = defaultdict(list)
    story_hits: Counter[str] = Counter()
    curated_hits: dict[str, str] = {}
    glossary_keys: set[str] = set()

    def add_token(token: str, *, count_freq: bool = True, from_story: bool = False, force_glossary: bool = False) -> str | None:
        curated = curated_lemma_for(token)
        if curated:
            surface, category = curated
            key = normalize_word(surface)
            if count_freq:
                freq[key] += 1
                forms[key][surface] += 1
            curated_hits[key] = category
            if from_story:
                story_hits[key] += 1
            if force_glossary:
                glossary_keys.add(key)
            return key
        if not is_content_word(token, explicit=token in explicit or force_glossary):
            return None
        key = normalize_word(token)
        if count_freq:
            freq[key] += 1
            forms[key][token] += 1
        if from_story:
            story_hits[key] += 1
        if force_glossary:
            glossary_keys.add(key)
            if key not in curated_hits:
                curated_hits[key] = "γλωσσάριο"
        if key in antonym_words and key not in curated_hits:
            curated_hits[key] = "αντίθετα"
        return key

    extract_textbook_adjectives(repaired_blob)

    for token in WORD_RE.findall(repaired_blob):
        add_token(token, count_freq=True, from_story=False)

    for gw in glossary:
        add_token(gw, count_freq=True, force_glossary=True)

    for a, b, _pfx in antonym_pairs:
        add_token(a, count_freq=True)
        add_token(b, count_freq=True)

    # Pedagogical αριθμοί: keep full 1–30 + tens/100 even if PDF freq is 0
    for surface in FORCE_INCLUDE_NUMBERS:
        key = normalize_word(surface)
        curated_hits[key] = "αριθμός"
        if not forms[key]:
            forms[key][surface] = 0
        if key not in freq:
            freq[key] = 0

    for sentence in sentences:
        seen_in_sentence: set[str] = set()
        for token in WORD_RE.findall(sentence):
            curated = curated_lemma_for(token)
            key = normalize_word(curated[0] if curated else token)
            if key in seen_in_sentence:
                continue
            resolved = add_token(token, count_freq=False, from_story=True)
            if resolved and resolved in freq:
                sentence_index[resolved].append(sentence)
                seen_in_sentence.add(resolved)

    explicit_keys = {normalize_word(w) for w in explicit}
    isolated_keys = {normalize_word(w) for w in isolated}

    rows: list[dict[str, Any]] = []
    for key, count in freq.items():
        if key not in forms or not forms[key]:
            continue
        surface = forms[key].most_common(1)[0][0]
        if (
            surface[:1].isupper()
            and len(surface) > 1
            and surface[1:].islower()
            and count < 4
            and key not in explicit_keys
            and key not in curated_hits
        ):
            continue
        accented = [
            form
            for form, _n in forms[key].most_common()
            if any(c in form for c in "άέήίόύώΆΈΉΊΌΎΏ")
        ]
        surface_l = (accented[0] if accented else surface).lower()
        if key in curated_hits:
            # Prefer curated citation form (proper nouns keep Greek title case)
            for lk, (surf, cat) in CURATED_LEMMA.items():
                if normalize_word(surf) == key:
                    surface_l = surf
                    curated_hits[key] = cat
                    break

        explicit_hit = key in explicit_keys
        isolated_hit = key in isolated_keys
        curated_hit = key in curated_hits
        glossary_hit = key in glossary_keys or curated_hits.get(key) == "γλωσσάριο"
        story_count = story_hits.get(key, 0)
        category = curated_hits.get(key, "")
        pos = guess_pos(surface_l)
        if category.startswith("επίθετο:"):
            pos = "adjective"

        if count < 2 and not explicit_hit and not isolated_hit and not curated_hit and not glossary_hit:
            if story_count < 1 or pos not in {"noun", "verb", "adjective"}:
                continue
            if spelling_interest(surface_l) < 10 and len(surface_l) < 5:
                continue

        score = count + spelling_interest(surface_l)
        if explicit_hit:
            score += 400
        if glossary_hit:
            score += 380
        if curated_hit:
            score += 350
        if key in antonym_words:
            score += 300
            category = category or "αντίθετα"
        if isolated_hit:
            score += 40
        if story_count:
            score += min(60, story_count * 8)
        if pos == "noun":
            score += 12
        elif pos == "verb" and story_count:
            score += 18
        elif pos == "adjective":
            score += 20
        if key in {normalize_word(w) for w in ORIGINAL_HINTS}:
            score += 80
        rows.append(
            {
                "word": surface_l,
                "grade": GRADE,
                "frequency": count,
                "score": score,
                "explicit": explicit_hit,
                "curated": curated_hit or glossary_hit,
                "glossary": glossary_hit,
                "category": category,
                "pos": pos,
                "story_hits": story_count,
                "sentences": sentence_index.get(key, []),
            }
        )

    rows.sort(key=lambda r: (-r["score"], -r["frequency"], r["word"]))
    return rows


def rows_to_csv_records(rows: list[dict[str, Any]], cap: int) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    seen: set[str] = set()

    def try_add(row: dict[str, Any], index: int) -> bool:
        key = normalize_word(row["word"])
        if key in seen:
            return False
        hint = pick_hint(row["word"], row["sentences"], index)
        curated_like = row.get("explicit") or row.get("curated") or row.get("glossary")
        if is_generic_hint(hint) and not curated_like:
            return False
        if any(
            marker in hint
            for marker in (
                "Με αυτή τη λέξη ονομάζουμε",
                "Στο σχολείο, μιλάμε για",
                "Στην τάξη, γράφουμε τη λέξη",
                "Συμπληρώνουμε την πρόταση",
            )
        ) and not curated_like:
            return False
        source = "glossa-b-dim"
        if row.get("glossary") and not row.get("category"):
            source = "glossa-b-dim:γλωσσάριο"
        elif row.get("curated") or row.get("glossary"):
            source = f"glossa-b-dim:{row.get('category') or 'curated'}"
        seen.add(key)
        records.append(
            {
                "word": row["word"],
                "grade": str(GRADE),
                "pos": row.get("pos") or "noun",
                "frequency": str(row["frequency"]),
                "hint": hint,
                "explanation": (row.get("explanation") or "").strip(),
                "source": source,
            }
        )
        return True

    # Pass 1: always keep curated / explicit / glossary pedagogical targets
    for i, row in enumerate(rows):
        if row.get("explicit") or row.get("curated") or row.get("glossary"):
            try_add(row, i)
        if len(records) >= cap:
            return records

    # Pass 2: fill with remaining high-scoring story words
    for i, row in enumerate(rows):
        try_add(row, i)
        if len(records) >= cap:
            break
    return records


def write_csv(records: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["word", "grade", "pos", "frequency", "hint", "explanation", "source"],
        )
        writer.writeheader()
        writer.writerows(records)


def load_textbook_rows(
    csv_path: Path = OUTPUT_CSV,
    grade: int = GRADE,
) -> list[dict[str, Any]]:
    if not csv_path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        for raw in csv.DictReader(f):
            word = (raw.get("word") or "").strip()
            if not word:
                continue
            try:
                freq = float(raw.get("frequency") or 0)
            except ValueError:
                freq = 0.0
            rows.append(
                {
                    "word": word,
                    "grade": grade,
                    "pos": (raw.get("pos") or "noun").strip() or "noun",
                    "frequency": freq,
                    "hint": (raw.get("hint") or "").strip(),
                    "explanation": (raw.get("explanation") or "").strip(),
                    "source": raw.get("source") or csv_path.name,
                }
            )
    return rows


def build_textbook_entries(
    rows: list[dict[str, Any]],
    existing_words: list[dict[str, Any]],
    cap: int = DEFAULT_CAP,
    audio_map: dict[str, str] | None = None,
    grade: int = GRADE,
) -> list[dict[str, Any]]:
    # Same lemma may exist at another grade — uniqueness is (word, grade).
    existing_keys = {
        (normalize_word(w["word"]), int(w.get("grade") or 0)) for w in existing_words
    }
    existing_audio = {
        normalize_word(w["word"]): w.get("audioFile", "")
        for w in existing_words
        if w.get("audioFile")
    }
    if audio_map:
        existing_audio = {**audio_map, **existing_audio}
    overrides = load_overrides()
    entries: list[dict[str, Any]] = []
    n = 0
    for i, row in enumerate(rows):
        key = (normalize_word(row["word"]), grade)
        if key in existing_keys:
            continue
        existing_keys.add(key)
        n += 1
        morphemes = guess_morphemes(row["word"])
        hint = row.get("hint") or generate_hint(
            row["word"], pos=row.get("pos", "noun"), index=i, overrides=overrides
        )
        if "___" not in hint:
            hint = mask_word(hint, row["word"]) or generate_hint(
                row["word"], pos=row.get("pos", "noun"), index=i, overrides=overrides
            )
        entry: dict[str, Any] = {
            "id": f"tb-g{grade}-{n:04d}",
            "word": row["word"],
            "grade": grade,
            "axis": "K" if any(c in row["word"] for c in "άέήίόύώ") else "R",
            "hintSentence": hint,
            "feedbackRule": feedback_rule(row["word"], morphemes),
            "audioFile": audio_path_for_word(row["word"], existing_audio),
            "morphemes": morphemes,
            "difficulty": 2 if len(row["word"]) >= 8 else 1,
        }
        explanation = (row.get("explanation") or "").strip()
        if explanation:
            entry["definition"] = explanation
        if is_homophone_prone(row["word"]):
            entry["homophone"] = True
        entries.append(entry)
        if n >= cap:
            break
    return entries


def append_textbooks(
    base_words: list[dict[str, Any]],
    csv_path: Path = OUTPUT_CSV,
    cap: int = DEFAULT_CAP,
    grade: int = GRADE,
) -> tuple[list[dict[str, Any]], dict[int, int], int]:
    """Replace/merge Γλώσσα textbook words for one grade into the word list.

    Existing ``tb-gN-…`` entries for that grade are removed and rebuilt from the
    curated CSV so hints/definitions stay in sync. Matching words of the same
    grade from other sources are dropped in favor of the textbook forms.
    """
    rows = load_textbook_rows(csv_path, grade=grade)
    if not rows:
        return base_words, count_by_grade(base_words), 0

    prefix = f"tb-g{grade}-"
    audio_map = {
        normalize_word(w["word"]): w.get("audioFile", "")
        for w in base_words
        if w.get("audioFile")
    }
    tb_keys = {normalize_word(r["word"]) for r in rows[:cap]}
    kept = [
        w
        for w in base_words
        if not str(w.get("id", "")).startswith(prefix)
        and not (w.get("grade") == grade and normalize_word(w["word"]) in tb_keys)
    ]
    imported = build_textbook_entries(
        rows, kept, cap, audio_map=audio_map, grade=grade
    )
    merged = merge_words(kept, imported)
    return merged, count_by_grade(imported), len(imported)


def extract_from_pdfs(pdfs: list[Path], cap: int) -> list[dict[str, str]]:
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    texts: list[str] = []
    for pdf in pdfs:
        print(f"Extracting {pdf.name} ...")
        text = extract_pdf_text(pdf)
        (EXTRACT_DIR / f"{pdf.stem}.txt").write_text(text, encoding="utf-8")
        texts.append(text)
        greek = sum(1 for c in text if c.lower() in GREEK_LETTERS or c == "ς")
        print(f"  {len(text):,} chars, {greek:,} Greek letters")
    rows = collect_candidates(texts)
    records = rows_to_csv_records(rows, cap=max(cap, 90))
    write_csv(records, OUTPUT_CSV)
    print(f"Wrote {len(records)} candidate words -> {OUTPUT_CSV}")
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract spelling words from Γλώσσα Β΄ PDFs")
    parser.add_argument("--pdf-dir", type=Path, default=None, help="Folder with the two PDFs")
    parser.add_argument("--cap", type=int, default=DEFAULT_CAP, help="Max new words to merge")
    parser.add_argument("--extract-only", action="store_true", help="Write CSV only, do not merge words.json")
    parser.add_argument("--merge-only", action="store_true", help="Merge existing CSV into words.json")
    args = parser.parse_args()

    if not args.merge_only:
        pdfs = discover_pdfs(args.pdf_dir)
        if not pdfs:
            raise SystemExit(
                "No textbooks found. Put the PDFs in Downloads or pass --pdf-dir.\n"
                "Expected: b_dim_glossa_tefchos_1_vivlio_mathiti.pdf "
                "and b_dim_glossa_tefchos_2_vivlio_mathiti.pdf"
            )
        extract_from_pdfs(pdfs, args.cap)

    if args.extract_only:
        return

    from generate_seed import build_words

    base = build_words()
    merged, tb_counts, imported = append_textbooks(base, OUTPUT_CSV, args.cap)
    from import_helexkids import INPUTS_DIR, append_helexkids

    merged, hk_counts, hk_imported = append_helexkids(merged, INPUTS_DIR)
    merged, audio_fixed = repair_all_audio_paths(merged)
    write_words(merged)
    total = count_by_grade(merged)
    print(f"Textbook words added: {imported} (G2={tb_counts[2]})")
    print(f"HelexKids added: {hk_imported}")
    if audio_fixed:
        print(f"Repaired {audio_fixed} audioFile paths.")
    print(f"Total by grade: G2={total[2]}, G3={total[3]}, G4={total[4]}")
    print(f"Wrote {len(merged)} words -> {PIPELINE / 'outputs' / 'words.json'}")
    print(f"Synced to {WEB_WORDS}")


if __name__ == "__main__":
    main()
