# -*- coding: utf-8 -*-
"""Build mathima-orthografias lemma CSVs by grade and raise lexika caps."""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"c:\AI_apps\Orthographia")
MISSING_TXT = ROOT / "_missing_words.txt"
WORDS_JSON = ROOT / "scripts" / "orthografia-app" / "web" / "public" / "content" / "words.json"
LEXIKA = ROOT / "scripts" / "orthografia-app" / "content-pipeline" / "inputs" / "lexika"
IMPORT_LEXIKA = (
    ROOT / "scripts" / "orthografia-app" / "content-pipeline" / "import_lexika.py"
)

VOWELS = set("αεηιουωάέήίόύώϊϋΐΰ")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s.strip())


def deaccent(s: str) -> str:
    s = nfc(s)
    return s.translate(
        str.maketrans("άέήίόύώΆΈΉΊΌΎΏϊΐϋΰΪΫ", "αεηιουωΑΕΗΙΟΥΩιιυυΙΥ")
    ).lower()


def syllables(w: str) -> int:
    return sum(1 for c in w.lower() if c in VOWELS)


def load_missing() -> list[str]:
    words: list[str] = []
    section = None
    for line in MISSING_TXT.read_text(encoding="utf-8").splitlines():
        if line.startswith("# Λείπουν τελείως"):
            section = "new"
            continue
        if line.startswith("# Λείπουν αλλά"):
            section = "rel"
            continue
        if not line.strip() or line.startswith("#") or line.startswith("="):
            continue
        if line.startswith(
            (
                "ΣΥΓΚΡ",
                "Λέξεις",
                "Μοναδ",
                "Υπάρχ",
                "ΛΕΙΠ",
                "  ·",
                "Κριτήρια",
                "ασκήσεων",
                "κενά",
            )
        ):
            continue
        if section:
            words.append(nfc(line))
    # unique preserve order
    seen: set[str] = set()
    out = []
    for w in words:
        k = w.lower()
        if k not in seen:
            seen.add(k)
            out.append(w)
    return out


# --- inflection filters ---
AORIST = {
    "ήρθα",
    "πήγα",
    "πήρα",
    "βγήκα",
    "βρήκα",
    "μπήκα",
    "ανέβηκα",
    "κατέβηκα",
    "είδα",
    "ήπια",
}

# 2nd/3rd person etc. — keep 1sg present as lemma
CONJ_ENDINGS = (
    "εις",
    "ει",
    "ουμε",
    "ετε",
    "ουν",
    "άει",
    "άτε",
    "άνε",
    "ούμε",
    "είτε",
    "ούν",
    "σαι",
    "ται",
    "μαστε",
    "στε",
    "νται",
    "όμαστε",
    "όσαστε",
    "ονται",
)

GENITIVE_LIKE = re.compile(
    r"(ων|μάτων|διών|σιών|τιών|αιών)$",
    re.I,
)

# Accusative masculine singular often without final ς
ACCUSATIVE_MASC = {
    "αρχηγό",
    "αναβάτη",
    "επιβάτη",
    "επιστάτη",
    "νικητή",
    "οδηγό",
    "πειρατή",
    "ποδηλάτη",
    "φωτογράφο",
    "υδραυλικό",
    "μισθό",
    "καρπό",
    "θησαυρό",
    "ταύρο",
    "φάκελο",
    "μπαμπά",  # voc/acc — lemma μπαμπάς rare; skip or keep as μπαμπάς
}

# Map accusative → nominative when clear
ACC_TO_NOM = {
    "αρχηγό": "αρχηγός",
    "αναβάτη": "αναβάτης",
    "επιβάτη": "επιβάτης",
    "επιστάτη": "επιστάτης",
    "νικητή": "νικητής",
    "οδηγό": "οδηγός",
    "πειρατή": "πειρατής",
    "ποδηλάτη": "ποδηλάτης",
    "φωτογράφο": "φωτογράφος",
    "υδραυλικό": "υδραυλικός",
    "μισθό": "μισθός",
    "καρπό": "καρπός",
    "θησαυρό": "θησαυρός",
    "ταύρο": "ταύρος",
    "φάκελο": "φάκελος",
    "μπαμπά": "μπαμπάς",
    "όρθιο": "όρθιος",
}

# Feminine genitive → nominative
GEN_TO_NOM = {
    "έκπληξης": "έκπληξη",
    "γέφυρας": "γέφυρα",
    "γιρλάντας": "γιρλάντα",
    "γυμναστικής": "γυμναστική",
    "εκδρομής": "εκδρομή",
    "ζήλιας": "ζήλια",
    "ημέρας": "ημέρα",
    "καταιγίδας": "καταιγίδα",
    "κλωστής": "κλωστή",
    "κόρης": "κόρη",
    "λάμπας": "λάμπα",
    "μπουκιάς": "μπουκιά",
    "ομπρέλας": "ομπρέλα",
    "πόρτας": "πόρτα",
    "πρότασης": "πρόταση",
    "σάλπιγγας": "σάλπιγγα",
    "σκάλας": "σκάλα",
    "σκηνής": "σκηνή",
    "τράπεζας": "τράπεζα",
    "φλούδας": "φλούδα",
    "αρκούδας": "αρκούδα",
    "αστραπής": "αστραπή",
    "γαλήνης": "γαλήνη",
    "αίθουσας": "αίθουσα",
    "δασκάλας": "δασκάλα",
}

# Plural → singular (confident only)
PL_TO_SG = {
    "αγάλματα": "άγαλμα",
    "αγελάδες": "αγελάδα",
    "αγοριών": None,  # genitive plural — drop
    "αυγά": "αυγό",
    "αυλές": "αυλή",
    "αχλαδιών": None,
    "βλάβες": "βλάβη",
    "βοσκοί": "βοσκός",
    "βουτιές": "βουτιά",
    "βράχοι": "βράχος",
    "βραβεία": "βραβείο",
    "γιορτές": "γιορτή",
    "γιρλάντες": "γιρλάντα",
    "διακοπές": "διακοπή",
    "δρόμοι": "δρόμος",
    "εκθέσεων": None,
    "επιταγών": None,
    "εποχές": "εποχή",
    "ζώνες": "ζώνη",
    "καρποί": "καρπός",
    "καρτέλες": "καρτέλα",
    "κιβώτια": "κιβώτιο",
    "κοπέλες": "κοπέλα",
    "κορυφές": "κορυφή",
    "λάμπες": "λάμπα",
    "λάσπες": "λάσπη",
    "λαγοί": "λαγός",
    "λαμπάδες": "λαμπάδα",
    "λαχανικά": "λαχανικό",
    "λεφτά": "λεφτά",  # pluralia tantum — keep as-is
    "λουκουμάδες": "λουκουμάς",
    "μάχες": "μάχη",
    "μελανιές": "μελανιά",
    "μηχανές": "μηχανή",
    "μωρά": "μωρό",
    "νησιών": None,
    "οδηγοί": "οδηγός",
    "όροι": "όρος",
    "παγωτά": "παγωτό",
    "παράθυρα": "παράθυρο",
    "πέτρες": "πέτρα",
    "πίθηκοι": "πίθηκος",
    "πινακίδων": None,
    "πλατείες": "πλατεία",
    "ποδιών": None,
    "ποντικοί": "ποντικός",
    "προσευχές": "προσευχή",
    "πρωινών": None,
    "πρόεδροι": "πρόεδρος",
    "πόρτες": "πόρτα",
    "πύργοι": "πύργος",
    "σαλάτες": "σαλάτα",
    "σαύρες": "σαύρα",
    "σεισμοί": "σεισμός",
    "σκούπες": "σκούπα",
    "σκυλιά": "σκυλί",
    "σταγόνες": "σταγόνα",
    "στιγμές": "στιγμή",
    "ταραχές": "ταραχή",
    "ταχυτήτων": None,
    "ταινιών": None,
    "τέχνες": "τέχνη",
    "φίλες": "φίλη",
    "φακές": "φακή",
    "φορεσιές": "φορεσιά",
    "φυλακές": "φυλακή",
    "φωνές": "φωνή",
    "φωτεινοί": "φωτεινός",
    "χέρια": "χέρι",
    "χαρές": "χαρά",
    "χοροί": "χορός",
    "χώρες": "χώρα",
    "ψυχές": "ψυχή",
    "αριθμοί": "αριθμός",
    "αυτοκινήτων": None,
    "γιατρών": None,
    "γεωργών": None,
    "γραμμάτων": None,
    "γράμματα": "γράμμα",
    "δασκάλες": "δασκάλα",
    "ζωγραφιές": "ζωγραφιά",
    "θάλασσες": "θάλασσα",
    "κάτοικοι": "κάτοικος",
    "λεωφορείων": None,
    "περιοχές": "περιοχή",
    "κήπων": None,
    "φούρνων": None,
    "θεών": None,
    "μαχαιριών": None,
}


def is_conjugated(w: str) -> bool:
    low = w.lower()
    if low in AORIST:
        return True
    # 1sg present mediopassive is a valid lemma: κάθομαι, γίνομαι
    if low.endswith(("ομαι", "άμαι", "ιέμαι", "ούμαι")):
        return False
    if low.endswith(("ω", "ώ", "άω")):
        return False
    for end in CONJ_ENDINGS:
        if low.endswith(end) and syllables(w) >= 2:
            # exclude adjectives/nouns ending εις (δυσκίνητος no)
            if end == "εις" and not any(
                low.endswith(v + "εις")
                for v in ("αίν", "έν", "ίζ", "εύ", "ών", "άν", "ύν", "ήν", "ό")
            ):
                # πηγαίνεις, γράφεις, περιμένεις
                if low.endswith(
                    ("αίνεις", "ένεις", "ίζεις", "εύεις", "ώνεις", "άεις", "όεις")
                ) or low.endswith(("φεις", "βεις", "πεις", "δεις", "νεις", "μεις", "λεις", "ρεις", "σεις", "ξεις", "ψεις", "ζεις", "κεις", "γεις", "χεις", "θεις")):
                    return True
            elif end != "εις":
                return True
    return False


def normalize_to_lemma(w: str) -> str | None:
    """Return dictionary form or None to drop."""
    w = nfc(w)
    low = w.lower()

    if low in GEN_TO_NOM:
        return GEN_TO_NOM[low]
    if low in ACC_TO_NOM:
        return ACC_TO_NOM[low]
    if low in PL_TO_SG:
        mapped = PL_TO_SG[low]
        return mapped  # may be None → drop

    if low in AORIST or is_conjugated(w):
        return None

    # genitive plural only (not -ής/-ού nouns like μαθητής, μαϊμού)
    if GENITIVE_LIKE.search(low):
        return None

    # skip bare fragments
    if len(w) < 3:
        return None

    return w


def guess_pos(w: str) -> str:
    low = w.lower()
    if low.endswith(("ομαι", "άμαι", "ιέμαι", "ούμαι", "ω", "ώ", "άω")):
        return "verb"
    if low.endswith(("ος", "η", "ο", "ύς", "ιά", "ικός", "ική", "ικό")) and syllables(w) >= 2:
        # could be adj or noun — adj heuristic
        if low.endswith(("ικός", "ική", "ικό", "ινος", "ινη", "ινο", "μένος", "μένη", "μένο")):
            return "adj"
        if low.endswith(("ος", "η", "ο")) and any(
            x in low for x in ("ικ", "ιν", "αν", "ηρ", "υρ", "φτ", "χτ", "στ", "γκ")
        ):
            # weak — default noun for common -ος
            pass
    if low.endswith(("ος", "η", "ο", "α", "ι", "υ", "ας", "ης", "ους", "ον", "μα", "ση", "ξη", "ψη", "ιά", "εια", "οί", "είς")):
        if low.endswith(("ω", "ώ", "άω", "ομαι")):
            return "verb"
        return "noun"
    return "noun"


def assign_grade(w: str, pos: str) -> int:
    low = w.lower()
    syll = syllables(w)

    specialty = (
        "πώλης",
        "ουργ",
        "γεωμετρ",
        "γεωπόν",
        "αΰπν",
        "διαγών",
        "ενενηκ",
        "θεραπεία",
        "κυκλοφορ",
        "ενέργεια",
        "πολυκατοικ",
        "ελικόπτ",
        "περιστατικ",
        "κασετόφων",
    )
    if any(x in low for x in specialty):
        return 5

    # diaeresis / digraph hard
    if any(c in w for c in "ϊΐϋΰΪΫ"):
        return 3 if syll <= 3 else 4

    if pos == "verb":
        if low.endswith(("αίνω", "ένομαι")) or syll >= 4:
            return 3 if syll <= 4 else 4
        if syll <= 3:
            return 2
        return 3

    # adjectives with -ικος etc.
    if pos == "adj" or low.endswith(("ικός", "ική", "ικός", "ινος", "ηρός", "ηρή")):
        if syll <= 3:
            return 3
        return 4

    # nouns
    if syll <= 2 or (syll == 3 and len(w) <= 7):
        return 2
    if syll == 3 or (syll == 4 and len(w) <= 9):
        return 3
    if syll <= 5:
        return 4
    return 5


def difficulty_for(w: str, grade: int) -> int:
    if grade >= 5 or len(w) >= 10:
        return 3 if len(w) >= 10 else 2
    if len(w) >= 8:
        return 2
    return 1


def make_hint(w: str, pos: str) -> str:
    """Minimal cloze; pipeline will improve if needed."""
    if pos == "verb":
        return f"Στην πρόταση γράφουμε το ρήμα ___."
    if pos == "adj":
        return f"Συμπληρώνουμε με το επίθετο ___."
    return f"Συμπληρώνουμε με τη λέξη ___."


def main() -> None:
    missing = load_missing()
    app = json.loads(WORDS_JSON.read_text(encoding="utf-8"))["words"]
    existing = {(deaccent(w["word"]), w["grade"]) for w in app}
    existing_any = {deaccent(w["word"]) for w in app}

    lemmas: dict[str, str] = {}  # lower -> display
    dropped: list[tuple[str, str]] = []

    for w in missing:
        lemma = normalize_to_lemma(w)
        if lemma is None:
            dropped.append((w, "inflected/drop"))
            continue
        lemma = nfc(lemma)
        key = lemma.lower()
        if key not in lemmas:
            lemmas[key] = lemma
        # if we mapped from variant, prefer longer/more complete form already stored

    # Also drop if already in app (any grade) — user asked to add missing;
    # if present in another grade, still add for target grade? Proposal was add missing.
    # Skip if exact form already in ANY grade to avoid clutter.
    rows_by_grade: dict[int, list[dict]] = defaultdict(list)
    skipped_exists = 0

    for key, word in sorted(lemmas.items(), key=lambda x: x[1].lower()):
        if deaccent(word) in existing_any:
            # already have this lemma somewhere — only add if we want cross-grade.
            # Skip: related-stem items like άσχημος when άσχημο exists should still add
            # if exact deaccented form matches existing word.
            exact_forms = {deaccent(w["word"]) for w in app}
            if deaccent(word) in exact_forms:
                # check exact accented match
                if word.lower() in {w["word"].lower() for w in app}:
                    skipped_exists += 1
                    continue
                # different accent or gender form (άσχημος vs άσχημο) — keep

        pos = guess_pos(word)
        grade = assign_grade(word, pos)
        # Don't add if (word, grade) already exists
        if (deaccent(word), grade) in existing:
            skipped_exists += 1
            continue

        rows_by_grade[grade].append(
            {
                "word": word,
                "grade": grade,
                "pos": pos,
                "hint": make_hint(word, pos),
                "definition": "",
                "family": "",
                "synonyms": "",
                "source": "mathima-orthografias",
                "difficulty": difficulty_for(word, grade),
            }
        )

    LEXIKA.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "word",
        "grade",
        "pos",
        "hint",
        "definition",
        "family",
        "synonyms",
        "source",
        "difficulty",
    ]

    total = 0
    for g in range(2, 6):
        path = LEXIKA / f"mathima_g{g}.csv"
        rows = rows_by_grade.get(g, [])
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        total += len(rows)
        print(f"G{g}: {len(rows)} -> {path.name}")

    # Raise caps in import_lexika.py
    text = IMPORT_LEXIKA.read_text(encoding="utf-8")
    old = "CAPS = {2: 180, 3: 180, 4: 100, 5: 100, 6: 200}"
    new = "CAPS = {2: 500, 3: 450, 4: 250, 5: 200, 6: 200}  # raised for mathima-orthografias"
    if old in text:
        IMPORT_LEXIKA.write_text(text.replace(old, new), encoding="utf-8")
        print("Raised CAPS in import_lexika.py")
    elif "mathima-orthografias" in text:
        print("CAPS already raised")
    else:
        print("WARNING: could not patch CAPS — check import_lexika.py")

    # Patch loader to include mathima_g*.csv
    load_snip = 'for path in sorted(input_dir.glob("grade*.csv")):'
    load_new = (
        'paths = sorted(input_dir.glob("grade*.csv")) + sorted(input_dir.glob("mathima_g*.csv"))\n'
        "    for path in paths:"
    )
    text2 = IMPORT_LEXIKA.read_text(encoding="utf-8")
    if 'mathima_g*.csv' not in text2:
        if load_snip in text2:
            IMPORT_LEXIKA.write_text(text2.replace(load_snip, load_new), encoding="utf-8")
            print("Patched load_lexika_rows to include mathima_g*.csv")
        else:
            print("WARNING: could not patch loader glob")
    else:
        print("Loader already includes mathima_g*.csv")

    report = {
        "input_missing": len(missing),
        "unique_lemmas": len(lemmas),
        "dropped": len(dropped),
        "skipped_already_in_app": skipped_exists,
        "to_import": total,
        "by_grade": {str(g): len(rows_by_grade.get(g, [])) for g in range(2, 6)},
        "dropped_sample": dropped[:40],
    }
    (ROOT / "_mathima_import_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
