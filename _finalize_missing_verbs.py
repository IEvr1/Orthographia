# -*- coding: utf-8 -*-
"""Final clean verb gap report for user."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

data = json.loads(Path(r"c:\AI_apps\Orthographia\_missing_verbs.json").read_text(encoding="utf-8"))
# Support both old and new schema
missing = data.get("missing") or data.get("missing_lemmas") or []
pdf_count = data.get("pdf_count") or data.get("pdf_verb_count")
present_count = data.get("present_count") or data.get("present")

words = json.loads(
    Path(r"c:\AI_apps\Orthographia\scripts\orthografia-app\web\public\content\words.json").read_text(
        encoding="utf-8"
    )
)["words"]
app = {w["word"].lower() for w in words}


def de(s: str) -> str:
    return s.lower().translate(str.maketrans("άέήίόύώϊΐϋΰ", "αεηιουωιιυυ"))


app_de = {de(w) for w in app}


def has(form: str) -> bool:
    return form.lower() in app or de(form) in app_de


PERFECTIVE_TO_LEMMA = {
    "αλλάξω": "αλλάζω",
    "βάλω": "βάζω",
    "διαβάσω": "διαβάζω",
    "δοκιμάσω": "δοκιμάζω",
    "έρθω": "έρχομαι",
    "κάτσω": "κάθομαι",
    "κοιμηθώ": "κοιμάμαι",
    "κουρέψω": "κουρεύω",
    "λύσω": "λύνω",
    "πέσω": "πέφτω",
    "σήκω": "σηκώνω",
    "τηλεφωνήσω": "τηλεφωνώ",
    "φύγω": "φεύγω",
}
WRONG_TO_CORRECT = {
    "αμφιβάλω": "αμφιβάλλω",
    "καταβάλω": "καταβάλλω",
    "εποφελούμαι": "επωφελούμαι",
    "πάτω": "πατώ",
    "φελούμαι": "ωφελούμαι",
    "φελώ": "ωφελώ",
}
RELATED_IN_APP = {
    "γυρνώ": "γυρίζω",
    "βρίσκομαι": "βρίσκω",
    "σκουπίζομαι": "σκουπίζω",
}

lemmas: set[str] = set()
notes: list[str] = []

for w in missing:
    if w in PERFECTIVE_TO_LEMMA:
        lem = PERFECTIVE_TO_LEMMA[w]
        if not has(lem):
            lemmas.add(lem)
        notes.append(f"{w} (αόριστος/υποτακτική → {lem})")
        continue
    if w in WRONG_TO_CORRECT:
        cor = WRONG_TO_CORRECT[w]
        if not has(cor):
            lemmas.add(cor)
        else:
            notes.append(f"{w} λάθος γραφή · σωστό {cor} υπάρχει")
        continue
    if w in RELATED_IN_APP and has(RELATED_IN_APP[w]):
        notes.append(f"{w} · σχετικό στο app: {RELATED_IN_APP[w]}")
        continue
    lemmas.add(w)

lemmas_sorted = sorted(lemmas, key=de)

groups = {
    "Συχνά βασικά": [],
    "-αίνω/-ένω": [],
    "-ποιώ family": [],
    "Μέση/παθητική": [],
    "Συνηρημένα σε -ώ": [],
    "βάλλω family": [],
    "Άλλα": [],
}
basic = {
    "θέλω", "πίνω", "έρχομαι", "φεύγω", "πέφτω", "μπορώ", "φέρνω", "ρίχνω",
    "σβήνω", "λύνω", "δένω", "νομίζω", "προσέχω", "συμφωνώ", "ψάχνω", "φτιάχνω",
    "σηκώνω", "αλλάζω",
}
for w in lemmas_sorted:
    d = de(w)
    if w in basic:
        groups["Συχνά βασικά"].append(w)
    elif d.endswith(("αινω", "ενω")) or w in {"ξερνώ", "χορταίνω"}:
        groups["-αίνω/-ένω"].append(w)
    elif "ποι" in d:
        groups["-ποιώ family"].append(w)
    elif d.endswith(("ομαι", "ουμαι", "αμαι", "ιεμαι", "εμαι")):
        groups["Μέση/παθητική"].append(w)
    elif w.endswith("ώ") and not d.endswith(("ομαι", "ουμαι")):
        groups["Συνηρημένα σε -ώ"].append(w)
    elif "βαλλ" in d or w == "βάλλω":
        groups["βάλλω family"].append(w)
    else:
        groups["Άλλα"].append(w)

print(f"Ρήματα λ.τ. στο PDF: {pdf_count}")
print(f"Ήδη στο app: {present_count}")
print(f"Λείπουν λήμματα: {len(lemmas_sorted)}")
print()
for title, items in groups.items():
    if not items:
        continue
    print(f"{title} ({len(items)}):")
    print("  " + ", ".join(items))
    print()
print("Σημειώσεις (όχι ξεχωριστά κενά ή ήδη καλυμμένα):")
for n in notes:
    print(" -", n)

Path(r"c:\AI_apps\Orthographia\_missing_verbs.json").write_text(
    json.dumps(
        {
            "pdf_count": pdf_count,
            "present_count": present_count,
            "missing_lemmas": lemmas_sorted,
            "groups": {k: v for k, v in groups.items() if v},
            "notes": notes,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
Path(r"c:\AI_apps\Orthographia\_missing_verbs.txt").write_text(
    "\n".join(
        [f"Λείπουν {len(lemmas_sorted)} ρήματα-λήμματα από το PDF", ""]
        + [f"{k}: {', '.join(v)}" for k, v in groups.items() if v]
    ),
    encoding="utf-8",
)
