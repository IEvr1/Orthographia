# -*- coding: utf-8 -*-
"""Fix duplicate lx-g* ids for newly imported mathima verbs."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

WEB = Path(r"c:\AI_apps\Orthographia\scripts\orthografia-app\web\public\content\words.json")
REVIEW = Path(r"c:\AI_apps\Orthographia\_mathima_verbs_review.json")

data = json.loads(WEB.read_text(encoding="utf-8"))
words = data["words"]
new_set = {r["word"] for r in json.loads(REVIEW.read_text(encoding="utf-8"))["added"]}

max_n: dict[int, int] = defaultdict(int)
seen_first: set[str] = set()
for w in words:
    m = re.match(r"lx-g(\d+)-(\d+)$", w["id"])
    if not m:
        continue
    g, n = int(m.group(1)), int(m.group(2))
    if w["id"] not in seen_first and w["word"] not in new_set:
        seen_first.add(w["id"])
        max_n[g] = max(max_n[g], n)

print("max among old words:", dict(max_n))

counters = dict(max_n)
used = {w["id"] for w in words if w["word"] not in new_set}
fixed = 0
for w in words:
    if w["word"] not in new_set:
        continue
    g = int(w["grade"])
    counters[g] = counters.get(g, 0) + 1
    new_id = f"lx-g{g}-{counters[g]:04d}"
    while new_id in used:
        counters[g] += 1
        new_id = f"lx-g{g}-{counters[g]:04d}"
    used.add(new_id)
    w["id"] = new_id
    fixed += 1

dups = [i for i, c in Counter(w["id"] for w in words).items() if c > 1]
print(f"renumbered {fixed}; remaining dups={len(dups)}")
print("sample:", [(w["id"], w["word"]) for w in words if w["word"] in new_set][:8])

if "version" in data:
    data["version"] = int(data.get("version") or 1) + 1
WEB.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("saved", WEB)
