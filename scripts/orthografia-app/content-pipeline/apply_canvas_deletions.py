#!/usr/bin/env python3
"""Apply canvas «Διαγραφή επιλεγμένων» to textbook CSVs.

Canvas delete only updates *.canvas.data.json (UI state). This script removes
those lemmas from inputs/textbooks/gradeN.csv (+ analysis.json) so they are
not imported into words.json / the app DB.

Usage:
  python apply_canvas_deletions.py --grade 4
  python apply_canvas_deletions.py --grade all
  python apply_canvas_deletions.py --grade 3 --dry-run
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent
TEXTBOOKS = PIPELINE / "inputs" / "textbooks"
CANVAS_DIR = Path.home() / ".cursor" / "projects" / "c-AI-apps-Orthographia" / "canvases"

GRADE_CANVAS = {
    2: "grade2-spelling-words",
    3: "grade3-spelling-words",
    4: "grade4-spelling-words",
    5: "grade5-spelling-words",
    6: "grade6-spelling-words",
}


def load_deleted(stem: str) -> list[str]:
    path = CANVAS_DIR / f"{stem}.canvas.data.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    deleted = data.get("deleted") or []
    # preserve order, unique
    seen: set[str] = set()
    out: list[str] = []
    for w in deleted:
        if w and w not in seen:
            seen.add(w)
            out.append(w)
    return out


def filter_csv(csv_path: Path, remove: set[str], dry_run: bool) -> tuple[int, int]:
    if not csv_path.exists():
        print(f"  skip missing CSV {csv_path.name}")
        return 0, 0
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys()) if rows else [
            "word",
            "grade",
            "pos",
            "frequency",
            "hint",
            "explanation",
            "source",
        ]
    kept = [r for r in rows if (r.get("word") or "") not in remove]
    removed_n = len(rows) - len(kept)
    if dry_run:
        return len(rows), removed_n
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(kept)
    return len(rows), removed_n


def filter_analysis(path: Path, remove: set[str], dry_run: bool) -> int:
    if not path.exists():
        return 0
    data = json.loads(path.read_text(encoding="utf-8"))
    words = data.get("words") or []
    kept = [w for w in words if (w.get("word") or "") not in remove]
    removed_n = len(words) - len(kept)
    if dry_run or removed_n == 0:
        return removed_n
    data["words"] = kept
    data["total"] = len(kept)
    data["with_explanation"] = sum(1 for w in kept if (w.get("expl") or "").strip())
    data["explicit_spelling"] = sum(1 for w in kept if w.get("ex"))
    # light recount categories / phenomena / sources if present
    for key, field in (
        ("categories", "cat"),
        ("phenomena", "ph"),
        ("sources", "source"),
    ):
        if key in data:
            counts: dict[str, int] = {}
            for w in kept:
                v = (w.get(field) or "").strip()
                if v:
                    counts[v] = counts.get(v, 0) + 1
            data[key] = counts
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return removed_n


def clear_canvas_deleted(stem: str, dry_run: bool) -> None:
    """After applying, clear deleted (+ selected) so state matches CSV."""
    path = CANVAS_DIR / f"{stem}.canvas.data.json"
    if not path.exists() or dry_run:
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    data["deleted"] = []
    data["selected"] = []
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_grade(grade: int, dry_run: bool, clear_state: bool) -> int:
    stem = GRADE_CANVAS[grade]
    deleted = load_deleted(stem)
    print(f"=== Grade {grade} ({stem})")
    if not deleted:
        print("  no deletions in canvas state")
        return 0
    print(f"  canvas deleted ({len(deleted)}): {', '.join(deleted[:12])}"
          + ("…" if len(deleted) > 12 else ""))
    remove = set(deleted)
    before, removed = filter_csv(TEXTBOOKS / f"grade{grade}.csv", remove, dry_run)
    ar = filter_analysis(TEXTBOOKS / f"grade{grade}_analysis.json", remove, dry_run)
    print(f"  CSV: {before} → {before - removed} (−{removed})"
          + (" [dry-run]" if dry_run else ""))
    if (TEXTBOOKS / f"grade{grade}_analysis.json").exists():
        print(f"  analysis words removed: {ar}" + (" [dry-run]" if dry_run else ""))
    if removed < len(deleted):
        print(f"  note: {len(deleted) - removed} canvas deletion(s) were not in CSV")
    if clear_state and not dry_run and removed:
        clear_canvas_deleted(stem, dry_run=False)
        print("  cleared canvas deleted/selected state")
        print("  rebuild canvas if you want WORDS to match CSV:")
        print(f"    (ask agent or re-run extract --canvas-only for grade {grade})")
    return removed


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--grade",
        default="all",
        help="2–6 or all (default all)",
    )
    p.add_argument("--dry-run", action="store_true", help="Show what would be removed")
    p.add_argument(
        "--keep-state",
        action="store_true",
        help="Do not clear canvas deleted[] after applying",
    )
    args = p.parse_args()
    if args.grade == "all":
        grades = list(GRADE_CANVAS)
    else:
        grades = [int(args.grade)]
        for g in grades:
            if g not in GRADE_CANVAS:
                raise SystemExit(f"Unsupported grade {g}")

    total = 0
    for g in grades:
        total += apply_grade(g, dry_run=args.dry_run, clear_state=not args.keep_state)
    print(f"Done. Removed {total} CSV row(s)." + (" (dry-run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
