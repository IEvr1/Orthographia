# -*- coding: utf-8 -*-
import csv
import json
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(r"c:\AI_apps\Orthographia")
words = json.loads(
    (ROOT / "scripts/orthografia-app/web/public/content/words.json").read_text(
        encoding="utf-8"
    )
)["words"]
audio_dir = ROOT / "scripts/orthografia-app/web/public/content/audio"

mathima = set()
for p in (ROOT / "scripts/orthografia-app/content-pipeline/inputs/lexika").glob(
    "mathima_g*.csv"
):
    for r in csv.DictReader(p.open(encoding="utf-8-sig")):
        mathima.add(r["word"].lower())

entries = [w for w in words if w["word"].lower() in mathima]
print("count", len(entries))

TEMPLATES = (
    "Συμπληρώνουμε με τη λέξη ___.",
    "Στην πρόταση γράφουμε το ρήμα ___.",
    "Συμπληρώνουμε με το επίθετο ___.",
)

generic = []
no_blank = []
leaks = []
no_audio = []
hint_counts: Counter[str] = Counter()

for e in entries:
    h = e.get("hintSentence", "")
    hint_counts[h] += 1
    if "___" not in h:
        no_blank.append(e)
    if h in TEMPLATES or h.startswith("Συμπληρώνουμε με") or h.startswith(
        "Στην πρόταση γράφουμε"
    ):
        generic.append(e)
    wl = e["word"].lower()
    hl = h.lower().replace("___", "")
    if wl in hl:
        leaks.append(e)
    ap = audio_dir / Path(e["audioFile"]).name
    if not ap.exists() or ap.stat().st_size < 500:
        no_audio.append(
            (
                e["word"],
                e["audioFile"],
                ap.exists(),
                ap.stat().st_size if ap.exists() else 0,
            )
        )

print("generic_or_template", len(generic))
print("no_blank", len(no_blank))
print("leaks", len(leaks))
print("no_audio", len(no_audio))
print("unique_hints", len(hint_counts))
print("top hints:")
for h, c in hint_counts.most_common(8):
    print(c, "|", h)

contextual = [e for e in entries if e not in generic]
print("contextual_count", len(contextual))
for e in contextual[:20]:
    print(f"  g{e['grade']} {e['word']}: {e['hintSentence']}")

out = []
for e in sorted(entries, key=lambda x: (x["grade"], x["word"].lower())):
    h = e.get("hintSentence", "")
    is_gen = (
        h in TEMPLATES
        or h.startswith("Συμπληρώνουμε με τη λέξη")
        or h.startswith("Συμπληρώνουμε με το επίθετο")
        or h.startswith("Στην πρόταση γράφουμε το ρήμα")
        or (len(h) < 50 and "___" in h)
    )
    ap = audio_dir / Path(e["audioFile"]).name
    out.append(
        {
            "word": e["word"],
            "grade": e["grade"],
            "hint": h,
            "generic": is_gen,
            "audio": Path(e["audioFile"]).name,
            "audioOk": ap.exists() and ap.stat().st_size >= 500,
            "difficulty": e.get("difficulty", 1),
            "id": e["id"],
        }
    )

(ROOT / "_mathima_hints_review.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print("wrote", len(out))
print("generic flag", sum(1 for x in out if x["generic"]))
print("audio ok", sum(1 for x in out if x["audioOk"]))
