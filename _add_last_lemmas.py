# -*- coding: utf-8 -*-
"""Add last 7 missing PDF lemmas + refresh review canvas."""
from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(r"c:\AI_apps\Orthographia")
LEXIKA = ROOT / "scripts" / "orthografia-app" / "content-pipeline" / "inputs" / "lexika"
WORDS = ROOT / "scripts" / "orthografia-app" / "web" / "public" / "content" / "words.json"
AUDIO = ROOT / "scripts" / "orthografia-app" / "web" / "public" / "content" / "audio"
CANVAS = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases\mathima-verbs-review.canvas.tsx"
)
# Reuse verbs canvas pattern but for final lemmas — better a combined leftover canvas
CANVAS2 = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases\mathima-last-lemmas-review.canvas.tsx"
)

ITEMS = [
    ("απόστολος", 4, 2, "noun", "Ο ___ ταξίδεψε σε πολλές χώρες."),
    ("Γιάννης", 2, 1, "noun", "Ο ___ είναι ο καλύτερός μου φίλος."),
    ("θεός", 3, 1, "noun", "Στην αρχαία Ελλάδα πίστευαν σε κάθε ___."),
    ("ουσιαστικό", 4, 2, "noun", "Η λέξη «τραπέζι» είναι ___."),
    ("παγώνι", 3, 1, "noun", "Το ___ άνοιξε την ουρά του."),
    ("πεπόνι", 2, 1, "noun", "Το καλοκαίρι τρώω γλυκό ___."),
    ("πρωινό", 2, 1, "noun", "Το ___ μου είναι γάλα και ψωμί."),
]


def de(s: str) -> str:
    s = unicodedata.normalize("NFC", s.strip()).lower()
    return s.translate(
        str.maketrans("άέήίόύώΆΈΉΊΌΎΏϊΐϋΰΪΫ", "αεηιουωΑΕΗΙΟΥΩιιυυΙΥ")
    )


def main() -> None:
    data = json.loads(WORDS.read_text(encoding="utf-8"))
    existing = {de(w["word"]) for w in data["words"]}

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
    to_add = []
    for word, grade, diff, pos, hint in ITEMS:
        if de(word) in existing:
            print("skip", word)
            continue
        to_add.append(
            {
                "word": word,
                "grade": grade,
                "pos": pos,
                "hint": hint,
                "definition": "",
                "family": "",
                "synonyms": "",
                "source": "mathima-orthografias-lemmas",
                "difficulty": diff,
            }
        )

    by_g: dict[int, list] = defaultdict(list)
    for r in to_add:
        by_g[r["grade"]].append(r)

    for grade, rows in by_g.items():
        path = LEXIKA / f"mathima_g{grade}.csv"
        existing_rows = []
        if path.exists():
            with path.open(encoding="utf-8-sig", newline="") as f:
                existing_rows = list(csv.DictReader(f))
        keys = {de(r["word"]) for r in existing_rows if r.get("word")}
        new_rows = [r for r in rows if de(r["word"]) not in keys]
        with path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for r in existing_rows:
                w.writerow({k: r.get(k, "") for k in fieldnames})
            for r in new_rows:
                w.writerow({k: r[k] for k in fieldnames})
        print(f"g{grade}: +{len(new_rows)}")

    # import
    sys.path.insert(0, str(ROOT / "scripts" / "orthografia-app" / "content-pipeline"))
    from import_helexkids import write_words
    from import_lexika import append_lexika

    words = data["words"]
    before = len(words)
    words, counts, imported = append_lexika(words)
    print(f"import {before} -> {len(words)} (+{imported})")

    # fix ids for new batch
    new_set = {r["word"] for r in to_add}
    max_n: dict[int, int] = defaultdict(int)
    for w in words:
        if w["word"] in new_set:
            continue
        m = re.match(r"lx-g(\d+)-(\d+)$", w["id"])
        if m:
            g, n = int(m.group(1)), int(m.group(2))
            max_n[g] = max(max_n[g], n)
    used = {w["id"] for w in words if w["word"] not in new_set}
    counters = dict(max_n)
    for w in words:
        if w["word"] not in new_set:
            continue
        g = int(w["grade"])
        counters[g] = counters.get(g, 0) + 1
        nid = f"lx-g{g}-{counters[g]:04d}"
        while nid in used:
            counters[g] += 1
            nid = f"lx-g{g}-{counters[g]:04d}"
        used.add(nid)
        w["id"] = nid

    write_words(words)
    print("ids fixed, words saved")

    # canvas rows
    by_w = {w["word"]: w for w in words}
    rows = []
    for r in to_add:
        w = by_w[r["word"]]
        fname = (w.get("audioFile") or "").split("/")[-1]
        rows.append(
            {
                "word": r["word"],
                "grade": r["grade"],
                "hint": w.get("hintSentence") or r["hint"],
                "pos": r["pos"],
                "id": w["id"],
                "audio": fname,
                "audioOk": bool(fname),  # updated after TTS
            }
        )

    Path(r"c:\AI_apps\Orthographia\_last_lemmas_review.json").write_text(
        json.dumps({"added": rows}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("added:", [r["word"] for r in to_add])


if __name__ == "__main__":
    main()
