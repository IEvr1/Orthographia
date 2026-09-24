# -*- coding: utf-8 -*-
"""Generate mathima-verbs-review.canvas.tsx from imported verbs."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(r"c:\AI_apps\Orthographia")
REVIEW = ROOT / "_mathima_verbs_review.json"
WORDS = ROOT / "scripts" / "orthografia-app" / "web" / "public" / "content" / "words.json"
AUDIO = ROOT / "scripts" / "orthografia-app" / "web" / "public" / "content" / "audio"
CANVAS = Path(
    r"C:\Users\User\.cursor\projects\c-AI-apps-Orthographia\canvases\mathima-verbs-review.canvas.tsx"
)

review = json.loads(REVIEW.read_text(encoding="utf-8"))
words = {w["word"]: w for w in json.loads(WORDS.read_text(encoding="utf-8"))["words"]}
new_set = {r["word"] for r in review["added"]}

rows = []
for r in review["added"]:
    w = words[r["word"]]
    fname = (w.get("audioFile") or "").split("/")[-1]
    rows.append(
        {
            "word": r["word"],
            "grade": r["grade"],
            "hint": w.get("hintSentence") or r["hint"],
            "difficulty": w.get("difficulty", 1),
            "id": w["id"],
            "audio": fname,
            "audioOk": bool(fname) and (AUDIO / fname).exists(),
            "suffix": (w.get("morphemes") or {}).get("suffix", ""),
            "group": (
                "βασικά"
                if r["grade"] == 2
                else "-αίνω/μέση"
                if r["grade"] == 3
                else "συνηρημένα/βάλλω"
                if r["grade"] == 4
                else "-ποιώ"
            ),
        }
    )

rows_json = json.dumps(rows, ensure_ascii=False)

# Build TSX without f-string interpreting JS template literals
tsx = """import {
  Callout,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
} from "cursor/canvas";

type RowT = {
  word: string;
  grade: number;
  hint: string;
  difficulty: number;
  id: string;
  audio: string;
  audioOk: boolean;
  suffix: string;
  group: string;
};

const ROWS: RowT[] = __ROWS__;

const GNAME: Record<number, string> = { 2: "Β΄", 3: "Γ΄", 4: "Δ΄", 5: "Ε΄" };

export default function MathimaVerbsReview() {
  const [grade, setGrade] = useCanvasState<number | "all">("grade", "all");
  const [q, setQ] = useCanvasState<string>("q", "");
  const [page, setPage] = useCanvasState<number>("page", 0);
  const pageSize = 30;

  const filtered = ROWS.filter((r) => {
    if (grade !== "all" && r.grade !== grade) return false;
    const qq = q.trim().toLowerCase();
    if (qq && !r.word.toLowerCase().includes(qq) && !r.hint.toLowerCase().includes(qq))
      return false;
    return true;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const audioOk = ROWS.filter((r) => r.audioOk).length;

  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1100 }}>
      <Stack gap={6}>
        <H1>Review: ρήματα από το PDF</H1>
        <Text tone="secondary">
          Νέα λήμματα ρημάτων με curated cloze-προτάσεις · ήχος Google TTS · πηγή
          Μάθημα Ορθογραφίας.
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value={String(ROWS.length)} label="Νέα ρήματα" />
        <Stat value={String(ROWS.filter((r) => r.grade === 2).length)} label="Β΄" />
        <Stat value={String(ROWS.filter((r) => r.grade === 3).length)} label="Γ΄" />
        <Stat value={String(audioOk)} label="Ήχος OK" tone="success" />
      </Grid>

      <Callout tone="info" title="Πώς να κάνεις verify">
        Διάβασε κάθε πρόταση: το κενό πρέπει να ταιριάζει με τον τύπο λεξικού (συνήθως
        α΄ ενικό). Αν η πρόταση είναι αστεία, λάθος νόημα, ή διαρρέει ορθογραφία, πες μου
        τη λέξη να τη διορθώσω. Μετά το OK μένουν στο app.
      </Callout>

      <Callout tone="success" title="Pipeline">
        CSV (mathima_g*) → import_lexika → words.json → generate_audio → αυτό το canvas.
        Προστέθηκαν __COUNT__ ρήματα χωρίς διπλά ids.
      </Callout>

      <H2>Φίλτρα</H2>
      <Row gap={8} wrap>
        <Pill
          active={grade === "all"}
          onClick={() => {
            setGrade("all");
            setPage(0);
          }}
        >
          Όλες
        </Pill>
        <Pill active={grade === 2} onClick={() => { setGrade(2); setPage(0); }}>
          Β΄
        </Pill>
        <Pill active={grade === 3} onClick={() => { setGrade(3); setPage(0); }}>
          Γ΄
        </Pill>
        <Pill active={grade === 4} onClick={() => { setGrade(4); setPage(0); }}>
          Δ΄
        </Pill>
        <Pill active={grade === 5} onClick={() => { setGrade(5); setPage(0); }}>
          Ε΄
        </Pill>
      </Row>

      <TextInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(0);
        }}
        placeholder="Αναζήτηση ρήματος ή πρότασης…"
      />

      <Text tone="secondary">
        Εμφάνιση {slice.length} από {filtered.length} · σελίδα {safePage + 1}/{pages}
      </Text>
      <Row gap={8}>
        <Pill disabled={safePage <= 0} onClick={() => setPage(Math.max(0, safePage - 1))}>
          Προηγούμενη
        </Pill>
        <Pill
          disabled={safePage >= pages - 1}
          onClick={() => setPage(Math.min(pages - 1, safePage + 1))}
        >
          Επόμενη
        </Pill>
      </Row>

      <Table
        headers={["Τάξη", "Ρήμα", "Πρόταση", "Κατάληξη", "Δυσκ.", "Ήχος"]}
        rows={slice.map((r) => [
          GNAME[r.grade] ?? String(r.grade),
          r.word,
          r.hint,
          r.suffix ? "-" + r.suffix : "—",
          String(r.difficulty),
          r.audioOk ? "OK" : "—",
        ])}
      />
    </Stack>
  );
}
"""

tsx = tsx.replace("__ROWS__", rows_json).replace("__COUNT__", str(len(rows)))
CANVAS.write_text(tsx, encoding="utf-8")
print(f"Wrote {CANVAS} with {len(rows)} rows")
