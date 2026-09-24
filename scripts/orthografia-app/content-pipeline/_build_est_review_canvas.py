#!/usr/bin/env python3
"""Build a slim Ε΄/Στ΄ review canvas that stays under ~100KB so it opens in UI."""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

CANVAS = Path(r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases")
OUT = CANVAS / "lexikon-est-review.canvas.tsx"


def extract_objs(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const WORDS: WordRow\[\] = \[(.*?)\];", text, re.S)
    if not m:
        raise SystemExit(f"no WORDS in {path}")
    return re.findall(r"\{[^{}]+\}", m.group(1))


def field(obj: str, key: str):
    m = re.search(rf"{key}:(\"(?:\\.|[^\"\\])*\"|true|false|\d+)", obj)
    if not m:
        return ""
    v = m.group(1)
    if v in ("true", "false"):
        return v == "true"
    if v.isdigit():
        return int(v)
    return json.loads(v)


def clip(s: str, n: int) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def main() -> None:
    sources = [
        (CANVAS / "grade5-spelling-words.canvas.tsx", 5, "βιβλίο"),
        (CANVAS / "grade6-spelling-words.canvas.tsx", 6, "βιβλίο"),
        (CANVAS / "lexikon-e.canvas.tsx", 5, "λεξικό"),
        (CANVAS / "lexikon-st.canvas.tsx", 6, "λεξικό"),
    ]
    pos_name = {"noun": "ουσ.", "verb": "ρήμα", "adj": "επίθ."}
    rows: list[dict] = []

    for path, grade, kind in sources:
        for obj in extract_objs(path):
            if kind == "βιβλίο":
                tag = field(obj, "ph") or field(obj, "cat") or ""
                # shorten phenomenon labels
                tag = (
                    str(tag)
                    .replace("ι-ήχος (ει/οι/υι)", "ι-ήχος")
                    .replace("δίψηφα σύμφωνα", "δίψ.σ.")
                )
            else:
                tag = pos_name.get(field(obj, "pos") or "", field(obj, "pos") or "")
            # Books: word+tag only (short). Lexikon: keep short sentence.
            if kind == "λεξικό":
                sent = clip(str(field(obj, "sent") or ""), 55)
            else:
                sent = ""
            rows.append(
                {
                    "w": field(obj, "word"),
                    "g": grade,
                    "k": "β" if kind == "βιβλίο" else "λ",
                    "t": clip(str(tag), 10),
                    "s": sent,
                }
            )

    rows.sort(key=lambda r: (r["g"], 0 if r["k"] == "β" else 1, r["w"].casefold()))
    counts = Counter((r["g"], r["k"]) for r in rows)
    n5b, n5l = counts[(5, "β")], counts[(5, "λ")]
    n6b, n6l = counts[(6, "β")], counts[(6, "λ")]
    total = len(rows)

    lines = []
    for r in rows:
        parts = [
            "w:" + js_str(r["w"]),
            "g:" + str(r["g"]),
            "k:" + js_str(r["k"]),
            "t:" + js_str(r["t"]),
        ]
        if r["s"]:
            parts.append("s:" + js_str(r["s"]))
        lines.append("{" + ",".join(parts) + "},")
    words_block = "\n".join(lines)

    out = f"""import {{
  Button,
  Callout,
  Checkbox,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
}} from "cursor/canvas";

type WordRow = {{
  w: string;
  g: number;
  k: string;
  t: string;
  s?: string;
}};

const WORDS: WordRow[] = [
{words_block}
];

const GNAME: Record<number, string> = {{ 5: "Ε΄", 6: "Στ΄" }};
const KNAME: Record<string, string> = {{ β: "βιβλίο", λ: "λεξικό" }};

const FILTERS = [
  "Ε΄ βιβλίο",
  "Ε΄ λεξικό",
  "Στ΄ βιβλίο",
  "Στ΄ λεξικό",
  "Όλα Ε΄",
  "Όλα Στ΄",
  "Μόνο βιβλία",
  "Μόνο λεξικά",
] as const;

function cmp(a: string, b: string): number {{
  return a.localeCompare(b, "el", {{ sensitivity: "base" }});
}}

function match(w: WordRow, f: string): boolean {{
  if (f === "Ε΄ βιβλίο") return w.g === 5 && w.k === "β";
  if (f === "Ε΄ λεξικό") return w.g === 5 && w.k === "λ";
  if (f === "Στ΄ βιβλίο") return w.g === 6 && w.k === "β";
  if (f === "Στ΄ λεξικό") return w.g === 6 && w.k === "λ";
  if (f === "Όλα Ε΄") return w.g === 5;
  if (f === "Όλα Στ΄") return w.g === 6;
  if (f === "Μόνο βιβλία") return w.k === "β";
  if (f === "Μόνο λεξικά") return w.k === "λ";
  return true;
}}

const PAGE = 80;

export default function LexikonEstReview() {{
  const [filter, setFilter] = useCanvasState<string>("filter", "Ε΄ βιβλίο");
  const [selected, setSelected] = useCanvasState<string[]>("selected", []);
  const [deleted, setDeleted] = useCanvasState<string[]>("deleted", []);
  const [page, setPage] = useCanvasState<number>("page", 0);

  const del = new Set(deleted);
  const sel = new Set(selected);
  const key = (w: WordRow) => w.g + "|" + w.k + "|" + w.w;

  const filtered = WORDS.filter((w) => !del.has(key(w)) && match(w, filter)).sort(
    (a, b) =>
      a.g !== b.g ? a.g - b.g : a.k !== b.k ? a.k.localeCompare(b.k) : cmp(a.w, b.w)
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safe = Math.min(page, pages - 1);
  const rows = filtered.slice(safe * PAGE, safe * PAGE + PAGE);

  const apply = (f: string) => {{
    setFilter(f);
    setPage(0);
  }};

  const toggle = (k: string, on: boolean) => {{
    if (on) {{
      if (!sel.has(k)) setSelected([...selected, k]);
    }} else setSelected(selected.filter((x) => x !== k));
  }};

  const selectAll = () => {{
    const n = new Set(selected);
    for (const w of filtered) n.add(key(w));
    setSelected([...n]);
  }};

  const clear = () => setSelected([]);

  const remove = () => {{
    if (!selected.length) return;
    const n = new Set(deleted);
    for (const k of selected) n.add(k);
    setDeleted([...n]);
    setSelected([]);
  }};

  const restore = () => setDeleted([]);

  const cnt = (p: (w: WordRow) => boolean) =>
    WORDS.filter((w) => !del.has(key(w)) && p(w)).length;

  return (
    <Stack gap={{20}}>
      <Stack gap={{6}}>
        <Row gap={{8}} align="center" wrap>
          <H1>Έλεγχος Ε΄ + Στ΄</H1>
          <Pill active>βιβλία & λεξικά</Pill>
        </Row>
        <Text tone="secondary">
          {total} εγγραφές · Ε΄β {n5b} · Ε΄λ {n5l} · Στ΄β {n6b} · Στ΄λ {n6l} · 80/σελίδα.
          Στα βιβλία φαίνεται λέξη+ετικέτα· στα λεξικά και πρόταση.
        </Text>
      </Stack>

      <Grid columns={{4}} gap={{10}}>
        <Stat value={{String(cnt((w) => w.g === 5 && w.k === "β"))}} label="Ε΄ βιβλίο" />
        <Stat
          value={{String(cnt((w) => w.g === 5 && w.k === "λ"))}}
          label="Ε΄ λεξικό"
          tone="success"
        />
        <Stat value={{String(cnt((w) => w.g === 6 && w.k === "β"))}} label="Στ΄ βιβλίο" />
        <Stat
          value={{String(cnt((w) => w.g === 6 && w.k === "λ"))}}
          label="Στ΄ λεξικό"
          tone="success"
        />
      </Grid>

      <Callout tone="info" title="Φίλτρο = μία ομάδα">
        Ξεκίνα από «Ε΄ βιβλίο». Οι στήλες Τάξη/Πηγή εμποδίζουν μπέρδεμα.
        Επιλεγμένες {{selected.length}} · Ορατές {{filtered.length}} · Διαγρ.{{" "}}
        {{deleted.length}}
      </Callout>

      <Row gap={{8}} wrap>
        <Button variant="primary" onClick={{remove}} disabled={{!selected.length}}>
          Διαγραφή
        </Button>
        <Button variant="secondary" onClick={{selectAll}}>
          Επιλογή όλων
        </Button>
        <Button variant="ghost" onClick={{clear}}>
          Καθαρισμός
        </Button>
        <Button variant="ghost" onClick={{restore}} disabled={{!deleted.length}}>
          Επαναφορά
        </Button>
      </Row>

      <Divider />

      <Stack gap={{10}}>
        <Row gap={{8}} align="center" justify="space-between" wrap>
          <H2>Πίνακας ({{filtered.length}})</H2>
          <Text tone="tertiary" size="small">
            {{filter}}
          </Text>
        </Row>
        <Row gap={{6}} wrap>
          {{FILTERS.map((f) => (
            <span key={{f}}>
              <Pill active={{filter === f}} onClick={{() => apply(f)}}>
                {{f}}
              </Pill>
            </span>
          ))}}
        </Row>
        <Row gap={{8}} align="center" wrap>
          <Button
            variant="secondary"
            disabled={{safe <= 0}}
            onClick={{() => setPage(Math.max(0, safe - 1))}}
          >
            Προηγ.
          </Button>
          <Text tone="secondary" size="small">
            {{safe + 1}}/{{pages}} · {{rows.length}}
          </Text>
          <Button
            variant="secondary"
            disabled={{safe >= pages - 1}}
            onClick={{() => setPage(Math.min(pages - 1, safe + 1))}}
          >
            Επόμ.
          </Button>
        </Row>
        <Table
          headers={{["", "Τάξη", "Πηγή", "Λέξη", "Ετικ.", "Πρόταση"]}}
          columnAlign={{["center", "center", "center", "left", "left", "left"]}}
          rows={{rows.map((w) => {{
            const k = key(w);
            return [
              <span key={{k}}>
                <Checkbox
                  checked={{sel.has(k)}}
                  onChange={{(c) => toggle(k, c)}}
                />
              </span>,
              GNAME[w.g],
              KNAME[w.k],
              w.w,
              w.t || "—",
              w.s || "—",
            ];
          }})}}
        />
      </Stack>
    </Stack>
  );
}}
"""

    OUT.write_text(out, encoding="utf-8", newline="\n")
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.name}: {total} rows, {kb:.1f} KB")
    if kb > 100:
        print("WARNING: still large; may fail to open")


if __name__ == "__main__":
    main()
