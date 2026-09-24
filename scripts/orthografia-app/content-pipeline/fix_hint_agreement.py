#!/usr/bin/env python3
"""Fix cloze hints so the blank agrees with the cited lemma (dictionary form).

Learners type entry.word exactly. Predicative/attributive slots that require
feminine/neuter/plural inflection are rewritten to a masculine-singular frame.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
WEB_WORDS = PIPELINE.parent / "web" / "public" / "content" / "words.json"
OVERRIDES = PIPELINE / "inputs" / "hint_overrides.json"
LEXIKA = PIPELINE / "inputs" / "lexika"
REPORT = PIPELINE / "outputs" / "grammar_hint_fixes.json"

SKIP_WORDS = {
    # Feminine or neuter nouns in -ος / not adjectives
    "Κύπρος",
    "αεροσκάφος",
    "καρπός",
    "βάρος",
    "Χριστόφορος",
    "άθλος",
    "αγρός",
    "υδρατμός",
    "οδός",
    "διάμετρος",
    "περίμετρος",
    "σταθμός",
    "μέγεθος",
    "έξοδος",
    "γεγονός",
    "δάσος",
    "έδαφος",
}


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def strip(s: str) -> str:
    s = nfc(s).lower().replace("ς", "σ")
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


# High-quality lemma-agreeing hints (masc sg) keyed by word.
CURATED: dict[str, str] = {
    "άγευστος": "Ο χυμός ήταν ___ χωρίς ζάχαρη.",
    "άδικος": "Ο κανονισμός ήταν ___ για όλους.",
    "άκακος": "Ο σκύλος είναι ___ και ήσυχος.",
    "αήττητος": "Ο παίκτης έμεινε ___ όλη τη χρονιά.",
    "αναγκαίος": "Ο καθαρός αέρας είναι ___ για τη ζωή.",
    "ανοικοκύρευτος": "Ο διάδρομος ήταν ___.",
    "απείθαρχος": "Ο ___ μαθητής δεν καθόταν ήσυχα.",
    "αφόρητος": "Ο καύσωνας ήταν ___.",
    "γεμάτος": "Ο κουβάς είναι ___ νερό.",
    "δυνατός": "Ο αθλητής είναι ___ από την προπόνηση.",
    "καθιστός": "Ο παππούς είναι ___ στην καρέκλα.",
    "ξινός": "Ο χυμός λεμονιού είναι ___.",
    "ορατός": "Ο φάρος είναι ___ από μακριά.",
    "πρωινός": "Ο ___ περίπατος ξεκίνησε νωρίς.",
    "σκούρος": "Φόρεσε έναν ___ μπλε μανδύα.",
    "χοντρός": "Ο ___ φάκελος είναι βαρύς.",
    "ψεύτικος": "Ο ___ λίθος έλαμπε σαν αληθινός.",
    "άβολος": "Ο καναπές είναι ___ για πολλή ώρα.",
    "άγριος": "Ο ___ λύκος ζει στο δάσος.",
    "άσπρος": "Ο τοίχος είναι ___.",
    "αναπαυτικός": "Ο ___ καναπές είναι μαλακός.",
    "ανυπάκουος": "Ο ___ μαθητής δεν καθόταν ήσυχα.",
    "αρωματικός": "Ο ___ καφές μύριζε ωραία.",
    "γαλλικός": "Ο ___ πολιτισμός είναι γνωστός.",
    "δυσάρεστος": "Ήταν ένας ___ θόρυβος.",
    "δύσκολος": "Ο γρίφος είναι ___.",
    "εύκολος": "Ο γρίφος ήταν ___.",
    "λερωμένος": "Ο μανδύας είναι ___.",
    "μαύρος": "Ο ___ σκύλος σταμάτησε μπροστά.",
    "πέτρινος": "Ο πύργος είναι ___.",
    "σπουδαίος": "Έκανε έναν ___ άθλο.",
    "τεράστιος": "Ο βράχος ήταν ___.",
    "φωτεινός": "Ο διάδρομος είναι ___.",
    "χρήσιμος": "Ο οδηγός είναι ___.",
    "ακράδαντος": "Ο ___ πιστός δεν δίστασε.",
    "ακριβός": "Ο πίνακας είναι πολύ ___.",
    "υδραυλικός": "Ο ___ τεχνίτης διόρθωσε τη βρύση.",
    "άναυδος": "Ο κόσμος έμεινε ___ από την έκπληξη.",
    "άρτιος": "Παρουσίασε έναν ___ λόγο.",
    "ανέκφραστος": "Ο ___ ηθοποιός κοίταξε μπροστά.",
    "απόρρητος": "Ο φάκελος είναι ___.",
    "τηλεοπτικός": "Είδε έναν ___ διαγωνισμό για τη φύση.",
    "βιώσιμος": "Προτείνουν έναν ___ τρόπο ανάπτυξης.",
    "βρόμικος": "Ο δρόμος ήταν ___ από τη λάσπη.",
    "αποφασιστικός": "Ήταν ___ στη συνάντηση.",
    "ανθρώπινος": "Ο ___ χαρακτήρας φάνηκε καθαρά.",
    # Weak / placeholder sentences → real frames
    "Χριστόφορος": "Ο ___ ταξίδεψε σε μακρινούς τόπους.",
    "άθλος": "Ο ___ του Ηρακλή είναι γνωστός.",
    "αγρός": "Ο ___ είναι γεμάτος στάχυα.",
}


def fallback_masc_hint(word: str, issue: str) -> str:
    if issue.endswith("fem_slot"):
        return "Ο μαθητής είναι ___ σήμερα."
    if issue.endswith("neut_slot"):
        return "Ο δρόμος είναι ___."
    return "Ο ___ μαθητής προσπαθεί."


def load_overrides() -> dict:
    if not OVERRIDES.exists():
        return {"overrides": {}}
    data = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    if "overrides" not in data:
        data = {"overrides": data}
    return data


def update_csv(word: str, full_sentence: str) -> int:
    """Replace hint column for word in grade*.csv; return files touched."""
    touched = 0
    # full_sentence should contain the word (unblanked) for CSV source quality
    for path in LEXIKA.glob("grade*.csv"):
        rows = []
        changed = False
        with path.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            for row in reader:
                if row.get("word") == word and "hint" in row:
                    row["hint"] = full_sentence
                    changed = True
                rows.append(row)
        if changed and fieldnames:
            with path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            touched += 1
    return touched


def unblank(hint: str, word: str) -> str:
    return hint.replace("___", word, 1)


def main() -> None:
    payload = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
    words = payload["words"]
    by_word = {e["word"]: e for e in words}

    # Reuse previous audit if present
    audit_path = PIPELINE / "outputs" / "grammar_hint_audit.json"
    audit = json.loads(audit_path.read_text(encoding="utf-8")) if audit_path.exists() else {"all": []}

    overrides = load_overrides()
    ov = overrides.setdefault("overrides", {})

    fixed: list[dict] = []
    skipped: list[dict] = []

    targets: dict[str, str] = {}
    # From curated always
    targets.update(CURATED)

    # From audit high/medium adj-like
    for item in audit.get("all", []):
        w = item["word"]
        if w in SKIP_WORDS and w not in CURATED:
            # still fix garbage placeholders via curated if present
            skipped.append({"word": w, "reason": "skip_noun_or_proper", "hint": item["hint"]})
            continue
        if w in targets:
            continue
        if item["issue"] not in {
            "masc_-ος_lemma_in_fem_slot",
            "masc_-ος_lemma_in_neut_slot",
        }:
            continue
        # Only -ος adjectives / participles
        if not strip(w).endswith("οσ"):
            continue
        if w in SKIP_WORDS:
            continue
        targets[w] = fallback_masc_hint(w, item["issue"])

    changed_entries = 0
    csv_touches = 0

    for entry in words:
        w = entry["word"]
        if w not in targets:
            continue
        new_hint = targets[w]
        old = entry.get("hintSentence", "")
        if old == new_hint:
            continue
        entry["hintSentence"] = new_hint
        changed_entries += 1
        ov[w] = {"hint": new_hint}
        full = unblank(new_hint, w)
        csv_touches += update_csv(w, full)
        fixed.append({"id": entry.get("id"), "word": w, "old": old, "new": new_hint})

    WEB_WORDS.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OVERRIDES.write_text(
        json.dumps(overrides, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        json.dumps(
            {
                "fixed_count": len(fixed),
                "changed_entries": changed_entries,
                "csv_row_files_touched_ops": csv_touches,
                "fixed": fixed,
                "skipped": skipped,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Fixed {len(fixed)} hints in words.json")
    print(f"Overrides: {OVERRIDES}")
    print(f"Report: {REPORT}")
    for f in fixed[:25]:
        print(f"  {f['word']}: {f['old']}  =>  {f['new']}")
    if len(fixed) > 25:
        print(f"  ... +{len(fixed)-25} more")


if __name__ == "__main__":
    main()
