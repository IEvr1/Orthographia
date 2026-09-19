#!/usr/bin/env python3
import json
from collections import defaultdict
from pathlib import Path

report = json.loads(Path("hint_validation_report.json").read_text(encoding="utf-8"))

lines: list[str] = []
for key in sorted(
    {
        iss.split("=")[0].split(":")[0]
        for item in report["issues"]
        for iss in item["issues"]
    }
):
    items = [i for i in report["issues"] if any(key in x for x in i["issues"])]
    lines.append(f"\n=== {key} ({len(items)}) ===")
    for i in items:
        lines.append(f"  {i['id']} | {i['word']} | {i['hint']}")

Path("issues_summary.txt").write_text("\n".join(lines), encoding="utf-8")
