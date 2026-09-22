#!/usr/bin/env python3
"""Extract vocabulary from school lexicons (ABC + DEST) into grade CSV files.

Reads:
  - a_b_c_lexiko.pdf (Α΄–Γ΄ source PDF; Α΄ entries are redistributed to Β΄–Γ΄)
  - d_e_st_lexiko.pdf (Δ΄–Στ΄) — standard Unicode text

Outputs:
  inputs/lexika/grade{2-6}.csv
  inputs/lexika/families.json
  inputs/lexika/rules_snippets.json (orthography intro sections)

Usage:
  python extract_lexikon.py
  python extract_lexikon.py --pdf-dir "C:\\Users\\User\\Downloads"
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from helfont_decode import decode_helfont
from import_helexkids import normalize_word

PIPELINE = Path(__file__).resolve().parent
LEXIKA_DIR = PIPELINE / "inputs" / "lexika"
EXTRACT_DIR = LEXIKA_DIR / "_extract"

ABC_PDF = "a_b_c_lexiko.pdf"
DEST_PDF = "d_e_st_lexiko.pdf"

CAPS = {2: 180, 3: 180, 4: 100, 5: 100, 6: 120}

WORD_RE = re.compile(r"[Α-ΩΆΈΉΊΌΎΏα-ωάέήίόύώϊΐϋΰ]+")

# DEST lexicon patterns
DEST_HEADWORD_RE = re.compile(
    r"^([\wά-ώΆ-Ώ\-]+(?:,\s*-[ηοαάέήίόύώ]+)*)\s*(?:\(([τοηο])\))?\s*$",
    re.MULTILINE,
)
DEST_POS_RE = re.compile(r"^\((Ουσιαστικό|Επίθετο|Ρήμα)", re.MULTILINE | re.IGNORECASE)
EXAMPLE_RE = re.compile(r"►([^►\n]{10,200})")
FAMILY_RE = re.compile(r"Οικογ\.\s*Λέξ\.?\s*:?\s*([^\n]+(?:\n[^\n]+)?)", re.IGNORECASE)
SYNONYM_RE = re.compile(r"Συνών\.?\s*:\s*([^\n]+)", re.IGNORECASE)
DEFINITION_RE = re.compile(
    r"(?:^|\n)\d+\.\s*([^\n►]{8,200}?)(?:►|:|\n)",
    re.MULTILINE,
)

# ABC decoded patterns
ABC_HEADWORD_RE = re.compile(
    r"^([α-ωά-ώ]{3,16})\s*$",
    re.MULTILINE,
)
ABC_POS_RE = re.compile(
    r"^(.{3,30})\s*\[(το|τη|την|τα|οι|η|ο)\]\s*ουσιαστικ",
    re.MULTILINE | re.IGNORECASE,
)
ABC_ADJ_POS_RE = re.compile(r"^\(.{3,30}\)\s*$")
ABC_EXAMPLE_LINE_RE = re.compile(r"^(.{15,200}[.!?])$", re.MULTILINE)

POS_MAP = {
    "ουσιαστικό": "noun",
    "επίθετο": "adj",
    "ρήμα": "verb",
    "ουσιαστικ": "noun",
    "επιθετο": "adj",
    "ρημα": "verb",
}

NOISE_WORDS = {
    "σελ",
    "σελίδα",
    "σελίδες",
    "πίνακας",
    "πίνακες",
    "λεξικό",
    "γραμματική",
    "υπουργείο",
    "isbn",
    "συντομογραφίες",
    "ειδικά",
    "σύμβολα",
    "ουσιαστικό",
    "ουσιαστικο",
    "επίθετο",
    "επιθετο",
    "ρήμα",
    "ρημα",
    "συντομογραφίες",
    "συντομογραφια",
    "στους",
    "στην",
    "στο",
    "στα",
    "λόγιος",
    "ελληνιστικό",
    "λιμενίσκος",
    "κοιτάζω",
}


def strip_accents(text: str) -> str:
    base = unicodedata.normalize("NFD", text)
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def discover_pdf(name: str, pdf_dir: Path | None) -> Path | None:
    search_dirs = []
    if pdf_dir:
        search_dirs.append(pdf_dir)
    search_dirs.extend([Path.home() / "Downloads", Path(r"C:\Users\User\Downloads"), LEXIKA_DIR])
    for folder in search_dirs:
        path = folder / name
        if path.exists():
            return path
    return None


def extract_pdf_text(pdf_path: Path, decode: bool = False) -> str:
    import pymupdf

    doc = pymupdf.open(str(pdf_path))
    parts: list[str] = []
    for page in doc:
        raw = page.get_text("text") or ""
        parts.append(decode_helfont(raw) if decode else raw)
    doc.close()
    return "\n".join(parts)


def repair_hyphen_breaks(text: str) -> str:
    return re.sub(r"([α-ωά-ώΑ-ΩΆ-Ώ])-\s*\n\s*([α-ωά-ώΑ-ΩΆ-Ώ])", r"\1\2", text)


def clean_example(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw.replace("-", "")).strip(" .:;")
    text = re.sub(r"^\d+\.\s*", "", text)
    return text


def is_garbled(text: str) -> bool:
    if not text:
        return False
    bad = sum(1 for c in text if c in "¤‡Œ∞Ò‹Ê")
    return bad > len(text) * 0.08


def make_cloze(sentence: str, word: str) -> str:
    if not sentence or not word:
        return ""
    pattern = re.compile(re.escape(word), re.IGNORECASE)
    if pattern.search(sentence):
        return pattern.sub("___", sentence, count=1)
    key = strip_accents(word.lower())
    tokens = WORD_RE.findall(sentence)
    for token in tokens:
        if strip_accents(token.lower()) == key:
            return sentence.replace(token, "___", 1)
    if sentence.endswith("."):
        return f"{sentence[:-1]} ___."
    return f"{sentence} ___"


def parse_pos(raw: str) -> str:
    low = strip_accents(raw.lower())
    for key, val in POS_MAP.items():
        if key in low:
            return val
    return "noun"


def is_valid_headword(word: str) -> bool:
    if not word or len(word) < 3 or len(word) > 18:
        return False
    key = strip_accents(word.lower())
    if key in NOISE_WORDS:
        return False
    if not re.search(r"[α-ωά-ώ]", word):
        return False
    if word.isupper() and len(word) <= 4:
        return False
    if sum(1 for c in word if c.isascii() and c.isalpha()) > 0:
        return False
    return True


def assign_grade_by_index(index: int, total: int, grades: tuple[int, ...]) -> int:
    if total <= 0:
        return grades[0]
    bucket = int(index / max(total, 1) * len(grades))
    bucket = min(bucket, len(grades) - 1)
    return grades[bucket]


def difficulty_for_word(word: str, grade: int) -> int:
    length = len(strip_accents(word))
    score = 1
    if length >= 9:
        score = 2
    if length >= 12 or grade >= 5:
        score = 3
    if re.search(r"(.)\1", strip_accents(word)):
        score = min(3, score + 1)
    return score


def parse_dest_lexikon(text: str) -> list[dict[str, Any]]:
    """Parse ΔΕΣΤ orthographic dictionary entries."""
    text = repair_hyphen_breaks(text)
    entries: list[dict[str, Any]] = []
    chunks = re.split(
        r"\n(?=[α-ωά-ώΑ-ΩΆ-Ώ][\wά-ώΆ-Ώ\-]+(?:,\s*-[ηοαάέήίόύώ]+)*\s*(?:\([τοηο]\))?\s*\n)",
        text,
    )
    for chunk in chunks:
        if len(chunk) < 30:
            continue
        head_match = re.match(
            r"^([\wά-ώΆ-Ώ\-]+(?:,\s*-[ηοαάέήίόύώ]+)*)\s*(?:\([τοηο]\))?\s*\n",
            chunk,
        )
        if not head_match:
            continue
        headword = head_match.group(1).split(",")[0].strip()
        if not is_valid_headword(headword):
            continue
        pos_match = DEST_POS_RE.search(chunk)
        pos = parse_pos(pos_match.group(0) if pos_match else "ουσιαστικό")

        flat = repair_hyphen_breaks(chunk)
        examples: list[str] = []
        for m in EXAMPLE_RE.finditer(flat):
            ex = clean_example(m.group(1))
            if headword.lower() in ex.lower() or strip_accents(headword) in strip_accents(ex):
                examples.append(ex)
            elif len(ex) >= 15:
                examples.append(ex)
        example = examples[0] if examples else ""

        def_match = DEFINITION_RE.search(flat)
        definition = clean_example(def_match.group(1)) if def_match else ""
        if not definition and example:
            definition = example[:120]

        family_match = FAMILY_RE.search(flat)
        family = ""
        if family_match:
            family = re.sub(r"\s+", " ", family_match.group(1).replace("-", "")).strip(" .")

        synonym_match = SYNONYM_RE.search(flat)
        synonyms = synonym_match.group(1).strip() if synonym_match else ""

        hint = make_cloze(example, headword) if example else ""
        entries.append(
            {
                "word": headword,
                "pos": pos,
                "hint": hint,
                "definition": definition[:200],
                "family": family,
                "synonyms": synonyms,
                "source": "d_est_lexiko",
            }
        )
    return entries


def parse_abc_lexikon(text: str) -> list[dict[str, Any]]:
    """Parse ABC illustrated lexicon (decoded HelBold text)."""
    entries: list[dict[str, Any]] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line or line.isdigit() or len(line) > 20:
            continue
        if not re.fullmatch(r"[α-ωά-ώΆ-Ώ]{3,14}", line):
            continue
        if not is_valid_headword(line) or is_garbled(line):
            continue
        if line.endswith(("ος", "η", "ο", "ες", "ων", "ους")) and len(line) < 4:
            continue

        pos = "noun"
        definition = ""
        example = ""
        chunk_lines: list[str] = []
        for j in range(i, min(i + 25, len(lines))):
            chunk_lines.append(lines[j].strip())
        chunk = "\n".join(chunk_lines)

        pos_m = ABC_POS_RE.search(chunk)
        if pos_m:
            pos = "noun"
        elif "επίθετο" in chunk.lower() or "επιθετο" in chunk.lower():
            pos = "adj"
        elif "ρήμα" in chunk.lower() or "ρημα" in chunk.lower():
            pos = "verb"

        for cl in chunk_lines:
            if len(cl) < 20 or cl.startswith("(") or cl.startswith("["):
                continue
            if WORD_RE.fullmatch(cl):
                continue
            if any(x in cl for x in ("ουσιαστικ", "επίθετο", "ρήμα", "-", "[", "σημάδι")):
                if not definition and len(cl) > 25:
                    definition = cl[:200]
                continue
            if len(cl) >= 20 and any(c in cl for c in ".!;"):
                example = cl
                break

        if is_garbled(example) or is_garbled(definition):
            example = ""
            definition = ""
        hint = make_cloze(example, line) if example and not is_garbled(example) else ""
        if not hint and not pos_m and "ουσιαστικ" not in chunk.lower():
            continue
        entries.append(
            {
                "word": line,
                "pos": pos,
                "hint": hint,
                "definition": definition[:200],
                "family": "",
                "synonyms": "",
                "source": "abc_lexiko",
            }
        )
    return entries


def extract_rules_from_dest(text: str) -> list[dict[str, Any]]:
    """Extract orthography intro sections from DEST lexicon."""
    rules: list[dict[str, Any]] = []
    sections = [
        (
            "homonyms",
            r"Τι είναι ομώνυμα, παρώνυμα, συνώνυμα",
            "Ομώνυμα, παρώνυμα και συνώνυμα",
            "Ομώνυμα: ίδια γραφή, διαφορετική σημασία (π.χ. φράση, κλειδί). Παρώνυμα: διαφορετικές λέξεις, ίδια σημασία (π.χ. σπίτι, σπιτικό).",
            [4, 5, 6],
        ),
        (
            "tonos-advanced",
            r"Πώς και πότε τονίζουμε",
            "Πώς τονίζουμε τις λέξεις",
            "Ο τόνος δείχνει ποια συλλαβή τονίζουμε. Στα ρήματα -άω/-ώ, στα ουσιαστικά σε -ος/-η/-ο.",
            [4, 5, 6],
        ),
        (
            "numerals",
            r"Πώς γράφουμε τα αριθμητικά",
            "Τα αριθμητικά",
            "Τα αριθμητικά γράφονται με μία λέξη: ένα, δύο, δεκαπέντε κ.λπ.",
            [4, 5, 6],
        ),
    ]
    for rule_id, pattern, title, body, grades in sections:
        if re.search(pattern, text, re.IGNORECASE):
            rules.append(
                {
                    "id": rule_id,
                    "title": title,
                    "body": body,
                    "examples": [],
                    "grades": grades,
                }
            )
    return rules


def clean_family_members(raw: str) -> list[str]:
    raw = re.sub(r"Προσδιορ\.?[^,]*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"Οικογένεια\s+Λέξεων[^,]*", "", raw, flags=re.IGNORECASE)
    members: list[str] = []
    for part in re.split(r"[,·]", raw):
        token = part.strip(" .()")
        token = re.sub(r"\([^)]*\)", "", token).strip()
        if not token or len(token) < 3:
            continue
        if any(x in token.lower() for x in ("προσδιορ", "ουσιαστ", "επίθετο", "επίρρ")):
            continue
        word_only = WORD_RE.findall(token)
        if word_only:
            candidate = word_only[0]
            if is_valid_headword(candidate):
                members.append(candidate)
    return members


def build_families(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    families: dict[str, dict[str, Any]] = {}
    for entry in entries:
        word = entry["word"]
        family_raw = entry.get("family", "")
        if not family_raw:
            continue
        members = clean_family_members(family_raw)
        if not members:
            continue
        root = strip_accents(word.lower())[: max(3, len(word) // 2)]
        families[word] = {
            "root": root,
            "members": members[:6],
            "rule": f"Ρίζα {root}- + κατάληξη",
        }
    return families


def distribute_to_grades(
    entries: list[dict[str, Any]],
    grades: tuple[int, ...],
    caps: dict[int, int],
) -> dict[int, list[dict[str, Any]]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for entry in entries:
        key = normalize_word(entry["word"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(entry)

    by_grade: dict[int, list[dict[str, Any]]] = {g: [] for g in grades}
    total = len(unique)
    for idx, entry in enumerate(unique):
        grade = assign_grade_by_index(idx, total, grades)
        if len(by_grade[grade]) >= caps.get(grade, 100):
            placed = False
            for g in grades:
                if len(by_grade[g]) < caps.get(g, 100):
                    grade = g
                    placed = True
                    break
            if not placed:
                continue
        entry = dict(entry)
        entry["grade"] = grade
        entry["difficulty"] = difficulty_for_word(entry["word"], grade)
        by_grade[grade].append(entry)
    return by_grade


def write_grade_csv(records: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["word", "grade", "pos", "hint", "definition", "family", "synonyms", "source", "difficulty"]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in records:
            writer.writerow({k: row.get(k, "") for k in fields})


def run_extraction(pdf_dir: Path | None = None) -> dict[str, Any]:
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    stats: dict[str, Any] = {"abc": 0, "dest": 0, "by_grade": {}}

    all_entries: list[dict[str, Any]] = []
    rules: list[dict[str, Any]] = []

    dest_path = discover_pdf(DEST_PDF, pdf_dir)
    if dest_path:
        print(f"Extracting DEST lexicon: {dest_path.name}")
        dest_text = extract_pdf_text(dest_path, decode=False)
        (EXTRACT_DIR / "d_e_st_lexiko.txt").write_text(dest_text, encoding="utf-8")
        dest_entries = parse_dest_lexikon(dest_text)
        rules.extend(extract_rules_from_dest(dest_text))
        all_entries.extend(dest_entries)
        stats["dest"] = len(dest_entries)
        print(f"  Parsed {len(dest_entries)} DEST entries")
    else:
        print(f"Warning: {DEST_PDF} not found")

    abc_path = discover_pdf(ABC_PDF, pdf_dir)
    if abc_path:
        print(f"Extracting ABC lexicon: {abc_path.name}")
        abc_text = extract_pdf_text(abc_path, decode=True)
        (EXTRACT_DIR / "a_b_c_lexiko_decoded.txt").write_text(abc_text, encoding="utf-8")
        abc_entries = parse_abc_lexikon(abc_text)
        all_entries.extend(abc_entries)
        stats["abc"] = len(abc_entries)
        print(f"  Parsed {len(abc_entries)} ABC entries")
    else:
        print(f"Warning: {ABC_PDF} not found")

    dest_only = [e for e in all_entries if e.get("source") == "d_est_lexiko"]
    abc_only = [e for e in all_entries if e.get("source") == "abc_lexiko"]

    dest_by_grade = distribute_to_grades(dest_only, (4, 5, 6), {4: CAPS[4], 5: CAPS[5], 6: CAPS[6]})
    abc_by_grade = distribute_to_grades(abc_only, (2, 3), {2: CAPS[2], 3: CAPS[3]})

    for grade in (2, 3, 4, 5, 6):
        records = abc_by_grade.get(grade, []) + dest_by_grade.get(grade, [])
        path = LEXIKA_DIR / f"grade{grade}.csv"
        write_grade_csv(records, path)
        stats["by_grade"][grade] = len(records)
        print(f"  Wrote grade{grade}.csv: {len(records)} words")

    # Α΄ is no longer offered — remove stale extract if present
    stale = LEXIKA_DIR / "grade1.csv"
    if stale.exists():
        stale.unlink()
        print("  Removed obsolete grade1.csv")

    families = build_families(dest_only)
    families_path = LEXIKA_DIR / "families.json"
    families_path.write_text(json.dumps(families, ensure_ascii=False, indent=2), encoding="utf-8")
    stats["families"] = len(families)

    rules_path = LEXIKA_DIR / "rules_snippets.json"
    rules_path.write_text(json.dumps({"rules": rules}, ensure_ascii=False, indent=2), encoding="utf-8")
    stats["rules"] = len(rules)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract school lexicon PDFs to grade CSVs")
    parser.add_argument("--pdf-dir", type=Path, default=None)
    args = parser.parse_args()
    stats = run_extraction(args.pdf_dir)
    print(f"Done: {stats}")


if __name__ == "__main__":
    main()
