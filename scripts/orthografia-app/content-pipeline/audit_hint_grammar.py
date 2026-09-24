#!/usr/bin/env python3
"""Audit cloze hint sentences for gender/number agreement with the cited lemma.

The learner must type the dictionary form (lemma). If the blank sits in a
feminine/neuter/plural syntactic slot while the lemma is masculine singular
-ος (etc.), the sentence teaches the wrong form.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
WEB_WORDS = PIPELINE.parent / "web" / "public" / "content" / "words.json"
OUT = PIPELINE / "outputs" / "grammar_hint_audit.json"

BLANK = "___"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def strip_accents(s: str) -> str:
    s = nfc(s).lower().replace("ς", "σ")
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def is_adj(entry: dict, word: str) -> bool:
    pos = (entry.get("pos") or "").lower()
    if pos in {"adj", "adjective", "επίθετο", "epitheto"}:
        return True
    # Many lexicon rows omit pos; -ος/-ης adjectives are the main risk class.
    w = strip_accents(word)
    if entry.get("axis") == "K" and w.endswith("οσ"):
        # Heuristic: if feedbackRule mentions επίθετο / -ος pairing
        fr = entry.get("feedbackRule") or ""
        if "επίθετ" in fr.lower():
            return True
    return w.endswith(("ικοσ", "ιμοσ", "εροσ", "υροσ", "αιροσ", "ωνοσ", "ητοσ", "ιστοσ", "ικοσ"))


def lemma_shape(word: str) -> tuple[str, str]:
    """Return (gender_guess, number_guess) for citation form."""
    w = strip_accents(word)
    if w.endswith(("ομαι", "ουμαι", "ω", "ω")) and not w.endswith(("οσ", "ασ", "ησ")):
        if w.endswith("ω") or w.endswith("ομαι"):
            return "verb", "—"
    if w.endswith("μενοσ"):
        return "masc", "sg"
    if w.endswith("μενη"):
        return "fem", "sg"
    if w.endswith("μενο"):
        return "neut", "sg"
    if w.endswith("οσ"):
        return "masc", "sg"
    if w.endswith(("η", "α")) and len(w) > 2:
        return "fem", "sg"
    if w.endswith(("ο", "ι", "υ", "μα")):
        return "neut", "sg"
    if w.endswith(("ασ", "ησ", "εασ", "ουσ")):
        return "masc", "sg"
    if w.endswith(("οι", "εσ", "ουσ", "εισ", "α")):
        return "?", "pl"
    return "?", "sg"


FEM_ART = {
    "η",
    "μια",
    "μια",
    "την",
    "τη",
    "τησ",
    "στην",
    "στη",
    "αυτη",
    "εκεινη",
}
MASC_ART = {
    "ο",
    "ενασ",
    "εναν",
    "τον",
    "του",
    "στον",
    "αυτοσ",
    "εκεινοσ",
}
NEUT_ART = {"το", "ενα", "αυτο", "εκεινο"}  # στο handled separately
PL_ART = {"οι", "τα", "τισ", "τουσ", "των", "στα", "στισ", "στουσ", "αυτοι", "αυτεσ", "αυτα"}

FEM_NOUNS = {
    "συμπεριφορα",
    "ιδεα",
    "αποφαση",
    "ομαδα",
    "γυναικα",
    "μητερα",
    "κορη",
    "κυρια",
    "δασκαλα",
    "μερα",
    "ημερα",
    "φορα",
    "ζωη",
    "δουλειά",
    "δουλεία",
    "προσπαθεια",
    "ευκαιρια",
    "κατασταση",
    "απαντηση",
    "ερωτηση",
    "ιστορια",
    "λεξη",
    "φραση",
    "προταση",
    "ασκηση",
    "εργασια",
    "ταξη",
    "ωρα",
    "στιγμη",
    "φωνη",
    "καρδια",
    "πορτα",
    "τσαντα",
    "μπαλα",
    "εικονα",
    "σκεψη",
    "αγαπη",
    "ελπιδα",
    "χωρα",
    "πολη",
    "θαλασσα",
    "παραλια",
    "αρρωστια",
    "ζεστη",
    "ομορφια",
    "τιμη",
    "νικη",
    "ηττα",
    "χαρα",
    "λυπη",
    "ανησυχια",
    "αναγκη",
    "βοηθεια",
    "δουλεια",
}
MASC_NOUNS = {
    "ανθρωποσ",
    "μαθητησ",
    "δασκαλοσ",
    "σκυλοσ",
    "γατοσ",
    "καιροσ",
    "χαρακτηρασ",
    "κυκλοσ",
    "αγωνασ",
    "δρομοσ",
    "ουρανοσ",
    "ηλιοσ",
    "πονοσ",
    "φοβοσ",
    "θυμοσ",
    "φιλοσ",
    "πατερασ",
    "αδελφοσ",
    "αντρασ",
    "κοσμοσ",
    "τοποσ",
    "τροποσ",
    "νομοσ",
    "πινακασ",
    "κηποσ",
    "ποταμοσ",
}
NEUT_NOUNS = {
    "παιδι",
    "σπιτι",
    "βιβλιο",
    "σχολειο",
    "δεντρο",
    "λουλουδι",
    "νερο",
    "φαγητο",
    "παιχνιδι",
    "δωματιο",
    "τραπεζι",
    "παραθυρο",
    "αυτοκινητο",
    "ζωο",
    "πουλι",
    "δασοσ",
    "βουνο",
    "σωμα",
    "ματι",
    "χερι",
    "ποδι",
    "ρουχο",
    "καπελο",
}


def tokenize(text: str) -> list[str]:
    return re.findall(r"\S+", text)


def clean_tok(t: str) -> str:
    return strip_accents(t.strip(".,!?;:»«\"'()[]…"))


def slot_expectation(left: str, right: str) -> tuple[str | None, str | None, list[str]]:
    """Infer (gender, number) expected in the blank from local context."""
    cues: list[str] = []
    left_toks = tokenize(left)
    right_toks = tokenize(right)
    last = clean_tok(left_toks[-1]) if left_toks else ""
    first_right = clean_tok(right_toks[0]) if right_toks else ""

    if last in PL_ART:
        return "?", "pl", [f"pl_art:{last}"]

    gender = None
    number = "sg"

    if last in FEM_ART:
        gender, cues = "fem", [f"fem_art:{last}"]
    elif last in MASC_ART:
        gender, cues = "masc", [f"masc_art:{last}"]
    elif last in NEUT_ART or last == "στο":
        # στο + masc/neut accusative — weak; prefer noun on the right
        if first_right in MASC_NOUNS:
            return "masc", "sg", ["στο+masc_noun"]
        if first_right in NEUT_NOUNS:
            return "neut", "sg", ["στο+neut_noun"]
        if last == "στο":
            gender, cues = None, []
        else:
            gender, cues = "neut", [f"neut_art:{last}"]

    if first_right in FEM_NOUNS:
        return "fem", "sg", cues + ["fem_noun_right"]
    if first_right in MASC_NOUNS:
        return "masc", "sg", cues + (["masc_noun_right"] if "masc_noun_right" not in cues else [])
    if first_right in NEUT_NOUNS:
        return "neut", "sg", cues + ["neut_noun_right"]

    # Predicative: … είναι/ήταν ___ .
    if re.search(r"(?:είναι|ήταν|έμεινε|έμεινα|ένιωθε|ένιωθα|φαίνεται|φάνηκε|δήλωσε|έγινε|νιώθει)\s*$", left, re.I):
        # subject article earlier
        arts = re.findall(r"\b(η|ο|το|μια|μία|ένας|ένα|οι|τα)\s+(\S+)", left, flags=re.I)
        if arts:
            art, _noun = arts[-1]
            a = clean_tok(art)
            if a in FEM_ART or a in {"η", "μια", "μια"}:
                return "fem", "sg", cues + [f"pred_subj:{a}"]
            if a in {"ο", "ενασ"}:
                return "masc", "sg", cues + [f"pred_subj:{a}"]
            if a in {"το", "ενα"}:
                return "neut", "sg", cues + [f"pred_subj:{a}"]
            if a in PL_ART:
                return "?", "pl", cues + [f"pred_subj:{a}"]

    if gender:
        return gender, number, cues
    return None, None, cues


# Nouns in -ος that are feminine or neuter — article agreement is correct.
FEM_OS_NOUNS = {
    "κυπροσ",
    "αμμοσ",
    "οδοσ",
    "ηπειροσ",
    "διαμετροσ",
    "περιμετροσ",
    "νοσοσ",
    "νησοσ",
    "εξοδοσ",
    "εισοδοσ",
    "λεωφοροσ",
    "μεθοδοσ",
    "προοδοσ",
}
NEUT_OS_NOUNS = {
    "δασοσ",
    "πελαγοσ",
    "οροσ",
    "εδαφοσ",
    "κρατοσ",
    "μεγεθοσ",
    "μηκοσ",
    "πλατοσ",
    "βαθοσ",
    "υψοσ",
    "αεροσκαφοσ",
    "γεγονοσ",
    "βαροσ",
}


def classify_mismatch(word: str, entry: dict, eg: str, en: str) -> str | None:
    """Return issue code if lemma disagrees with expected slot."""
    g, n = lemma_shape(word)
    if g == "verb":
        return None
    ws = strip_accents(word)
    if ws in FEM_OS_NOUNS or ws in NEUT_OS_NOUNS:
        return None
    # Common -ος nouns used as predicates (not adjectives)
    if strip_accents(word) in {"καρποσ", "σταθμοσ", "αθλοσ", "αγροσ"}:
        return None
    # Predicate noun: «Το μήλο είναι καρπός» / «Η ανακάλυψη ήταν σταθμός»
    pos = (entry.get("pos") or "").lower()
    if pos in {"noun", "ουσιαστικό", "substantive"} and ws.endswith("οσ"):
        return None
    adj = is_adj(entry, word) or (
        ws.endswith("οσ") and pos in {"", "adj", "adjective", "επίθετο"}
    )

    if en == "pl" and n == "sg" and adj:
        return "singular_lemma_in_plural_slot"

    if not adj and not ws.endswith("οσ"):
        # nouns: cite form usually matches article if blank is the noun itself
        if eg == "fem" and g == "masc" and ws.endswith("οσ"):
            return "masc_noun_in_fem_slot"
        return None

    # Adjectives cited in -ος
    if eg == "fem" and en == "sg" and ws.endswith("οσ"):
        return "masc_-ος_lemma_in_fem_slot"
    if eg == "neut" and en == "sg" and ws.endswith("οσ"):
        return "masc_-ος_lemma_in_neut_slot"
    if eg == "masc" and en == "sg" and ws.endswith("οσ"):
        return None  # OK
    if eg == "fem" and en == "sg" and ws.endswith("ο") and adj:
        return "neut_-ο_lemma_in_fem_slot"
    return None


# Suggested replacement hints (lemma-agreeing) for high-frequency patterns.
FIX_HINTS: dict[str, str] = {
    # Will be filled from audit + curated fixes for high-confidence items.
}


def suggest_hint(word: str, issue: str) -> str | None:
    w = nfc(word)
    if issue == "masc_-ος_lemma_in_fem_slot":
        return f"Ο ___ χαρακτήρας φάνηκε καθαρά." if w.endswith("ος") or w.endswith("ός") else None
    if issue == "masc_-ος_lemma_in_neut_slot":
        return f"Το ___ παιδί χαμογέλασε."
    if issue == "singular_lemma_in_plural_slot":
        return f"Ο ___ μαθητής προσπαθεί."
    return None


def main() -> None:
    payload = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
    words = payload["words"]
    issues: list[dict] = []
    by_code: Counter[str] = Counter()

    for entry in words:
        word = entry.get("word") or ""
        hint = entry.get("hintSentence") or ""
        if BLANK not in hint:
            continue
        parts = hint.split(BLANK)
        if len(parts) != 2:
            issues.append(
                {
                    "id": entry.get("id"),
                    "word": word,
                    "grade": entry.get("grade"),
                    "hint": hint,
                    "issue": "bad_blank_count",
                    "severity": "high",
                }
            )
            by_code["bad_blank_count"] += 1
            continue

        left, right = parts
        eg, en, cues = slot_expectation(left, right)
        if not eg and not en:
            continue
        if eg is None:
            continue

        code = classify_mismatch(word, entry, eg, en or "sg")
        if not code:
            continue

        severity = "high" if code.startswith("masc_-ος") else "medium"
        issues.append(
            {
                "id": entry.get("id"),
                "word": word,
                "grade": entry.get("grade"),
                "pos": entry.get("pos"),
                "hint": hint,
                "issue": code,
                "expected": {"gender": eg, "number": en},
                "cues": cues,
                "severity": severity,
                "suggestedHint": suggest_hint(word, code),
            }
        )
        by_code[code] += 1

    # Prefer high severity first
    issues.sort(key=lambda x: (0 if x["severity"] == "high" else 1, x["grade"] or 99, x["word"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "total_words": len(words),
        "issue_count": len(issues),
        "by_issue": dict(by_code),
        "high": [i for i in issues if i["severity"] == "high"],
        "medium": [i for i in issues if i["severity"] == "medium"],
        "all": issues,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Issues: {len(issues)}")
    for k, v in by_code.most_common():
        print(f"  {k}: {v}")
    print("\n--- HIGH (first 40) ---")
    for i in report["high"][:40]:
        print(f"{i['id']}\t{i['word']}\t{i['hint']}\t[{','.join(i['cues'])}]")


if __name__ == "__main__":
    main()
