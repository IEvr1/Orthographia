#!/usr/bin/env python3
"""Extract grammar rules and declension tables from Γραμματική Ε-ΣΤ PDF."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
LEXIKA_DIR = PIPELINE / "inputs" / "lexika"
WEB_CONTENT = PIPELINE.parent / "web" / "public" / "content"
GRAMMAR_PDF = "e_st_grammatiki_vivlio_mathiti.pdf"


def discover_pdf(pdf_dir: Path | None) -> Path | None:
    search_dirs = []
    if pdf_dir:
        search_dirs.append(pdf_dir)
    search_dirs.extend([Path.home() / "Downloads", Path(r"C:\Users\User\Downloads"), LEXIKA_DIR])
    for folder in search_dirs:
        path = folder / GRAMMAR_PDF
        if path.exists():
            return path
    return None


def extract_pdf_text(pdf_path: Path) -> str:
    import pymupdf

    doc = pymupdf.open(str(pdf_path))
    parts = [page.get_text("text") or "" for page in doc]
    doc.close()
    return "\n".join(parts)


def extract_declension_tables(text: str) -> dict[str, list[str]]:
    """Extract common noun/adjective endings from grammar sections."""
    tables: dict[str, list[str]] = {
        "masculine_isosyllaba": [],
        "feminine_isosyllaba": [],
        "neuter_isosyllaba": [],
    }
    patterns = [
        ("masculine_isosyllaba", r"Ισοσύλλαβα σε -ης, -ας, -ος"),
        ("feminine_isosyllaba", r"Ισοσύλλαβα σε -α, -η, -ω"),
        ("neuter_isosyllaba", r"Ισοσύλλαβα σε -ο, -ι, -ος"),
    ]
    for key, pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            tables[key] = ["-ος", "-η", "-ο", "-ες", "-ων", "-ους"]
    return tables


def extract_grammar_rules(text: str) -> list[dict]:
    rules: list[dict] = []
    candidates = [
        (
            "theme-suffix",
            r"Θέμα, κατάληξη",
            "Θέμα και κατάληξη",
            "Κάθε λέξη έχει θέμα (η σταθερή ρίζα) και κατάληξη (το μέρος που αλλάζει).",
            [5, 6],
        ),
        (
            "declension-ending",
            r"Κλίση ουσιαστικών",
            "Κλίση ουσιαστικών",
            "Τα ουσιαστικά κλίνονται σε γένος, αριθμό και πτώση. Προσέχουμε την κατάληξη.",
            [5, 6],
        ),
        (
            "irregular-declension",
            r"Ανώμαλα ουσιαστικά",
            "Ανώμαλα ουσιαστικά",
            "Μερικά ουσιαστικά δεν ακολουθούν τον κανόνα (π.χ. παιδί, κρέας).",
            [6],
        ),
    ]
    for rule_id, pattern, title, body, grades in candidates:
        if re.search(pattern, text, re.IGNORECASE):
            rules.append(
                {"id": rule_id, "title": title, "body": body, "examples": [], "grades": grades}
            )
    return rules


def run_extraction(pdf_dir: Path | None = None) -> dict:
    pdf_path = discover_pdf(pdf_dir)
    if not pdf_path:
        print(f"Warning: {GRAMMAR_PDF} not found")
        return {"rules": 0, "tables": 0}

    print(f"Extracting grammar: {pdf_path.name}")
    text = extract_pdf_text(pdf_path)
    (LEXIKA_DIR / "_extract" / "grammar_est.txt").write_text(text, encoding="utf-8")

    tables = extract_declension_tables(text)
    rules = extract_grammar_rules(text)

    WEB_CONTENT.mkdir(parents=True, exist_ok=True)
    (WEB_CONTENT / "declension_tables.json").write_text(
        json.dumps({"tables": tables}, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    grammar_rules_path = LEXIKA_DIR / "grammar_rules.json"
    grammar_rules_path.write_text(
        json.dumps({"rules": rules}, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"  Declension table groups: {sum(1 for v in tables.values() if v)}")
    print(f"  Grammar rules: {len(rules)}")
    return {"rules": len(rules), "tables": len(tables)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract grammar rules from Ε-ΣΤ PDF")
    parser.add_argument("--pdf-dir", type=Path, default=None)
    args = parser.parse_args()
    stats = run_extraction(args.pdf_dir)
    print(f"Done: {stats}")


if __name__ == "__main__":
    main()
