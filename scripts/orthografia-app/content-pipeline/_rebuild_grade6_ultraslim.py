#!/usr/bin/env python3
"""Ultra-slim Στ΄ canvas for reliable open (~50KB target)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"c:\AI_apps\Orthographia\scripts\orthografia-app\content-pipeline")
ANALYSIS = ROOT / "inputs" / "textbooks" / "grade6_analysis.json"
OUT = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases"
    r"\grade6-spelling-words.canvas.tsx"
)

def js(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def clean_sent(s: str) -> str:
    """Keep full sentence — never truncate with ..."""
    s = (s or "").strip().replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s)
    return s


def main() -> None:
    words = sorted(
        json.loads(ANALYSIS.read_text(encoding="utf-8"))["words"],
        key=lambda w: w["word"].casefold(),
    )
    total = len(words)
    pages = max(1, (total + 79) // 80)
    lines = []
    for w in words:
        lines.append(
            "{"
            + f"word:{js(w['word'])},"
            + f"source:{js(w.get('source') or '')},"
            + f"ph:{js(w.get('ph') or '')},"
            + f"cat:{js(w.get('cat') or '')},"
            + f"ex:{'true' if w.get('ex') else 'false'},"
            + f"gl:{'true' if w.get('gl') else 'false'},"
            + f"sent:{js(clean_sent(w.get('sent') or ''))},"
            + 'expl:""'
            + "},"
        )
    words_block = "\n".join(lines)

    out = f'''import {{
  Button,
  Callout,
  Checkbox,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Text,
  Table,
  useCanvasState,
}} from "cursor/canvas";

type WordRow = {{
  word: string;
  source: string;
  ph: string;
  cat: string;
  ex: boolean;
  gl: boolean;
  sent: string;
  expl: string;
}};

const WORDS: WordRow[] = [
{words_block}
];

const FILTERS = [
  "Όλα",
  "Ορθογραφία / ρητά",
  "Γλωσσάριο",
  "Μήνας",
  "Ημέρα",
  "Εποχή",
  "Χώρα",
  "Ερωτηματικές",
  "Αντίθετα",
  "Χρώματα",
  "Σχήματα",
  "Τεύχος 1",
  "Τεύχος 2",
  "Τεύχος 3",
  "Τεύχη 1+2",
  "Τεύχη 1+3",
  "Τεύχη 2+3",
  "Και τα τρία",
  "ου",
  "τόνος",
  "η",
  "ι-ήχος (ει/οι/υι)",
  "δίψηφα σύμφωνα",
] as const;

function compareWords(a: string, b: string): number {{
  return a.localeCompare(b, "el", {{ sensitivity: "base" }});
}}

function matchesFilter(w: WordRow, filter: string): boolean {{
  if (filter === "Όλα") return true;
  if (filter === "Ορθογραφία / ρητά") return w.ex;
  if (filter === "Γλωσσάριο") return w.gl || w.cat === "γλωσσάριο";
  if (filter === "Μήνας") return w.cat === "μήνας";
  if (filter === "Ημέρα") return w.cat === "ημέρα";
  if (filter === "Εποχή") return w.cat === "εποχή";
  if (filter === "Χώρα") return w.cat === "χώρα" || w.cat === "ήπειρος";
  if (filter === "Ερωτηματικές") return w.cat === "ερωτηματική";
  if (filter === "Αντίθετα") return w.cat === "αντίθετα";
  if (filter === "Χρώματα") return w.cat === "χρώμα";
  if (filter === "Σχήματα") return w.cat === "σχήμα";
  if (
    filter === "Τεύχος 1" ||
    filter === "Τεύχος 2" ||
    filter === "Τεύχος 3" ||
    filter === "Τεύχη 1+2" ||
    filter === "Τεύχη 1+3" ||
    filter === "Τεύχη 2+3" ||
    filter === "Και τα τρία"
  )
    return w.source === filter;
  return w.ph === filter;
}}

const PAGE_SIZE = 80;

export default function Grade6SpellingWords() {{
  const [filter, setFilter] = useCanvasState<string>("filter", "Όλα");
  const [selected, setSelected] = useCanvasState<string[]>("selected", []);
  const [deleted, setDeleted] = useCanvasState<string[]>("deleted", []);
  const [page, setPage] = useCanvasState<number>("page", 0);

  const deletedSet = new Set(deleted);
  const selectedSet = new Set(selected);

  const active = WORDS.filter((w) => !deletedSet.has(w.word));
  const filtered =
    filter === "Όλα"
      ? active
      : active
          .filter((w) => matchesFilter(w, filter))
          .sort((a, b) => compareWords(a.word, b.word));

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const applyFilter = (next: string) => {{
    setFilter(next);
    setPage(0);
  }};

  const toggleWord = (word: string, checked: boolean) => {{
    if (checked) {{
      if (!selectedSet.has(word)) setSelected([...selected, word]);
    }} else {{
      setSelected(selected.filter((w) => w !== word));
    }}
  }};

  const selectAllVisible = () => {{
    const next = new Set(selected);
    for (const w of filtered) next.add(w.word);
    setSelected([...next]);
  }};

  const clearSelection = () => setSelected([]);

  const deleteSelected = () => {{
    if (selected.length === 0) return;
    const nextDeleted = new Set(deleted);
    for (const w of selected) nextDeleted.add(w);
    setDeleted([...nextDeleted]);
    setSelected([]);
  }};

  const restoreDeleted = () => setDeleted([]);

  return (
    <Stack gap={{16}}>
      <Row gap={{8}} align="center" wrap>
        <H1>Ορθογραφία Στ΄</H1>
        <Pill active>
          {{WORDS.length}} λέξεις · {pages} σελίδες
        </Pill>
      </Row>

      <Callout tone="info" title="Επιλογή & διαγραφή">
        Τσεκάρετε λέξεις και πατήστε «Διαγραφή επιλεγμένων». Κρύβονται στο
        canvas state (όχι στο CSV). Import: python apply_canvas_deletions.py
        --grade 6. Επιλεγμένες: {{selected.length}} · Ορατές: {{active.length}} ·
        Διαγραμμένες: {{deleted.length}}
      </Callout>

      <Row gap={{8}} wrap>
        <Button
          variant="primary"
          onClick={{deleteSelected}}
          disabled={{selected.length === 0}}
        >
          Διαγραφή επιλεγμένων
        </Button>
        <Button variant="secondary" onClick={{selectAllVisible}}>
          Επιλογή όλων
        </Button>
        <Button variant="ghost" onClick={{clearSelection}}>
          Καθαρισμός επιλογής
        </Button>
        <Button
          variant="ghost"
          onClick={{restoreDeleted}}
          disabled={{deleted.length === 0}}
        >
          Επαναφορά διαγραμμένων
        </Button>
      </Row>

      <Stack gap={{10}}>
        <Row gap={{8}} align="center" justify="space-between" wrap>
          <H2>Πίνακας λέξεων ({{filtered.length}})</H2>
          <Text tone="tertiary" size="small">
            Φίλτρο: {{filter}}
          </Text>
        </Row>
        <Row gap={{6}} wrap>
          {{FILTERS.map((f) => (
            <span key={{f}}>
              <Pill active={{filter === f}} onClick={{() => applyFilter(f)}}>
                {{f}}
              </Pill>
            </span>
          ))}}
        </Row>
        <Row gap={{8}} align="center" wrap>
          <Button
            variant="secondary"
            disabled={{safePage <= 0}}
            onClick={{() => setPage(Math.max(0, safePage - 1))}}
          >
            Προηγούμενη
          </Button>
          <Text tone="secondary" size="small">
            Σελίδα {{safePage + 1}} / {{pageCount}} · {{pageRows.length}} από{{" "}}
            {{filtered.length}}
          </Text>
          <Button
            variant="secondary"
            disabled={{safePage >= pageCount - 1}}
            onClick={{() => setPage(Math.min(pageCount - 1, safePage + 1))}}
          >
            Επόμενη
          </Button>
        </Row>
        <Table
          headers={{["", "Λέξη", "Πρόταση"]}}
          columnAlign={{["center", "left", "left"]}}
          rows={{pageRows.map((w) => [
            <span key={{w.word + "-cb"}}>
              <Checkbox
                checked={{selectedSet.has(w.word)}}
                onChange={{(checked) => toggleWord(w.word, checked)}}
              />
            </span>,
            w.word,
            w.sent,
          ])}}
        />
      </Stack>
    </Stack>
  );
}}
'''
    OUT.write_text(out.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
    print(f"wrote {OUT.name} {total} words {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
