# -*- coding: utf-8 -*-
"""Clean PDF verb audit vs words.json."""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

PDF = Path(r"c:\AI_apps\Orthographia\_pdf_extract.txt")
WORDS = Path(r"c:\AI_apps\Orthographia\scripts\orthografia-app\web\public\content\words.json")
OUT = Path(r"c:\AI_apps\Orthographia\_missing_verbs.txt")
OUT_JSON = Path(r"c:\AI_apps\Orthographia\_missing_verbs.json")

GREEK = re.compile(r"[Α-Ωα-ωΆ-Ώά-ώϊΐϋΰΪΫ]+")

# Wrong orthography distractors (verbs + noun-ω misspellings that end in ω)
WRONG = {
    "ανεβένω", "κατεβένω", "πλαίνω", "ξεπλαίνω", "μαθένω", "ανασένω",
    "επιμαίνω", "ζεστένω", "περιμαίνω", "ξηρένω", "αρρωστένω", "σωπένω",
    "προλαβένω", "βγένω", "καταλαβένω", "πηδό", "αγοράζο", "βλέπο",
    "τρέχο", "τρένω", "διαβάζο", "βάφο", "πλένο", "δουλεύο", "δείχνο",
    "μιλό", "ροτάο", "περνάο", "χαλάο", "μιλάο", "αντιδράο", "ζητάο",
    "αγαπό", "γελό", "κρατό", "τρώο", "ζώω", "παίζο", "πέρνω", "πέρνει",
    "αθρείζω", "δανοίζω", "πρίζω", "δανίζω", "ποτοίζω", "χτενοίζω", "μυροίζω",
    "αθρίζω", "γυροίζω", "κερδύζω", "ξυροίζω", "σκαλύζω", "ψωνείζω", "σκουπύζω",
    "δακρίζω",
    # noun misspellings ending in ω
    "αεροπλάνω", "βουνώ", "δώρω", "έπιπλω", "θέατρω", "καρότω", "κινητώ",
    "κρύω", "μήλω", "μωρώ", "νερώ", "πακέτω", "πάπλω", "πρόβατω", "φαγητώ",
    "φάκελω", "ψυγείω", "παγωτώ",
}

# Not verbs / fragments / function words
EXCLUDE = {
    "εγώ", "εσύ", "αυτός", "αυτή", "αυτό", "εμείς", "εσείς", "αυτοί",
    "αίνω", "ένω", "ίζω", "εύω", "ώνω", "ποιώ", "πρω", "στρώ", "τρώ",
    "εδώ", "κάτω", "πάνω", "λίγο", "πολύ", "γύρω", "μέσω", "λόγω",
    "παρακάτω", "σαρανταοχτώ", "ευρώ", "γελοτω",
}

# Contracted verb pairs: PDF form ↔ app form
ALIASES = {
    "αγαπάω": "αγαπώ",
    "αγαπώ": "αγαπάω",
    "ρωτάω": "ρωτώ",
    "ρωτώ": "ρωτάω",
    "μιλάω": "μιλώ",
    "μιλώ": "μιλάω",
    "περνάω": "περνώ",
    "περνώ": "περνάω",
    "γελάω": "γελώ",
    "γελώ": "γελάω",
    "ζητάω": "ζητώ",
    "ζητώ": "ζητάω",
    "διψάω": "διψώ",
    "διψώ": "διψάω",
    "πεινάω": "πεινώ",
    "πεινώ": "πεινάω",
    "τραγουδάω": "τραγουδώ",
    "τραγουδώ": "τραγουδάω",
    "χτυπάω": "χτυπώ",
    "χτυπώ": "χτυπάω",
    "πηδάω": "πηδώ",
    "πηδώ": "πηδάω",
}


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s.strip())


def deaccent(s: str) -> str:
    s = nfc(s).lower()
    return s.translate(
        str.maketrans(
            "άέήίόύώΆΈΉΊΌΎΏϊΐϋΰΪΫ",
            "αεηιουωΑΕΗΙΟΥΩιιυυΙΥ",
        )
    )


DICT_VERB = re.compile(
    r"^[α-ωά-ώϊΐϋΰ]{3,}(ω|ώ|ομαι|ούμαι|άμαι|ιέμαι|έμαι)$",
    re.IGNORECASE,
)


def is_dict_verb(w: str) -> bool:
    w = nfc(w)
    low = w.lower()
    if low in WRONG or low in EXCLUDE or deaccent(low) in {deaccent(x) for x in EXCLUDE}:
        return False
    if not DICT_VERB.match(low):
        return False
    # reject if looks like adjective/adverb ending accidentally — keep simple
    return True


def load_app():
    words = json.loads(WORDS.read_text(encoding="utf-8"))["words"]
    exact = {w["word"].lower(): w for w in words}
    de = defaultdict(list)
    for w in words:
        de[deaccent(w["word"])].append(w)
    return words, exact, de


def in_app(form: str, exact, de) -> list[str]:
    """Return matching app word(s) if present (exact, deaccent, or alias)."""
    low = form.lower()
    hits = []
    if low in exact:
        hits.append(exact[low]["word"])
    d = deaccent(form)
    for w in de.get(d, []):
        if w["word"] not in hits:
            hits.append(w["word"])
    alias = ALIASES.get(low)
    if alias:
        if alias.lower() in exact:
            hits.append(exact[alias.lower()]["word"])
        for w in de.get(deaccent(alias), []):
            if w["word"] not in hits:
                hits.append(w["word"])
    return hits


def extract_pdf_verbs(text: str) -> set[str]:
    found: set[str] = set()

    # 1) Complete tokens that are dictionary verbs
    for tok in GREEK.findall(text):
        if is_dict_verb(tok) and tok.lower() not in WRONG:
            found.add(nfc(tok).lower())

    # 2) Slash pairs: keep non-WRONG side if verb
    for line in text.splitlines():
        if "/" not in line:
            continue
        parts = [p.strip() for p in re.split(r"\s*/\s*", line)]
        toks = []
        for p in parts:
            g = GREEK.findall(p)
            if len(g) == 1:
                toks.append(g[0])
            elif len(g) >= 2:
                toks.append(g[-1])
        if len(toks) == 2:
            a, b = toks[0].lower(), toks[1].lower()
            for cand, other in ((a, b), (b, a)):
                if cand in WRONG:
                    continue
                if other in WRONG and is_dict_verb(cand):
                    found.add(nfc(cand).lower())
                elif is_dict_verb(cand):
                    found.add(nfc(cand).lower())

    # 3) Curated answers for fill-in verb exercises (from PDF contexts)
    curated = """
    ανεβαίνω κατεβαίνω μαθαίνω ζεσταίνω αρρωσταίνω βγαίνω υφαίνω πλαταίνω
    ξεραίνω ανασαίνω πιπεραίνω σωπαίνω προλαβαίνω καταλαβαίνω περιμένω μένω δένω πλένω ξερνώ
    αγοράζω διαβάζω γράφω τρέχω παίζω τρώω πίνω βλέπω θέλω λέω κάνω έχω είμαι πηγαίνω έρχομαι
    δουλεύω δείχνω μιλώ μιλάω ρωτάω περνάω χαλάω αντιδράω ζητάω αγαπώ αγαπάω γελώ κρατώ
    βοηθώ απαντώ απλώνω ανθίζω γυρίζω δαγκώνω δίνω βάφω βιδώνω καθαρίζω μαγειρεύω σκουπίζω
    χτενίζω μυρίζω κερδίζω αθροίζω δακρύζω γνωρίζω αρχίζω ψηφίζω ζωγραφίζω χαρίζω δανείζω
    ποτίζω ξυρίζω σκαλίζω ψωνίζω χαιρετώ ασχολούμαι φροντίζω σταματώ θεωρώ κατηγορώ τολμώ
    προτιμώ διηγούμαι πατώ στερούμαι περιποιούμαι χτυπώ πουλώ κελαηδώ συζητώ αποφασίζω
    κολυμπώ χειροκροτώ ζυγίζω πηδώ κυλώ ναυαγώ κρατιέμαι κατάγομαι ντύνομαι σηκώνομαι
    κοιμάμαι ξεκουράζομαι γίνομαι λυπάμαι σκέφτομαι θυμάμαι χαίρομαι χρειάζομαι κουράζομαι
    κάθομαι γράφομαι πλένομαι βρίσκω πληρώνω φεύγω ακούω συμφωνώ σκεπάζω δροσίζομαι κρύβομαι
    προσέχω πέφτω ζαλίζομαι βιάζομαι χρησιμοποιώ πολτοποιώ διαφοροποιώ ικανοποιώ γελοιοποιώ
    τελειοποιώ κακοποιώ προσωποποιώ μεγαλοποιώ ανοίγω ρίχνω κλείνω ανάβω σβήνω λύνω κόβω
    διψάω πεινάω τραγουδάω κλαίω παίρνω φέρνω γυρνώ αποτελώ επωφελούμαι ωφελώ αμφιβάλλω
    καταβάλλω υπερβάλλω υποβάλλω επιβάλλω βάλλω λαμβάνω μετέχω μπορώ ισχύω φοιτώ μορφώνομαι
    λογίζομαι πείθω θυμίζω αναζητώ τρελαίνομαι ψάχνω φτιάχνω φτιάχνομαι ψήνομαι κερνάω
    συνειδητοποιώ προσποιούμαι νομίζω βρίσκομαι σκεπάζομαι σκουπίζομαι
    χορταίνω ζηλεύω γλιστρώ κλέβω σέρνω τρίβω διαλέγω επιμένω απαντώ
    """.split()
    for v in curated:
        if is_dict_verb(v):
            found.add(v.lower())

    return found


def main():
    text = PDF.read_text(encoding="utf-8")
    _, exact, de = load_app()
    pdf_verbs = extract_pdf_verbs(text)

    present = []
    missing = []
    via_alias = []

    for v in sorted(pdf_verbs, key=deaccent):
        hits = in_app(v, exact, de)
        if hits:
            if any(deaccent(h) != deaccent(v) for h in hits):
                via_alias.append({"pdf": v, "app": hits})
            present.append({"pdf": v, "app": hits})
        else:
            missing.append(v)

    # Dedupe missing display with preferred accented form from PDF tokens
    missing_sorted = sorted(set(missing), key=deaccent)

    lines = []
    lines.append(f"Ρήματα (λ.τ./λεξικό) στο PDF: {len(pdf_verbs)}")
    lines.append(f"Υπάρχουν στο app: {len(present)}")
    lines.append(f"  από αυτά via alias (π.χ. αγαπώ/αγαπάω): {len(via_alias)}")
    lines.append(f"ΛΕΙΠΟΥΝ: {len(missing_sorted)}")
    lines.append("")
    lines.append("=== ΛΕΙΠΟΥΝ ===")
    for w in missing_sorted:
        lines.append(w)
    lines.append("")
    lines.append("=== ΥΠΑΡΧΟΥΝ (δείγμα) ===")
    for x in present[:30]:
        lines.append(f"{x['pdf']} → {', '.join(x['app'])}")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    OUT_JSON.write_text(
        json.dumps(
            {
                "pdf_count": len(pdf_verbs),
                "present_count": len(present),
                "missing_count": len(missing_sorted),
                "missing": missing_sorted,
                "present": present,
                "via_alias": via_alias,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("\n".join(lines))


if __name__ == "__main__":
    main()
