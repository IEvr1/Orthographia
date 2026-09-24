# -*- coding: utf-8 -*-
"""
Extract correctly-spelled exercise target words from the spelling PDF
and compare with Orthographia words.json.
"""
import json
import re
import sys
import unicodedata
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

APP_PATH = r"c:\AI_apps\Orthographia\scripts\orthografia-app\web\public\content\words.json"
PDF_PATH = r"c:\AI_apps\Orthographia\_pdf_extract.txt"
OUT_JSON = r"c:\AI_apps\Orthographia\_compare_result.json"
OUT_MISSING = r"c:\AI_apps\Orthographia\_missing_words.txt"
OUT_SUMMARY = r"c:\AI_apps\Orthographia\_compare_summary.txt"

GREEK = re.compile(r"[Α-Ωα-ωΆ-Ώά-ώϊΐϋΰΪΫ]+")
ARTICLE = {
    "ο", "η", "το", "οι", "τα", "τον", "των", "της", "τις", "την", "τη",
    "ένας", "μια", "ένα",
}
EGO = {"εγώ", "εσύ", "αυτός", "αυτή", "αυτό", "εμείς", "εσείς", "αυτοί"}

META = {
    "μάθημα", "ορθογραφίας", "ορθογραφία", "ημ", "νία", "όνομα", "σελίδες",
    "συνδυαστικό", "υλικό", "task", "box", "κάρτες", "βοηθήματα", "μικρά",
    "εκπαιδευτικές", "γλωσσική", "καλλιέργεια", "τεύχος", "καταλήξεις",
    "κατάληξη", "άρθρα", "άρθρο", "ουσιαστικά", "ουσιαστικό", "ρήματα",
    "ρήμα", "επίθετα", "επίθετο", "συμπλήρωσε", "κύκλωσε", "διάβασε",
    "γράψε", "τόνισε", "σωστό", "λάθος", "σωστή", "παρακάτω", "λέξεις",
    "λέξη", "ασκήσεις", "άσκηση", "εξάσκηση", "φωνής", "ενεργητικής",
    "παθητικού", "αορίστου", "μετοχές", "προστακτική", "οριστική",
    "σχήμα", "isbn", "copyright", "ebook", "πληροφορίες", "ιστοσελίδα",
    "τηλέφωνο", "επικοινωνίας", "διάθεση", "έκδοση", "συγγραφή",
    "σελιδοποίηση", "εικονογράφηση", "μακέτα", "εξωφύλλου",
    "γραμματική", "θέμα", "νόημα", "γένος", "αριθμό", "δομή", "γλώσσας",
    "κύρια", "κοινά", "στήλη", "κουτάκι", "κενά", "δίψηφα", "φωνήεντα",
}

# Intentional misspellings / distractors that appear in this workbook
WRONG = {
    "ανεβένω", "κατεβένω", "πλαίνω", "ξεπλαίνω", "μαθένω", "ανασένω",
    "επιμαίνω", "ζεστένω", "περιμαίνω", "ξηρένω", "αρρωστένω", "σωπένω",
    "προλαβένω", "βγένω", "καταλαβένω", "μαίνει", "ανεβένεις",
    "βράδι", "δάκρι", "τυρύ", "σκοινύ", "στάχι", "αλάτυ", "βαγόνυ",
    "παιχνίδυ", "χαλύ", "μήλω", "βάφο", "πρόβατω", "καρότω", "πλένο",
    "αεροπλάνω", "κουτύ", "χιόνυ", "οξί", "αστέρυ", "χελιδόνυ", "εγγόνυ",
    "κεφάλυ", "δόρι", "κερύ", "πουλύ", "τρέχο", "τρένω", "διαβάζο",
    "έπιπλω", "ψυγείω", "ανεβαίνο", "παιδύ", "δίχτι", "χέρυ", "μολύβυ",
    "ψάρυ", "αλεύρυ", "αγόρυ", "λάδυ", "ψωμύ", "χαλι",
    "χάρτηνος", "διάσιμος", "άσχιμος", "πλούσηος", "άγρηος", "περίφιμος",
    "επίσιμος", "τεράστειος", "βραδινος", "πονιρός", "φτινός", "κινός",
    "καλοκαιρυνός", "σκοτινός", "φωτινός", "πρωεινός", "αυστιρός",
    "τολμιρός", "γλικός", "βιαστηκός", "ξυνός", "φανταστηκός",
    "προιόντα", "ρολόϊ", "τσάϊ", "νεράϊδα", "σείχης", "καίκι", "χαιδεύω",
    "φαί", "κομπολόϊ", "σαίτα", "γαιδούρι", "αυπνία", "λαική", "μαιμού",
    "θεικό", "μαιντανός",
    "πηδό", "αγοράζο", "βλέπο", "φάκελω", "θέατρω", "θέατροο",
    "χάρτεινη", "χάρτηνη", "χάρτυνη", "κλιστό", "κληστό", "κλυστό",
    "επικίνδεινη", "επικίνδηνη", "πέτρεινος", "πέτρηνος", "πέτρυνος",
    "ξύλεινο", "ξύληνο", "ξύλυνο", "φτινές", "φτεινές", "φτυνές",
    "μάλλεινη", "μάλληνη", "μάλλυνη", "ταπινό", "ταπηνό", "ταπυνό",
    "σκοτινή", "σκοτηνή", "σκοτυνή", "έριμο", "έρειμο", "έρυμο",
    "δερμάτεινη", "δερμάτηνη", "δερμάτυνη", "φωτινό", "φωτηνό", "φωτυνό",
    "δανίζω", "ποτοίζω", "χτενοίζω", "μυροίζω", "αθρίζω", "γυροίζω",
    "κερδύζω", "ξυροίζω", "σκαλύζω", "ψωνείζω", "σκουπύζω", "δακρίζω",
    "μάθιμα", "πρόβλιμα", "μήνημα", "τμίμα", "διαμέρησμα", "ποίυμα",
    "σήρμα", "αίνηγμα", "σύνθιμα",
    "έννατη", "ενιά", "εννενήντα", "δεκαενιά", "εννενηκοστό", "ενιακόσια",
    "έννατος",
    "ζώω", "φαγητώ", "μωρώ", "κρύω", "τρώο", "δουλεύο", "δείχνο", "μιλό",
    "ροτάο", "περνάο", "χαλάο", "μιλάο", "αντιδράο", "ζητάο", "νερώ",
    "πακέτω", "δώρω", "κινητώ", "βουνώ", "αγαπό", "γελό", "κρατό",
    "πίνουμαι", "τρώμαι", "παίζουμαι", "προσέχουμαι", "πέσουμαι",
    "σκεπάζομε", "δροσιζόμασται", "κρύβεσε", "κάθετε", "ξεκουράζετε",
    "προσέχεται", "κάνεται", "πήγαμαι", "δούμαι", "ζαλίζομε", "βιάζομε",
    "πίρα", "πείρα", "πύρα", "βγίκα", "βγείκα", "βγύκα", "μπίκα", "μπείκα",
    "μπύκα", "βρίκα", "βρείκα", "βρύκα", "ίδα", "ήδα", "ύδα", "ίπια",
    "ήπια", "ύπια", "είρθα", "ύρθα", "ανέβικα", "ανέβεικα", "ανέβυκα",
    "κατέβικα", "κατέβεικα", "κατέβυκα", "πείγα", "πύγα",
    "πτώμμα", "βάμα", "πρόβλημμα", "γράμα", "κόμα", "βλέμα", "δέμμα",
    "κύμμα", "τρίμα", "ψέμμα", "βήμμα", "όνομμα",
    "συμφωνήσαμαι", "κάνουμαι", "βρίσκετε", "καθόμασται", "φεύγεται",
    "κοιμάτε", "πληρώνεσε", "σκέφτομε", "πλένομε", "σκουπίζομε", "ακούσαται",
    "δυσύλλαβη", "δίσβατο", "δυσέλιδο", "δύσεκτο", "δύψηφο", "δισκίνητος",
    "δύτροχο", "δυώροφο", "δίσκολο", "δύστιχο",
    "βαροί", "βαριές", "φαρδί", "ταχί", "βαθί", "παχί", "ελαφρί", "φαρδής",
    "καφεπόλης", "παλαιοπόλης", "οινοπόλης", "παγοπόλης", "αρχαιοπόλης",
    "καπνοπόλης", "κρεοπόλης", "σιδηροπόλης", "βιβλιοπόλης", "ανθοπόλης",
    "λαχανοπόλης", "τυροπόλης",
    "βουτυροπόλης", "νομισματοπόλης", "παντοπόλης", "οπωροπόλης",
    "αρωματοπόλης", "αρτοπόλης", "υποδηματοπόλης", "γαλακτοπόληςς",
    "χαρτοπόλης", "κοσμηματοπόλης", "αλλαντοπόλης", "ιχθυοπόληςς",
    "αμφιβάλω", "κατέβαλε", "ανέβαλε", "καταβάλω", "αμφιβάλει",
    "υπερβάλεις", "καταβάλετε", "υποβάλει", "επιβάλει",
    "περιμένης", "κάνης", "πηγαίνης", "θέλης", "λέη", "χορταίνης",
    "αγοράζης", "γράφης", "ζηλεύης", "βλέπης", "αρέσης", "σκουπίζης",
    "τρίβη", "σέρνη", "μπορή", "κλέβη", "μένη", "γλιστράη", "κόψη",
    "περιμένη", "πλένη", "διαλέξη", "αποτελή", "βράζη",
    "ενέργια", "νηστία", "κυκλοφορεία", "επιθυμεία", "οδηγεία", "αμβλεία",
    "καλλιέργια", "αγωνεία", "απιστεία", "λειτουργεία", "ευθία", "χορηγεία",
    "γαιόμηλο", "γείλοφος", "γεάνθρακας", "γαιολόγος", "γαιοκτησία", "απόγηο",
    "ώφελος", "οφέλιμες", "ανόφελες", "οφελούν", "εποφελούμαι", "ωφείλει",
    "βαρής", "τραπέζυ", "δάκρια", "στάχια", "βράδυα", "δίχτια",
    "μιλάται", "λερώνετε", "κρατιόμασται", "ψήνομε", "κρύβομε", "κάθομε",
    "τρελαίνομε",
    "σπίτει", "καθαρίζι", "μαγειρεύι", "παλάτει", "κλαδεύι", "αθροίζι",
    "στολίδει", "παρατηρί", "λύνι",
    "πέζουν", "παιζός", "παιζοί", "παιρνάμε", "παίρασε", "πέρνω",
    "παιράσουν", "πέρνει", "παίζο",
    "αθρείζω", "δανοίζω", "πρίζω",
    "κοιμάμε", "λυπάμε", "θυμάμε", "γράφομε", "ντύνομε",
    "χαίρομε", "χρειάζομε", "κουράζομε", "χτενίζομε",
    "τάξι", "λίμνι", "λέξι", "μουσικί",
    "βραδυνός",  # wrong vs βραδινός - actually βραδινός is correct; βραδυνός wrong
}

FRAGMENTS = {
    "ώνας", "ονας", "αι", "αγκ", "καν", "άξ", "αγ", "ίζω", "αίνω", "ένω",
    "είστε", "ήστε", "ίστε", "ποιός", "ποιώ", "ποιείο", "ποίηση",
    "ελαι", "ξεν", "αχυρ", "αμπελ", "στρατ", "ορνιθ", "απατε", "πύθ",
    "γείτ", "κηδεμ", "θερμοσίφ", "πνεύμ", "αρχιτέκτ", "παρθεν",
    "άθρο", "πορτοκαλε", "απόλλ", "ποσειδ", "μακεδ",
}


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s.strip())


def deaccent(s: str) -> str:
    s = nfc(s)
    table = str.maketrans(
        "άέήίόύώΆΈΉΊΌΎΏϊΐϋΰΪΫ",
        "αεηιουωΑΕΗΙΟΥΩιιυυΙΥ",
    )
    return s.translate(table).lower()


VOWEL_CHARS = set("αεηιουωάέήίόύώϊϋΐΰΑΕΗΙΟΥΩΆΈΉΊΌΎΏΪΫ")
ACCENT_CHARS = set("άέήίόύώΐΰΆΈΉΊΌΎΏ")
# Complete Greek word endings (reject bare stems like αστέρ, αχλάδ)
VALID_ENDING = re.compile(
    r"(α|ά|η|ή|ο|ό|ι|ί|ϊ|ΐ|υ|ύ|ϋ|ΰ|ω|ώ|ς|ν|ας|άς|ης|ής|ις|ος|ός|ους|ούς|"
    r"ων|ών|εις|είς|ες|ές|μα|μά|μη|μή|ση|σή|ξη|ξή|ψη|ψή|ια|ιά|εια|εία|"
    r"ού|εί|άι|όι|αι|οι|ει|ευ|αυ|ούσα|ώντας|μένος|μένη|μένο)$",
    re.IGNORECASE,
)


def is_complete_correct_word(w: str) -> bool:
    """Reject incomplete stems and unaccented multi-syllable forms (tone drills)."""
    low = w.lower()
    if not VALID_ENDING.search(low):
        return False
    vowels = [c for c in low if c in VOWEL_CHARS]
    # Modern Greek: words with 2+ syllables need a stress mark (content words)
    if len(vowels) >= 2 and not any(c in ACCENT_CHARS for c in low):
        return False
    return True


def parse_vocab_line(line: str):
    line = nfc(line)
    if not line or "___" in line or "/" in line:
        return None
    if line.startswith("=====") or line.startswith("pages=") or line.startswith("http"):
        return None
    if "i-learn" in line or "i-books" in line:
        return None
    tokens = GREEK.findall(line)
    if not tokens:
        return None
    if len(tokens) == 1:
        w = tokens[0]
    elif len(tokens) == 2 and tokens[0].lower() in ARTICLE | EGO:
        w = tokens[1]
    else:
        return None
    w = nfc(w)
    if len(w) < 3:
        return None
    low = w.lower()
    if low in META or low in ARTICLE or low in EGO or low in FRAGMENTS or low in WRONG:
        return None
    # Skip title-case personal names
    if w[0].isupper() and not w.isupper() and low not in {
        "ελλάδα", "ιταλία", "αμερική", "κρήτη", "πίνδος", "όλυμπος",
        "πάσχα", "παρασκευή", "ιανουάριος",
    }:
        return None
    if not is_complete_correct_word(w):
        return None
    return w


def pick_correct(a: str, b: str, app_deacc: dict):
    a, b = nfc(a), nfc(b)
    al, bl = a.lower(), b.lower()
    if al in WRONG and bl not in WRONG:
        return b
    if bl in WRONG and al not in WRONG:
        return a
    if al in WRONG and bl in WRONG:
        return None
    a_in = deaccent(a) in app_deacc
    b_in = deaccent(b) in app_deacc
    if a_in and not b_in:
        return a
    if b_in and not a_in:
        return b
    return None


def slash_pairs(line: str):
    if "/" not in line:
        return
    parts = [p.strip() for p in re.split(r"\s*/\s*", line)]
    words = []
    for p in parts:
        toks = GREEK.findall(p)
        if not toks:
            continue
        if len(toks) >= 2 and toks[0].lower() in ARTICLE | EGO:
            words.append(toks[1])
        elif len(toks) == 1:
            words.append(toks[0])
        else:
            words.append(toks[-1])
    if len(words) == 2:
        yield words[0], words[1]


def main():
    with open(APP_PATH, encoding="utf-8") as f:
        data = json.load(f)
    app_words = [nfc(w["word"]) for w in data["words"]]
    app_exact = {w.lower(): w for w in app_words}
    app_deacc = defaultdict(list)
    for w in app_words:
        app_deacc[deaccent(w)].append(w)

    lines = open(PDF_PATH, encoding="utf-8").read().splitlines()

    # Pass 1: collect raw vocab lines + mark which come from similar stacked pairs
    raw_vocab = []  # (word, line_idx)
    for i, line in enumerate(lines):
        w = parse_vocab_line(line)
        if w:
            raw_vocab.append((i, w))

    # Detect stacked orthography pairs (consecutive similar words)
    drop = set()  # lowercase words to drop (wrong side)
    keep_forced = set()  # lowercase words to force-keep (correct side)
    idxs = {i for i, _ in raw_vocab}
    by_idx = {i: w for i, w in raw_vocab}
    sorted_idxs = sorted(idxs)
    for a_i, b_i in zip(sorted_idxs, sorted_idxs[1:]):
        if b_i != a_i + 1:
            continue
        a, b = by_idx[a_i], by_idx[b_i]
        if deaccent(a)[:4] != deaccent(b)[:4]:
            continue
        if a.lower() == b.lower():
            continue
        chosen = pick_correct(a, b, app_deacc)
        if chosen:
            other = b if chosen.lower() == a.lower() else a
            keep_forced.add(chosen.lower())
            drop.add(other.lower())
        else:
            # Unresolved near-duplicate pair: keep neither distractor-looking,
            # keep both only if edit distance suggests they are different words
            da, db = deaccent(a), deaccent(b)
            # if same length and <=2 char diff → orthography pair, skip both unresolved
            if len(da) == len(db) and sum(x != y for x, y in zip(da, db)) <= 2:
                drop.add(a.lower())
                drop.add(b.lower())

    targets = {}
    for _, w in raw_vocab:
        low = w.lower()
        if low in drop or low in WRONG or low in FRAGMENTS:
            continue
        targets[low] = w
    for low in keep_forced:
        # recover display form
        for _, w in raw_vocab:
            if w.lower() == low:
                targets[low] = w
                break

    # Slash pairs
    for line in lines:
        for a, b in slash_pairs(line):
            if len(a) < 3 or len(b) < 3:
                continue
            chosen = pick_correct(a, b, app_deacc)
            if chosen and chosen.lower() not in WRONG and chosen.lower() not in FRAGMENTS:
                if is_complete_correct_word(chosen):
                    targets[chosen.lower()] = nfc(chosen)
                    other = b if chosen.lower() == a.lower() else a
                    targets.pop(other.lower(), None)

    # Final purge
    for low in list(targets):
        w = targets[low]
        if low in WRONG or low in FRAGMENTS or low in META or not is_complete_correct_word(w):
            del targets[low]

    pdf_words = sorted(targets.values(), key=lambda x: x.lower())

    present, missing, accent_near = [], [], []
    for w in pdf_words:
        if w.lower() in app_exact:
            present.append(w)
        elif deaccent(w) in app_deacc:
            accent_near.append({"pdf": w, "app": app_deacc[deaccent(w)]})
            missing.append(w)
        else:
            missing.append(w)

    def stem6(w):
        d = deaccent(w)
        return d[:6] if len(d) >= 6 else d

    app_stems = {stem6(w) for w in app_words}
    missing_no_stem = [w for w in missing if stem6(w) not in app_stems]
    missing_related = [w for w in missing if stem6(w) in app_stems]

    summary = "\n".join([
        "ΣΥΓΚΡΙΣΗ: Μάθημα Ορθογραφίας (PDF) vs Orthographia words.json",
        "=" * 60,
        f"Λέξεις στην εφαρμογή:                 {len(app_words)}",
        f"Μοναδικές σωστές λέξεις-στόχοι PDF:   {len(pdf_words)}",
        f"Υπάρχουν ακριβώς στην εφαρμογή:       {len(present)}  ({100*len(present)/max(len(pdf_words),1):.1f}%)",
        f"ΛΕΙΠΟΥΝ από την εφαρμογή:             {len(missing)}  ({100*len(missing)/max(len(pdf_words),1):.1f}%)",
        f"  · χωρίς σχετικό θέμα (~6 γράμματα): {len(missing_no_stem)}",
        f"  · με σχετικό θέμα ήδη στην εφαρμογή:{len(missing_related)}",
        f"  · ίδιο γράμματα / διαφορετικοί τόνοι:{len(accent_near)}",
        "",
        "Κριτήρια: μόνο λέξεις-στόχοι λιστών + σωστές επιλογές",
        "ασκήσεων εναλλακτικών. Εξαιρούνται λάθος distractors,",
        "κενά συμπλήρωσης (____) και λέξεις μέσα σε προτάσεις.",
    ])

    result = {
        "source_pdf": "mathima_orthografias_neo-tceloy.pdf",
        "app_word_count": len(app_words),
        "pdf_correct_target_words": len(pdf_words),
        "present_exact": len(present),
        "missing_total": len(missing),
        "missing_no_related_stem": len(missing_no_stem),
        "missing_related_stem": len(missing_related),
        "accent_near_count": len(accent_near),
        "coverage_pct": round(100.0 * len(present) / max(len(pdf_words), 1), 1),
        "missing_words": missing,
        "missing_no_stem_words": missing_no_stem,
        "missing_related_words": missing_related,
        "present_words": present,
        "accent_near": accent_near,
        "all_pdf_targets": pdf_words,
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    with open(OUT_MISSING, "w", encoding="utf-8") as f:
        f.write(summary + "\n\n")
        f.write(f"# Λείπουν τελείως ({len(missing_no_stem)})\n")
        for w in missing_no_stem:
            f.write(w + "\n")
        f.write(f"\n# Λείπουν αλλά υπάρχει σχετικό θέμα ({len(missing_related)})\n")
        for w in missing_related:
            f.write(w + "\n")

    with open(OUT_SUMMARY, "w", encoding="utf-8") as f:
        f.write(summary + "\n")

    print(summary)
    print("\nWROTE", OUT_JSON)
    print("WROTE", OUT_MISSING)


if __name__ == "__main__":
    main()
