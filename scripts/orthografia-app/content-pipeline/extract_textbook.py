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

DEFAULT_CAP = 80
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
}

GREEK_LETTERS = set("αβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώϊΐϋΰ")


def strip_accents(text: str) -> str:
    base = unicodedata.normalize("NFD", text)
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


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
    if key in STOPWORDS or key in META_WORDS or key in CHARACTER_NAMES:
        return False
    if key in INSTRUCTION_VERBS or key in GRAMMAR_TERMS:
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


def mask_word(sentence: str, word: str) -> str | None:
    target = normalize_word(word).replace("ς", "σ")
    parts: list[str] = []
    last = 0
    hits = 0
    for match in re.finditer(r"\S+", sentence):
        if match.start() > last:
            parts.append(sentence[last : match.start()])
        token = match.group(0)
        core = re.sub(r"^[«»\"']+|[«»\"',.;:!?…]+$", "", token)
        punct_prefix = token[: len(token) - len(token.lstrip("«»\"'"))]
        punct_suffix = token[len(core) + len(punct_prefix) :]
        if normalize_word(core).replace("ς", "σ") == target:
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
    if "___" not in cloze:
        return None
    return cloze


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
    sentences = split_sentences(repaired_blob)

    freq: Counter[str] = Counter()
    forms: dict[str, Counter[str]] = defaultdict(Counter)
    sentence_index: dict[str, list[str]] = defaultdict(list)

    for token in WORD_RE.findall(repaired_blob):
        if not is_content_word(token, explicit=token in explicit):
            continue
        key = normalize_word(token)
        freq[key] += 1
        forms[key][token] += 1

    for sentence in sentences:
        seen_in_sentence: set[str] = set()
        for token in WORD_RE.findall(sentence):
            key = normalize_word(token)
            if key in seen_in_sentence:
                continue
            if key in freq:
                sentence_index[key].append(sentence)
                seen_in_sentence.add(key)

    rows: list[dict[str, Any]] = []
    for key, count in freq.items():
        surface = forms[key].most_common(1)[0][0]
        if surface[:1].isupper() and surface[1:].islower() and count < 4 and surface not in explicit:
            continue
        accented = [form for form, _n in forms[key].most_common() if any(c in form for c in "άέήίόύώΆΈΉΊΌΎΏ")]
        surface_l = (accented[0] if accented else surface).lower()

        explicit_hit = any(normalize_word(w) == key for w in explicit)
        isolated_hit = any(normalize_word(w) == key for w in isolated)
        if count < 2 and not explicit_hit and not isolated_hit:
            continue
        score = count + spelling_interest(surface_l)
        if explicit_hit:
            score += 400
        if isolated_hit:
            score += 40
        if key in {normalize_word(w) for w in ORIGINAL_HINTS}:
            score += 80
        rows.append(
            {
                "word": surface_l,
                "grade": GRADE,
                "frequency": count,
                "score": score,
                "explicit": explicit_hit,
                "sentences": sentence_index.get(key, []),
            }
        )

    rows.sort(key=lambda r: (-r["score"], -r["frequency"], r["word"]))
    return rows


def rows_to_csv_records(rows: list[dict[str, Any]], cap: int) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    seen: set[str] = set()
    for i, row in enumerate(rows):
        key = normalize_word(row["word"])
        if key in seen:
            continue
        seen.add(key)
        hint = pick_hint(row["word"], row["sentences"], i)
        if is_generic_hint(hint) and not row.get("explicit"):
            continue
        if any(
            marker in hint
            for marker in (
                "Με αυτή τη λέξη ονομάζουμε",
                "Στο σχολείο, μιλάμε για",
                "Στην τάξη, γράφουμε τη λέξη",
                "Συμπληρώνουμε την πρόταση",
            )
        ) and not row.get("explicit"):
            continue
        records.append(
            {
                "word": row["word"],
                "grade": str(GRADE),
                "pos": "noun",
                "frequency": str(row["frequency"]),
                "hint": hint,
                "source": "glossa-b-dim",
            }
        )
        if len(records) >= cap:
            break
    return records


def write_csv(records: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["word", "grade", "pos", "frequency", "hint", "source"],
        )
        writer.writeheader()
        writer.writerows(records)


def load_textbook_rows(csv_path: Path = OUTPUT_CSV) -> list[dict[str, Any]]:
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
                    "grade": GRADE,
                    "pos": (raw.get("pos") or "noun").strip() or "noun",
                    "frequency": freq,
                    "hint": (raw.get("hint") or "").strip(),
                    "source": raw.get("source") or csv_path.name,
                }
            )
    return rows


def build_textbook_entries(
    rows: list[dict[str, Any]],
    existing_words: list[dict[str, Any]],
    cap: int = DEFAULT_CAP,
) -> list[dict[str, Any]]:
    existing_keys = {normalize_word(w["word"]) for w in existing_words}
    existing_audio = {
        normalize_word(w["word"]): w.get("audioFile", "")
        for w in existing_words
        if w.get("audioFile")
    }
    overrides = load_overrides()
    entries: list[dict[str, Any]] = []
    n = 0
    for i, row in enumerate(rows):
        key = normalize_word(row["word"])
        if key in existing_keys:
            continue
        existing_keys.add(key)
        n += 1
        morphemes = guess_morphemes(row["word"])
        hint = row.get("hint") or generate_hint(row["word"], pos=row.get("pos", "noun"), index=i, overrides=overrides)
        if "___" not in hint:
            hint = mask_word(hint, row["word"]) or generate_hint(
                row["word"], pos="noun", index=i, overrides=overrides
            )
        entry: dict[str, Any] = {
            "id": f"tb-g{GRADE}-{n:04d}",
            "word": row["word"],
            "grade": GRADE,
            "axis": "K" if any(c in row["word"] for c in "άέήίόύώ") else "R",
            "hintSentence": hint,
            "feedbackRule": feedback_rule(row["word"], morphemes),
            "audioFile": audio_path_for_word(row["word"], existing_audio),
            "morphemes": morphemes,
            "difficulty": 2 if len(row["word"]) >= 8 else 1,
        }
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
) -> tuple[list[dict[str, Any]], dict[int, int], int]:
    rows = load_textbook_rows(csv_path)
    if not rows:
        return base_words, count_by_grade(base_words), 0
    imported = build_textbook_entries(rows, base_words, cap)
    merged = merge_words(base_words, imported)
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
    print(f"Total by grade: G1={total[1]}, G2={total[2]}, G3={total[3]}, G4={total[4]}")
    print(f"Wrote {len(merged)} words -> {PIPELINE / 'outputs' / 'words.json'}")
    print(f"Synced to {WEB_WORDS}")


if __name__ == "__main__":
    main()
