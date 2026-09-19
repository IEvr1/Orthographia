#!/usr/bin/env python3
"""Review and fix Greek spelling, grammar, and content quality in words.json."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from contextual_hint import generate_contextual_hint, is_garbled_hint
from hint_generator import guess_morphemes, load_overrides, get_override
from import_helexkids import WEB_WORDS, write_words
from spelling_fixes import fix_words_list, load_spelling_fixes

PIPELINE = Path(__file__).resolve().parent
WEB = PIPELINE.parent / "web" / "public" / "content"
RULES_FILE = WEB / "rules.json"
FAMILIES_FILE = WEB / "families.json"
FIXES_FILE = PIPELINE / "inputs" / "lexika" / "word_spelling_fixes.json"
WORD_LISTS = PIPELINE / "word_lists.py"

# Extra OCR headword fixes (beyond word_spelling_fixes.json)
EXTRA_SPELLING_FIXES: dict[str, str] = {
    "γράµµα": "γράμμα",
    "πονηρίς": "πονηρός",
    "γνωστίς": "γνωστός",
    "γεωργίς": "γεωργός",
    "κενίς": "κενός",
    "δυνατίς": "δυνατός",
    "λεπτίς": "λεπτός",
    "ινητίς": "αίλημα",
    "αιλητισμίς": "αισιοδοξία",
    "ακριβίς": "ακριβής",
    "φτηνίς": "φθηνός",
    "κλειστίς": "κλειστός",
    "υποφερτίς": "υπομονετικός",
    "ομαλίς": "ομαλός",
    "ικανίς": "ικανός",
    "ορατίς": "ορατός",
    "σκληρίς": "σκληρός",
    "αποψινίς": "αποψινά",
    "νωρίς": "νωρί",
    "δεξιίς": "δεξιός",
    "αχνίς": "αχνός",
    "τυχερίς": "τυχερός",
    "ερχομίς": "αφίσα",
    "ατμίς": "ατμός",
    "χλωμίς": "χλωμός",
    "ρηχίς": "ρηχός",
    "ζεστίς": "ζεστός",
    "σοβαρίς": "σοβαρός",
    "βοσκίς": "βιταμίνη",
    "βραχνίς": "βραχύς",
    "νοικοκύρη": "νοικοκύρης",
}

HINT_OVERRIDES: dict[str, str] = {
    "νύχτα": "Όταν πέφτει η ___, πάω για ύπνο.",
    "βράδυ": "Το ___ βλέπουμε τηλεόραση.",
    "αίλημα": "Το πουλί έφαγε ___ στο κλουβί.",
    "αφίσα": "Κόλλησα μια ___ στην πόρτα του σχολείου.",
    "αργία": "Η ___ δεν βοηθά στη μελέτη.",
    "βιταμίνη": "Τρώω φρούτα για ___.",
    "αισιοδοξία": "Έχει πάντα ___ για το μέλλον.",
    "φθηνός": "Αυτό το βιβλίο είναι ___.",
    "αποψινά": "Θα το κάνουμε ___.",
    "νωρί": "Ξύπνησα ___ το πρωί.",
    "παράθυρο": "Άνοιξε το ___ για φρέσκο αέρα.",
    "τιμή": "Η ___ του βιβλίου ήταν χαμηλή.",
    "αξίζω": "___ να προσπαθήσω περισσότερο.",
    "ίχνος": "Βρήκαμε ___ ζώου στο χιόνι.",
    "νοικοκύρης": "Ο ___ μας είναι ευγενικός.",
    "ακριβής": "Αυτό το παιχνίδι είναι πολύ ___.",
}

TRUNCATED_HINT = re.compile(
    r"(=\s*___$|«\s*___$|\(\s*___$|:\s*___$|___\s*$.*[^.?!;»\"']$)",
)
GARBLED_HINT_MARKERS = re.compile(
    r"(ƒ|Άημήτρη|Άγνωστο κείμενο|Κλητική —|ποιητή ___|απορρήτων \(=|"
    r"εκλογικού δικαιώματος \(=|αλλοδαπή \(=|Λίστα αναμονής \(=|"
    r"Απιστία υπαλλήλου \(=|Αστέρι της Αυγής \(=|αποτυπώματα της|"
    r"δλλάδα|βαιύ|ψηλί|___την|νοικοκύρη[^ς])",
    re.I,
)
GARBLED_DEFINITION = re.compile(
    r"(-•ένη|ούτε στον ενικί|απίφαση|γι' αυτί|ουσιαστικί\(|"
    r"άιλημα \[|βίτανο \[|Άεν )",
    re.I,
)

HOMONYMS_BODY = (
    "Ομώνυμα: ίδια γραφή, διαφορετική σημασία (π.χ. φράση, κλειδί). "
    "Παρώνυμα: διαφορετικές λέξεις, ίδια σημασία (π.χ. σπίτι, σπιτικό)."
)


def normalize_micro_mu(text: str) -> str:
    return text.replace("\u00b5", "\u03bc")


def is_bad_hint(hint: str) -> bool:
    if not hint or hint.count("___") != 1:
        return True
    if is_garbled_hint(hint):
        return True
    if GARBLED_HINT_MARKERS.search(hint):
        return True
    if TRUNCATED_HINT.search(hint.rstrip()):
        return True
    # Sentence ends mid-clause (no terminal punctuation)
    stripped = hint.strip()
    if not re.search(r"[.?!;»]$", stripped):
        return True
    return False


def clean_definition(defn: str) -> str:
    if not defn:
        return defn
    if GARBLED_DEFINITION.search(defn):
        return ""
    return normalize_micro_mu(defn.strip())


def resolve_hint(entry: dict, overrides: dict, index: int) -> str:
    word = entry["word"]
    if word in HINT_OVERRIDES:
        return HINT_OVERRIDES[word]

    override = get_override(word, overrides)
    if override and override.get("hint"):
        return str(override["hint"])

    pos = entry.get("pos", "")
    return generate_contextual_hint(word, pos=pos, index=index)


def merge_spelling_fixes() -> dict[str, str]:
    fixes = load_spelling_fixes()
    merged = dict(fixes)
    merged.update(EXTRA_SPELLING_FIXES)
    return merged


def fix_rules() -> bool:
    if not RULES_FILE.exists():
        return False
    data = json.loads(RULES_FILE.read_text(encoding="utf-8"))
    changed = False
    for rule in data.get("rules", []):
        if rule.get("id") == "homonyms" and rule.get("body") != HOMONYMS_BODY:
            rule["body"] = HOMONYMS_BODY
            changed = True
    if changed:
        RULES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


def fix_families(old_word: str, new_word: str) -> bool:
    if not FAMILIES_FILE.exists() or old_word == new_word:
        return False
    text = FAMILIES_FILE.read_text(encoding="utf-8")
    if old_word not in text:
        return False
    updated = text.replace(f'"{old_word}"', f'"{new_word}"')
    if updated != text:
        FAMILIES_FILE.write_text(updated, encoding="utf-8")
        return True
    return False


def fix_word_lists_nychta() -> bool:
    if not WORD_LISTS.exists():
        return False
    text = WORD_LISTS.read_text(encoding="utf-8")
    old = '"Το βράδυ κοιμάμαι τη ___.", "Νύχτ- + -α."'
    new = '"Όταν πέφτει η ___, πάω για ύπνο.", "Νύχτ- + -α."'
    if old not in text:
        return False
    WORD_LISTS.write_text(text.replace(old, new), encoding="utf-8")
    return True


def persist_spelling_fixes(merged: dict[str, str]) -> None:
    data = json.loads(FIXES_FILE.read_text(encoding="utf-8"))
    data["fixes"] = {**data.get("fixes", {}), **EXTRA_SPELLING_FIXES}
    FIXES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_review() -> dict[str, int]:
    merged_fixes = merge_spelling_fixes()
    persist_spelling_fixes(merged_fixes)

    payload = json.loads(WEB_WORDS.read_text(encoding="utf-8"))
    words = payload["words"]
    overrides = load_overrides()

    stats = {
        "words_total": len(words),
        "spelling_fixed": 0,
        "hints_fixed": 0,
        "definitions_cleaned": 0,
        "rules_fixed": 0,
        "families_fixed": 0,
        "word_lists_fixed": 0,
    }

    renamed: list[tuple[str, str]] = []
    words, spelling_changes = fix_words_list(words, merged_fixes)
    stats["spelling_fixed"] = spelling_changes

    updated: list[dict] = []
    for index, entry in enumerate(words):
        new_entry = dict(entry)
        old_word = entry.get("word", "")
        new_word = new_entry.get("word", old_word)
        if old_word != new_word:
            renamed.append((old_word, new_word))

        old_hint = entry.get("hintSentence", "")
        if is_bad_hint(old_hint):
            new_hint = resolve_hint(new_entry, overrides, index)
            if new_hint != old_hint:
                new_entry["hintSentence"] = new_hint
                stats["hints_fixed"] += 1

        old_def = entry.get("definition", "")
        new_def = clean_definition(old_def or "")
        if new_def != old_def:
            if new_def:
                new_entry["definition"] = new_def
            elif "definition" in new_entry:
                del new_entry["definition"]
            stats["definitions_cleaned"] += 1

        updated.append(new_entry)

    payload["words"] = updated
    write_words(updated)

    if fix_rules():
        stats["rules_fixed"] = 1

    for old, new in renamed:
        if fix_families(old, new):
            stats["families_fixed"] += 1

    # Legacy micro-sign family key
    if fix_families("γράµµα", "γράμμα"):
        stats["families_fixed"] += 1

    if fix_word_lists_nychta():
        stats["word_lists_fixed"] = 1

    # Sync rules snippet in content-pipeline inputs
    snippet = PIPELINE / "inputs" / "lexika" / "rules_snippets.json"
    if snippet.exists():
        data = json.loads(snippet.read_text(encoding="utf-8"))
        for item in data.get("snippets", data if isinstance(data, list) else []):
            if isinstance(item, dict) and "ομώνυμα" in item.get("body", "").lower():
                item["body"] = HOMONYMS_BODY
        snippet.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return stats


def main() -> None:
    stats = apply_review()
    print("Greek content review applied:")
    for key, val in stats.items():
        print(f"  {key}: {val}")


if __name__ == "__main__":
    main()
