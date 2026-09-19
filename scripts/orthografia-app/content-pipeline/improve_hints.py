#!/usr/bin/env python3
"""Batch-improve hintSentence and homophone flags in words.json."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fix_hints import fix_words
from hint_generator import enrich_entry, is_generic_hint, load_overrides
from import_helexkids import OUTPUT, WEB_WORDS, write_words

PIPELINE = Path(__file__).resolve().parent


def improve_words(
    words: list[dict],
    *,
    overrides: dict | None = None,
    only_generic: bool = True,
) -> tuple[list[dict], dict[str, int]]:
    overrides = overrides or load_overrides()
    stats = {"hints_improved": 0, "homophone_marked": 0, "skipped_good": 0, "total": len(words)}

    updated: list[dict] = []
    for index, entry in enumerate(words):
        was_generic = is_generic_hint(entry.get("hintSentence", ""))
        new_entry, hint_changed, homophone_changed = enrich_entry(
            entry,
            overrides=overrides,
            force=False,
            index=index,
        )
        if hint_changed:
            stats["hints_improved"] += 1
        elif not was_generic:
            stats["skipped_good"] += 1
        if homophone_changed and new_entry.get("homophone"):
            stats["homophone_marked"] += 1
        updated.append(new_entry)

    return updated, stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Improve generic hints in words.json")
    parser.add_argument("--dry-run", action="store_true", help="Show stats without writing")
    parser.add_argument("--force-all", action="store_true", help="Replace all hints, not only generic")
    args = parser.parse_args()

    source = WEB_WORDS if WEB_WORDS.exists() else OUTPUT
    payload = json.loads(source.read_text(encoding="utf-8"))
    words = payload["words"]

    improved, stats = improve_words(words, only_generic=not args.force_all)
    improved, fix_stats = fix_words(improved)
    stats["final_fixes"] = fix_stats["changed"]

    print(f"Processed {stats['total']} words")
    print(f"Hints improved: {stats['hints_improved']}")
    print(f"Homophone marked: {stats['homophone_marked']}")
    print(f"Skipped (already good): {stats['skipped_good']}")
    print(f"Final hint fixes: {stats['final_fixes']}")

    if args.dry_run:
        return

    write_words(improved)
    print(f"Wrote {len(improved)} words -> {OUTPUT}")
    print(f"Synced to {WEB_WORDS}")


if __name__ == "__main__":
    main()
