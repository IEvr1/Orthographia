# -*- coding: utf-8 -*-
"""Extract ending-contrast pairs from the PDF and compare with app drills."""
import json
import re
import sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"c:\AI_apps\Orthographia\_pdf_extract.txt"
DRILLS = r"c:\AI_apps\Orthographia\scripts\orthografia-app\web\public\content\drills.json"
OUT = r"c:\AI_apps\Orthographia\_endings_compare.json"

text = open(PDF, encoding="utf-8").read()
data = json.load(open(DRILLS, encoding="utf-8"))
drills = data["drills"]

# --- App ending rules ---
ending_kinds = {"ending", "binary", "infix", "article", "cloze", "choice", "homophone"}
app_by_rule = defaultdict(list)
for d in drills:
    if d["kind"] in ending_kinds:
        app_by_rule[d["ruleId"]].append(d)

app_rules = {}
for rid, items in app_by_rule.items():
    opts = Counter()
    for i in items:
        for o in i.get("options") or []:
            opts[o] += 1
    # also collect answers
    ans = Counter(i["answer"] for i in items)
    app_rules[rid] = {
        "count": len(items),
        "grades": sorted({g for i in items for g in i["grades"]}),
        "kinds": dict(Counter(i["kind"] for i in items)),
        "top_options": opts.most_common(12),
        "sample_instruction": items[0].get("instruction", ""),
        "sample_prompt": items[0].get("prompt", ""),
        "sample_feedback": items[0].get("feedback", ""),
    }

# --- PDF ending contrasts from explicit instructions ---
# Normalize to sets of ending strings
pdf_pairs = []

def add(label, endings, evidence):
    norm = tuple(sorted({e.strip("-– ").lower() for e in endings if e.strip()}))
    if not norm:
        return
    pdf_pairs.append({
        "label": label,
        "endings": list(norm),
        "evidence": evidence[:120],
    })

# Explicit patterns in instructions
instr_res = [
    (r"κατάληξη\s*-?ο\s*ή\s*-?ω", ["ο", "ω"]),
    (r"καταλήξεις\s*-?ο\s*και\s*-?ω", ["ο", "ω"]),
    (r"καταλήξεις\s*σε\s*-?ο\s*και\s*-?ω", ["ο", "ω"]),
    (r"-ο/-ω", ["ο", "ω"]),
    (r"-ο\s*και\s*-ω", ["ο", "ω"]),
    (r"κατάληξη\s*-?ι\s*ή\s*-?η", ["ι", "η"]),
    (r"καταλήξεις\s*-?ι\s*και\s*-?η", ["ι", "η"]),
    (r"καταλήξεις\s*σε\s*-?ι\s*και\s*-?η", ["ι", "η"]),
    (r"κατάληξη του ουσιαστικού \(η ή ι\)", ["η", "ι"]),
    (r"κατάληξη \(η ή ι\)", ["η", "ι"]),
    (r"κατάληξη \(η, ι ή ει\)", ["η", "ι", "ει"]),
    (r"καταλήξεις\s*-?ει\s*και\s*-?ι", ["ει", "ι"]),
    (r"καταλήξεις\s*σε\s*-?ι\s*και\s*-?υ", ["ι", "υ"]),
    (r"κατάληξη\s*-?ος", ["ος"]),
    (r"καταλήξεις\s*-?οι\s*ή\s*-?εις", ["οι", "εις"]),
    (r"κατάληξη \(-οι / -ει\)", ["οι", "ει"]),
    (r"κατάληξη -αι ή -ε", ["αι", "ε"]),
    (r"κατάληξη \(αι, ει ή ω\)", ["αι", "ει", "ω"]),
    (r"κατάληξη \(α ή ες\)", ["α", "ες"]),
    (r"-αίνω ή -ένω", ["αίνω", "ένω"]),
    (r"-σε ή -σαι", ["σε", "σαι"]),
    (r"-τε/-ται", ["τε", "ται"]),
    (r"-τε ή -ται", ["τε", "ται"]),
    (r"Καταλήξεις σε -ται/-τε", ["ται", "τε"]),
    (r"Καταλήξεις -τε/-ται", ["τε", "ται"]),
    (r"-ήστε, -ίστε και -είστε", ["ήστε", "ίστε", "είστε"]),
    (r"-ισσα, -ησα ή -ισα", ["ισσα", "ησα", "ισα"]),
    (r"-ειο ή -ιο", ["ειο", "ιο"]),
    (r"-ποιος, -ποιώ, ποιείο, -ποίηση", ["ποιος", "ποιώ", "ποιείο", "ποίηση"]),
    (r"-ο/-ω στις ενεργητικές μετοχές", ["ο", "ω"]),
    (r"η/ι/ει/οι/υ στα παρακάτω επίθετα", ["η", "ι", "ει", "οι", "υ"]),
    (r"η/υ/ι/ει/οι στα παρακάτω ρήματα", ["η", "υ", "ι", "ει", "οι"]),
    (r"η, ι, ει, οι, υ που λείπει από το ρήμα", ["η", "ι", "ει", "οι", "υ"]),
    (r"η, υ, ι, ει ή οι στα ρήματα του Αορίστου", ["η", "υ", "ι", "ει", "οι"]),
    (r"η/ι/η/υ/ει/οι στα παρακάτω ρήματα", ["η", "ι", "υ", "ει", "οι"]),
]

seen_keys = set()
unique_pairs = []
for pat, ends in instr_res:
    for m in re.finditer(pat, text, re.I):
        key = tuple(sorted(e.lower() for e in ends))
        # keep unique by ending set
        evidence = re.sub(r"\s+", " ", text[max(0, m.start() - 30): m.end() + 40])
        if key not in seen_keys:
            seen_keys.add(key)
            unique_pairs.append({
                "endings": list(key),
                "label": " / ".join(f"-{e}" for e in key),
                "evidence": evidence[:140],
                "occurrences": 1,
            })
        else:
            for up in unique_pairs:
                if tuple(up["endings"]) == key:
                    up["occurrences"] += 1

# Also scan Task Box TOC lines for ending pairs
toc = re.findall(
    r"καταλήξεις[^\n]{0,80}",
    text,
    re.I,
)
toc_pairs = Counter()
for t in toc:
    t2 = re.sub(r"\s+", " ", t)
    m = re.search(r"-\s*([α-ωάέήίόύώϊϋ]+)\s*(?:και|/|ή)\s*-?\s*([α-ωάέήίόύώϊϋ]+)", t2, re.I)
    if m:
        key = tuple(sorted([m.group(1).lower(), m.group(2).lower()]))
        toc_pairs[key] += 1
    m3 = re.search(
        r"-\s*([α-ωάέήίόύώ]+)\s*,\s*-?\s*([α-ωάέήίόύώ]+)\s*(?:και|ή)\s*-?\s*([α-ωάέήίόύώ]+)",
        t2,
        re.I,
    )
    if m3:
        key = tuple(sorted([m3.group(1).lower(), m3.group(2).lower(), m3.group(3).lower()]))
        toc_pairs[key] += 1

# Map PDF ending sets to app ruleIds by option overlap
def normalize_opt(o):
    return o.strip().strip("-–").lower()

def match_app(endings):
    ends = {normalize_opt(e) for e in endings}
    scored = []
    for rid, meta in app_rules.items():
        opts = {normalize_opt(o) for o, _ in meta["top_options"]}
        # also look at all options from items
        all_opts = set()
        for i in app_by_rule[rid]:
            for o in i.get("options") or []:
                all_opts.add(normalize_opt(o))
            all_opts.add(normalize_opt(i["answer"]))
        inter = ends & all_opts
        # score: Jaccard-ish favoring containment
        if not inter:
            continue
        score = len(inter) / max(len(ends), 1)
        # bonus if options mostly match
        if ends <= all_opts:
            score += 1.0
        if all_opts <= ends or ends <= all_opts:
            score += 0.5
        scored.append((score, rid, sorted(inter), sorted(all_opts)))
    scored.sort(reverse=True)
    return scored[:5]

matched = []
missing = []
for up in unique_pairs:
    hits = match_app(up["endings"])
    best = hits[0] if hits else None
    row = {
        **up,
        "app_matches": [
            {"ruleId": rid, "score": round(sc, 2), "overlap": ov, "app_options": opts}
            for sc, rid, ov, opts in hits
        ],
    }
    # Consider covered if best score >= 1.0 (endings subset of app options) or strong overlap
    covered = bool(best and best[0] >= 1.0)
    # special: single ending -ος might match many
    if covered:
        matched.append(row)
    else:
        missing.append(row)

# Print report
print("=" * 70)
print("PDF ENDING CONTRASTS (unique)")
print("=" * 70)
for up in sorted(unique_pairs, key=lambda x: (-x["occurrences"], x["label"])):
    print(f"  {up['label']:30s}  x{up['occurrences']:3d}  e.g. {up['evidence'][:80]}")

print("\n" + "=" * 70)
print(f"APP ENDING RULES ({len(app_rules)})")
print("=" * 70)
for rid, meta in sorted(app_rules.items(), key=lambda x: -x[1]["count"]):
    opts = ", ".join(f"{o}({c})" for o, c in meta["top_options"][:8])
    print(f"  {meta['count']:4d}  {rid:45s}  grades={meta['grades']}  opts=[{opts}]")
    print(f"        instr: {meta['sample_instruction'][:70]}")

print("\n" + "=" * 70)
print("COVERAGE")
print("=" * 70)
print(f"PDF unique ending sets: {len(unique_pairs)}")
print(f"Likely covered in app:  {len(matched)}")
print(f"Likely MISSING in app:  {len(missing)}")

print("\n--- MISSING / WEAK ---")
for row in missing:
    print(f"\n  PDF: {row['label']}  (x{row['occurrences']})")
    print(f"  evidence: {row['evidence']}")
    if row["app_matches"]:
        for m in row["app_matches"][:3]:
            print(f"    ~ {m['ruleId']} score={m['score']} overlap={m['overlap']} app={m['app_options'][:8]}")
    else:
        print("    (no option overlap with any ending drill rule)")

print("\n--- COVERED ---")
for row in matched:
    best = row["app_matches"][0]
    print(f"  {row['label']:30s} -> {best['ruleId']} (score={best['score']})")

# TOC pairs not in unique
print("\n--- TOC pairs ---")
for key, n in toc_pairs.most_common():
    print(f"  {' / '.join('-'+e for e in key)}  x{n}")

result = {
    "pdf_unique_pairs": unique_pairs,
    "app_rules": {k: {**v, "top_options": v["top_options"]} for k, v in app_rules.items()},
    "missing": missing,
    "matched": matched,
    "toc_pairs": [{"endings": list(k), "n": n} for k, n in toc_pairs.most_common()],
}
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\nWrote {OUT}")
