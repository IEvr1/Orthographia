#!/usr/bin/env python3
"""Rebuild grade4 canvas from analysis.json using grade3 UI shell."""
from __future__ import annotations

import json
import re
from pathlib import Path

CANVAS_DIR = Path(r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases")
ANALYSIS = Path(
    r"c:\AI_apps\Orthographia\scripts\orthografia-app\content-pipeline\inputs\textbooks\grade4_analysis.json"
)
OUT = CANVAS_DIR / "grade4-spelling-words.canvas.tsx"
G3 = CANVAS_DIR / "grade3-spelling-words.canvas.tsx"


def js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def word_line(w: dict) -> str:
    return (
        "{word:"
        + js_str(w["word"])
        + ",source:"
        + js_str(w.get("source") or "")
        + ",ph:"
        + js_str(w.get("ph") or "")
        + ",cat:"
        + js_str(w.get("cat") or "")
        + ",ex:"
        + ("true" if w.get("ex") else "false")
        + ",gl:"
        + ("true" if w.get("gl") else "false")
        + ",sent:"
        + js_str(w.get("sent") or "")
        + ",expl:"
        + js_str(w.get("expl") or "")
        + "},"
    )


def main() -> None:
    a = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    words = sorted(a["words"], key=lambda w: w["word"].casefold())
    total = a["total"]
    with_expl = a["with_explanation"]
    explicit = a["explicit_spelling"]

    # Phenomena order like g3 preference
    ph_order = ["ου", "τόνος", "η", "ι-ήχος (ει/οι/υι)", "δίψηφα σύμφωνα"]
    ph = a["phenomena"]
    for k in ph:
        if k not in ph_order:
            ph_order.append(k)
    ph_labels = [k for k in ph_order if k in ph]
    ph_counts = [ph[k] for k in ph_labels]

    src_order = [
        "Τεύχος 1",
        "Τεύχος 2",
        "Τεύχος 3",
        "Τεύχη 1+2",
        "Τεύχη 1+3",
        "Τεύχη 2+3",
        "Και τα τρία",
    ]
    sources = a["sources"]
    src_labels = [k for k in src_order if k in sources]
    src_counts = [sources[k] for k in src_labels]

    len_order = ["4–5", "6–8", "9–11", "12+"]
    lengths = a["lengths"]
    len_labels = [k for k in len_order if k in lengths]
    len_counts = [lengths[k] for k in len_labels]

    cats = a.get("categories") or {}

    def join_cat(cat: str) -> str:
        items = sorted(
            (w["word"] for w in words if w.get("cat") == cat),
            key=lambda x: x.casefold(),
        )
        return " · ".join(items) if items else "—"

    adj_os = join_cat("επίθετο:-ος")
    adj_i = join_cat("επίθετο:-η")
    adj_o = join_cat("επίθετο:-ο")
    adj_is = join_cat("επίθετο:-ης")
    colors = join_cat("χρώμα")
    numbers = join_cat("αριθμός")

    # Antonym pairs present in list (same heuristic as upper extract)
    word_set = {w["word"] for w in words}
    antonym_specs = [
        ("κολλώ", "ξεκολλώ", "ξε-"),
        ("διψώ", "ξεδιψώ", "ξε-"),
        ("μπερδεύω", "ξεμπερδεύω", "ξε-"),
        ("κακός", "άκακος", "ά-"),
        ("γνωστός", "άγνωστος", "ά-"),
        ("κινητός", "ακίνητος", "α-"),
        ("υπάκουος", "ανυπάκουος", "αν-"),
    ]
    antonyms = [
        p for p in antonym_specs if p[0] in word_set and p[1] in word_set
    ]

    words_block = "\n".join(word_line(w) for w in words)
    ant_block = "\n".join(
        "{word:"
        + js_str(w)
        + ",antonym:"
        + js_str(ant)
        + ",prefix:"
        + js_str(pref)
        + "},"
        for w, ant, pref in antonyms
    )

    # Take UI shell from existing g4 after ANTONYMS constants... easier: from g3 and adapt titles
    g3 = G3.read_text(encoding="utf-8")
    # Keep imports + types from g3 through WordRow/AntonymPair
    header = g3.split("const WORDS: WordRow[] = [")[0]

    # UI from g3 export default onward, with replacements
    ui = g3.split("export default function Grade3SpellingWords()")[1]
    ui = "export default function Grade4SpellingWords()" + ui
    ui = ui.replace("Ορθογραφία Γ΄ Δημοτικού", "Ορθογραφία Δ΄ Δημοτικού")
    ui = ui.replace("401 λέξεις", f"{total} λέξεις")
    ui = ui.replace("(Γ΄)", "(Δ΄)")
    ui = ui.replace('value="401"', f'value="{total}"')
    ui = ui.replace('value="82" label="Γράφω σωστά"', f'value="{explicit}" label="Ορθογραφία / ρητά"')
    ui = ui.replace("const withExpl = 49;", f"const withExpl = {with_expl};")
    ui = ui.replace("n = 401", f"n = {total}")
    ui = ui.replace(
        "Πηγή: c_dim_glossa_tefchos_1/2/3_vivlio_mathiti.pdf",
        "Πηγή: d_dim_glossa_tefchos_1/2/3_vivlio_mathiti.pdf",
    )
    ui = ui.replace(
        "Τάξη Γ΄ · αλφαβητική σειρά · χωρίς import στο app ακόμα.",
        "Τάξη Δ΄ · αλφαβητική σειρά · χωρίς import στο app ακόμα.",
    )
    # Fix filter label if g3 only has Γράφω σωστά
    ui = ui.replace('"Γράφω σωστά"', '"Ορθογραφία / ρητά"')
    # matchesFilter in g3 uses Γράφω σωστά - need mid-file constants too

    # Rebuild mid constants from scratch between WORDS and export
    mid = f"""const WORDS: WordRow[] = [
{words_block}
];

const ANTONYMS: AntonymPair[] = [
{ant_block}
].sort((a, b) => a.word.localeCompare(b.word, "el"));

const PHENOMENA = {json.dumps(ph_labels, ensure_ascii=False)};
const PHENOMENON_COUNTS = {ph_counts};
const SOURCE_LABELS = {json.dumps(src_labels, ensure_ascii=False)};
const SOURCE_COUNTS = {src_counts};
const LEN_LABELS = {json.dumps(len_labels, ensure_ascii=False)};
const LEN_COUNTS = {len_counts};

const ADJ_OS = {js_str(adj_os)};
const ADJ_I = {js_str(adj_i)};
const ADJ_O = {js_str(adj_o)};
const ADJ_IS = {js_str(adj_is)};
const COLOR_WORDS = {js_str(colors)};
const NUMBER_WORDS = {js_str(numbers)};

"""

    # Pull FILTERS + helpers from g3 (between NUMBER_WORDS and export)
    helpers = g3.split("const NUMBER_WORDS = ")[1]
    helpers = helpers.split("export default function")[0]
    # drop the NUMBER_WORDS assignment value - we already have constants
    # helpers starts with the string value of NUMBER_WORDS then ;\n\nconst FILTERS
    helpers = "const FILTERS" + helpers.split("const FILTERS", 1)[1]
    helpers = helpers.replace('"Γράφω σωστά"', '"Ορθογραφία / ρητά"')
    helpers = helpers.replace(
        'if (filter === "Γράφω σωστά") return w.ex;',
        'if (filter === "Ορθογραφία / ρητά") return w.ex;',
    )
    # After our replace of filter name in FILTERS array via Γράφω→Ορθογραφία above

    out = header + mid + helpers + ui
    # Normalize newlines to LF
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    OUT.write_text(out, encoding="utf-8", newline="\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {total} words)")


if __name__ == "__main__":
    main()
