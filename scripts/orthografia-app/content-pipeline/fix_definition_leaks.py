"""Fix definitions that leak the headword (breaks matching exercises).

Updates source CSVs and patches web/public/content/words.json in place.
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
WEB_WORDS = PIPELINE.parent / "web" / "public" / "content" / "words.json"
OUT_WORDS = PIPELINE / "outputs" / "words.json"

# id → new definition (empty string clears definition — exclude from matching)
BY_ID: dict[str, str] = {
    # textbooks
    "tb-g2-0220": "Το γραπτό που διαβάζουμε.",
    "tb-g2-0231": "Ιστορία με φαντασία για παιδιά.",
    "tb-g3-0011": "Έξυπνος με δόλο· σκέφτεται κόλπα.",
    "tb-g3-0027": "Πολύ δυνατό κρύο.",
    "tb-g3-0142": "Πόλη στην Ιταλία με κανάλια.",
    "tb-g3-0304": "Ρήμα ύπαρξης· α΄ ενικό πρόσωπο.",
    # lexika G2
    "lx-g2-0113": "Κλαυθμός· ήχος όταν κάποιος κλαίει.",
    "lx-g2-0153": "Κόστος· τιμητική αναγνώριση.",
    # lexika G4 — were filled cloze fragments, not definitions
    "lx-g4-0006": "Ευγενής συναγωνισμός.",
    "lx-g4-0012": "Επίσημο γραπτό αίτημα.",
    "lx-g4-0033": "Άρνηση να συμβιβαστεί κάποιος.",
    "lx-g4-0042": "Χωρίς τη θέλησή του.",
    "lx-g4-0059": "Δεν είμαι βέβαιος.",
    "lx-g4-0062": "Θρασύτητα· έλλειψη σεβασμού.",
    "lx-g4-0063": "Μετάθεση για αργότερα.",
    "lx-g4-0067": "Προσπάθεια να βρω κάτι.",
    "lx-g4-0096": "",  # "του" — not a usable matching definition
}

# (csv path relative to inputs, word, new definition) for source sync
CSV_FIXES: list[tuple[str, str, str]] = [
    ("textbooks/grade2.csv", "κειμένου", "Το γραπτό που διαβάζουμε."),
    ("textbooks/grade2.csv", "παραμυθιού", "Ιστορία με φαντασία για παιδιά."),
    ("textbooks/grade3.csv", "πονηρός", "Έξυπνος με δόλο· σκέφτεται κόλπα."),
    ("textbooks/grade3.csv", "παγωνιά", "Πολύ δυνατό κρύο."),
    ("textbooks/grade3.csv", "Βενετιά", "Πόλη στην Ιταλία με κανάλια."),
    ("textbooks/grade3.csv", "είμαι", "Ρήμα ύπαρξης· α΄ ενικό πρόσωπο."),
    ("lexika/grade2.csv", "κλάμα", "Κλαυθμός· ήχος όταν κάποιος κλαίει."),
    ("lexika/grade2.csv", "τιμή", "Κόστος· τιμητική αναγνώριση."),
    ("lexika/grade4.csv", "άμιλλα", "Ευγενής συναγωνισμός."),
    ("lexika/grade4.csv", "αίτηση", "Επίσημο γραπτό αίτημα."),
    ("lexika/grade4.csv", "αδιαλλαξία", "Άρνηση να συμβιβαστεί κάποιος."),
    ("lexika/grade4.csv", "ακούσιος", "Χωρίς τη θέλησή του."),
    ("lexika/grade4.csv", "αμφιβάλλω", "Δεν είμαι βέβαιος."),
    ("lexika/grade4.csv", "αναίδεια", "Θρασύτητα· έλλειψη σεβασμού."),
    ("lexika/grade4.csv", "αναβολή", "Μετάθεση για αργότερα."),
    ("lexika/grade4.csv", "αναζήτηση", "Προσπάθεια να βρω κάτι."),
    ("lexika/grade4.csv", "του", ""),
]


def normalize(s: str) -> str:
    s = s.casefold()
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def definition_leaks_word(definition: str, word: str) -> bool:
    w = normalize(word.strip())
    t = normalize(definition.strip())
    if len(w) < 2 or not t:
        return False
    pattern = rf"(?<![a-zα-ω]){re.escape(w)}(?![a-zα-ω])"
    return bool(re.search(pattern, t))


def patch_csv(rel: str, word: str, new_def: str) -> bool:
    path = PIPELINE / "inputs" / rel
    raw = path.read_text(encoding="utf-8-sig")
    rows = list(csv.DictReader(raw.splitlines()))
    if not rows:
        return False
    fieldnames = [f.lstrip("\ufeff") for f in rows[0].keys()]
    # Normalize row keys (strip BOM from first header if present)
    normalized: list[dict[str, str]] = []
    for row in rows:
        normalized.append({(k or "").lstrip("\ufeff"): (v or "") for k, v in row.items()})
    rows = normalized
    def_key = "definition" if "definition" in fieldnames else "explanation"
    if def_key not in fieldnames:
        raise SystemExit(f"No definition column in {path}: {fieldnames}")
    changed = False
    for row in rows:
        if (row.get("word") or "").strip() == word:
            if (row.get(def_key) or "") != new_def:
                row[def_key] = new_def
                changed = True
    if changed:
        with path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
    return changed


def patch_words_json(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    data = json.loads(path.read_text(encoding="utf-8"))
    words = data["words"] if isinstance(data, dict) else data
    patched = 0
    for e in words:
        wid = e.get("id", "")
        if wid not in BY_ID:
            continue
        new_def = BY_ID[wid]
        old = e.get("definition")
        if new_def:
            if old != new_def:
                e["definition"] = new_def
                patched += 1
        else:
            if "definition" in e:
                del e["definition"]
                patched += 1
    remaining = 0
    for e in words:
        d = (e.get("definition") or "").strip()
        w = (e.get("word") or "").strip()
        if d and definition_leaks_word(d, w):
            remaining += 1
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    return patched, remaining


def main() -> None:
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    log: list[str] = []
    csv_changed = 0
    for rel, word, new_def in CSV_FIXES:
        if patch_csv(rel, word, new_def):
            csv_changed += 1
            log.append(f"csv {rel}: {word}")

    for path in (WEB_WORDS, OUT_WORDS):
        patched, remaining = patch_words_json(path)
        log.append(f"{path.name}: patched={patched} remaining_leaks={remaining}")

    log.append(f"csv_files_touched={csv_changed}")
    report = PIPELINE / "fix_definition_leaks_log.txt"
    report.write_text("\n".join(log) + "\n", encoding="utf-8")
    print(f"wrote {report} ({len(log)} lines)")


if __name__ == "__main__":
    main()
