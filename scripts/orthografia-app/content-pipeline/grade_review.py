#!/usr/bin/env python3
"""Grade-scoped content review: words, cloze sentences, rule examples.

Build review packs + a local HTML reviewer so you can approve/flag/edit
content per τάξη (2–6).

Usage:
  python grade_review.py                     # summary for all grades
  python grade_review.py --grade 2           # pack + HTML for Β΄
  python grade_review.py --export-all        # packs for Β΄–Στ΄ + HTML UI
  python grade_review.py --status            # review progress
  python grade_review.py --apply-status      # write hint overrides from status
"""

from __future__ import annotations

import argparse
import json
import re
import webbrowser
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from validate_hints import classify_hint
from hint_generator import definition_leaks_word

PIPELINE = Path(__file__).resolve().parent
WEB = PIPELINE.parent / "web" / "public" / "content"
WORDS_FILE = WEB / "words.json"
RULES_FILE = WEB / "rules.json"
FAMILIES_FILE = WEB / "families.json"
REVIEW_DIR = PIPELINE / "review"
STATUS_FILE = PIPELINE / "inputs" / "grade_review_status.json"
HINT_OVERRIDES = PIPELINE / "inputs" / "hint_overrides.json"

GRADE_LABELS = {2: "Β΄", 3: "Γ΄", 4: "Δ΄", 5: "Ε΄", 6: "Στ΄"}
OFFERED_GRADES = (2, 3, 4, 5, 6)

HIGH_FLAGS = {
    "empty",
    "garbled",
    "leaks_word",
    "definition_leaks_word",
    "english",
    "known_bad",
    "placeholder_count",
}
MEDIUM_FLAGS = {
    "generic",
    "duplicate_hint",
    "missing_definition",
    "no_blank",
    "truncated",
    "fallback_meaning",
    "fallback_noun",
    "fallback_verb",
    "fallback_verb2",
    "fallback_verb3",
    "fallback_adj",
    "fallback_adj2",
    "fallback_adj3",
    "fallback_default",
    "fallback_default2",
    "fallback_default3",
    "fallback_school",
    "bad_article",
    "space_before_period",
    "double_space",
    "rule_example_empty",
}

TRUNCATED_HINT = re.compile(
    r"(=\s*___$|«\s*___$|\(\s*___$|:\s*___$)",
)


def source_from_id(word_id: str) -> str:
    if word_id.startswith("g2-") or word_id.startswith("g3-") or word_id.startswith("g4-"):
        return "curated"
    if word_id.startswith("word-"):
        return "seed"
    if word_id.startswith("hk-"):
        return "helexkids"
    if word_id.startswith("tb-"):
        return "textbook"
    if word_id.startswith("lx-"):
        return "lexikon"
    return "other"


def flag_priority(flags: list[str]) -> str:
    for f in flags:
        base = f.split("=")[0].split(":")[0]
        if base in HIGH_FLAGS or base.startswith("placeholder_count"):
            return "high"
        if base.startswith("known_bad"):
            return "high"
    for f in flags:
        base = f.split("=")[0].split(":")[0]
        if base in MEDIUM_FLAGS:
            return "medium"
    return "low"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_status() -> dict[str, Any]:
    if not STATUS_FILE.exists():
        return {"version": 1, "items": {}}
    return load_json(STATUS_FILE)


def save_status(status: dict[str, Any]) -> None:
    save_json(STATUS_FILE, status)


def build_word_items(
    words: list[dict[str, Any]],
    hint_counts: Counter[str],
    families: dict[str, Any],
    rules_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for entry in words:
        word = entry.get("word", "")
        hint = entry.get("hintSentence", "")
        word_id = entry.get("id", "?")
        flags = list(classify_hint(word, hint))

        if hint and "___" not in hint:
            flags.append("no_blank")
        if hint and TRUNCATED_HINT.search(hint):
            flags.append("truncated")
        dup = hint_counts.get(hint, 0)
        if hint and dup >= 3:
            flags.append(f"duplicate_hint={dup}")
        if entry.get("grade", 0) >= 4 and not (entry.get("definition") or "").strip():
            flags.append("missing_definition")
        definition = (entry.get("definition") or "").strip()
        if definition and definition_leaks_word(definition, word):
            flags.append("definition_leaks_word")

        family = None
        family_id = entry.get("familyId")
        if family_id and family_id in families:
            fam = families[family_id]
            family = {
                "id": family_id,
                "root": fam.get("root"),
                "members": fam.get("members", [])[:12],
                "rule": fam.get("rule", ""),
            }

        rule = None
        rule_id = entry.get("ruleId")
        if rule_id and rule_id in rules_by_id:
            r = rules_by_id[rule_id]
            rule = {"id": rule_id, "title": r.get("title", "")}

        flags = sorted(set(flags))
        items.append(
            {
                "key": f"word:{word_id}",
                "kind": "word",
                "id": word_id,
                "word": word,
                "grade": entry.get("grade"),
                "hintSentence": hint,
                "definition": entry.get("definition") or "",
                "feedbackRule": entry.get("feedbackRule") or "",
                "difficulty": entry.get("difficulty"),
                "axis": entry.get("axis"),
                "homophone": bool(entry.get("homophone")),
                "source": source_from_id(word_id),
                "rule": rule,
                "family": family,
                "flags": flags,
                "priority": flag_priority(flags),
            }
        )
    return items


def build_rule_example_items(rules: list[dict[str, Any]], grade: int) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for rule in rules:
        grades = rule.get("grades") or []
        if grade not in grades:
            continue
        examples = rule.get("examples") or []
        if not examples:
            items.append(
                {
                    "key": f"rule:{rule['id']}:empty",
                    "kind": "rule_example",
                    "id": rule["id"],
                    "word": "",
                    "grade": grade,
                    "hintSentence": "",
                    "definition": "",
                    "feedbackRule": "",
                    "ruleTitle": rule.get("title", ""),
                    "ruleBody": rule.get("body", ""),
                    "source": "rule",
                    "flags": ["rule_example_empty"],
                    "priority": "medium",
                }
            )
            continue
        for i, ex in enumerate(examples):
            word = ex.get("word", "")
            hint = ex.get("hint", "")
            flags: list[str] = []
            if not word or not hint:
                flags.append("rule_example_empty")
            items.append(
                {
                    "key": f"rule:{rule['id']}:{i}",
                    "kind": "rule_example",
                    "id": f"{rule['id']}#{i}",
                    "word": word,
                    "grade": grade,
                    "hintSentence": hint,
                    "definition": "",
                    "feedbackRule": "",
                    "ruleTitle": rule.get("title", ""),
                    "ruleBody": rule.get("body", ""),
                    "source": "rule",
                    "flags": flags,
                    "priority": flag_priority(flags) if flags else "low",
                }
            )
    return items


def build_grade_pack(
    grade: int,
    words: list[dict[str, Any]],
    rules: list[dict[str, Any]],
    families: dict[str, Any],
    status_items: dict[str, Any],
) -> dict[str, Any]:
    grade_words = [w for w in words if w.get("grade") == grade]
    hint_counts: Counter[str] = Counter(
        w.get("hintSentence", "") for w in words if w.get("hintSentence")
    )
    rules_by_id = {r["id"]: r for r in rules}

    word_items = build_word_items(grade_words, hint_counts, families, rules_by_id)
    rule_items = build_rule_example_items(rules, grade)
    items = word_items + rule_items

    # Sort: high priority first, then medium, then by source risk, then alpha
    source_rank = {"lexikon": 0, "helexkids": 1, "textbook": 2, "other": 3, "seed": 4, "curated": 5, "rule": 6}
    priority_rank = {"high": 0, "medium": 1, "low": 2}

    def sort_key(it: dict[str, Any]) -> tuple:
        st = status_items.get(it["key"], {})
        reviewed = 1 if st.get("status") in {"ok", "fixed", "skip"} else 0
        return (
            reviewed,
            priority_rank.get(it["priority"], 9),
            source_rank.get(it.get("source", "other"), 9),
            it.get("word") or "",
        )

    items.sort(key=sort_key)

    pending = [i for i in items if status_items.get(i["key"], {}).get("status") not in {"ok", "fixed", "skip"}]
    by_priority = Counter(i["priority"] for i in pending)
    by_source = Counter(i.get("source", "?") for i in word_items)
    by_flag: Counter[str] = Counter()
    for i in pending:
        for f in i["flags"]:
            by_flag[f.split("=")[0].split(":")[0]] += 1

    return {
        "grade": grade,
        "label": GRADE_LABELS.get(grade, str(grade)),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "words": len(word_items),
            "rule_examples": len(rule_items),
            "total": len(items),
            "pending": len(pending),
            "reviewed": len(items) - len(pending),
            "by_priority": dict(by_priority),
            "by_source": dict(by_source),
            "top_flags": dict(by_flag.most_common(15)),
        },
        "items": items,
    }


def write_markdown(pack: dict[str, Any], path: Path) -> None:
    lines: list[str] = [
        f"# Review — Τάξη {pack['label']} (grade {pack['grade']})",
        "",
        f"Generated: {pack['generatedAt']}",
        "",
        "## Summary",
        "",
        f"- Words: {pack['summary']['words']}",
        f"- Rule examples: {pack['summary']['rule_examples']}",
        f"- Pending: {pack['summary']['pending']} / {pack['summary']['total']}",
        f"- By priority: {pack['summary']['by_priority']}",
        f"- By source: {pack['summary']['by_source']}",
        f"- Top flags: {pack['summary']['top_flags']}",
        "",
        "## Items (high → low priority)",
        "",
    ]
    for it in pack["items"]:
        flags = ", ".join(it["flags"]) if it["flags"] else "—"
        lines.append(f"### {it['word'] or '(rule)'} `{it['key']}`")
        lines.append(f"- kind: {it['kind']} | priority: **{it['priority']}** | source: {it.get('source')}")
        lines.append(f"- sentence: {it.get('hintSentence') or '—'}")
        if it.get("definition"):
            lines.append(f"- definition: {it['definition']}")
        if it.get("ruleTitle"):
            lines.append(f"- rule: {it['ruleTitle']}")
        if it.get("feedbackRule"):
            lines.append(f"- feedback: {it['feedbackRule']}")
        lines.append(f"- flags: {flags}")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_html_ui(review_dir: Path) -> Path:
    """Self-contained HTML reviewer that loads grade-N.json packs."""
    html_path = review_dir / "index.html"
    html_path.write_text(REVIEW_HTML, encoding="utf-8")
    return html_path


REVIEW_HTML = r"""<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Orthographia — Content Review</title>
<style>
  :root {
    --bg: #f3efe6;
    --ink: #1c2a24;
    --muted: #5c6b63;
    --card: #fffdf8;
    --line: #d7cfc0;
    --ok: #1f7a4c;
    --fix: #a33b2b;
    --skip: #6b5b3e;
    --high: #a33b2b;
    --medium: #9a6b1f;
    --low: #3d6b55;
    --accent: #2a5f4d;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(ellipse at top left, #e8f0ea 0%, transparent 50%),
      linear-gradient(180deg, #efe8da, var(--bg));
    color: var(--ink);
    min-height: 100vh;
  }
  header {
    position: sticky; top: 0; z-index: 5;
    backdrop-filter: blur(8px);
    background: rgba(243,239,230,.92);
    border-bottom: 1px solid var(--line);
    padding: 0.75rem 1.25rem;
    display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
  }
  h1 { font-size: 1.05rem; margin: 0; letter-spacing: 0.02em; }
  .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-left: auto; }
  select, button, input[type="search"] {
    font: inherit; border: 1px solid var(--line); background: var(--card);
    border-radius: 8px; padding: 0.4rem 0.65rem; color: var(--ink);
  }
  button { cursor: pointer; }
  button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  button.ok { background: var(--ok); color: #fff; border-color: var(--ok); }
  button.fix { background: var(--fix); color: #fff; border-color: var(--fix); }
  button.skip { background: var(--skip); color: #fff; border-color: var(--skip); }
  main { max-width: 920px; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
  .stats { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; color: var(--muted); font-size: 0.92rem; }
  .stats strong { color: var(--ink); }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 1rem 1.1rem; margin-bottom: 0.85rem;
  }
  .card.done { opacity: 0.55; }
  .meta { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.55rem; }
  .chip {
    font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 999px;
    border: 1px solid var(--line); color: var(--muted);
  }
  .chip.high { color: var(--high); border-color: #e2b4ad; background: #f9ecea; }
  .chip.medium { color: var(--medium); border-color: #e6d2a8; background: #faf4e8; }
  .chip.low { color: var(--low); border-color: #b9d4c6; background: #eef6f1; }
  .word { font-size: 1.45rem; font-weight: 700; margin: 0.15rem 0 0.35rem; }
  .sentence { font-size: 1.05rem; line-height: 1.45; margin: 0.25rem 0; }
  .def, .extra { color: var(--muted); font-size: 0.92rem; margin: 0.2rem 0; }
  textarea {
    width: 100%; min-height: 2.8rem; margin-top: 0.5rem;
    font: inherit; border: 1px solid var(--line); border-radius: 8px;
    padding: 0.5rem; background: #fff; resize: vertical;
  }
  .actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.65rem; }
  .note { font-size: 0.85rem; color: var(--muted); }
  .empty { text-align: center; padding: 3rem 1rem; color: var(--muted); }
</style>
</head>
<body>
<header>
  <h1>Ορθογραφία · Review ανά τάξη</h1>
  <div class="controls">
    <label>Τάξη
      <select id="grade"></select>
    </label>
    <label>Προτεραιότητα
      <select id="priority">
        <option value="all">Όλα</option>
        <option value="high">Υψηλή</option>
        <option value="medium">Μεσαία</option>
        <option value="low">Χαμηλή</option>
      </select>
    </label>
    <label>Κατάσταση
      <select id="statusFilter">
        <option value="pending">Εκκρεμή</option>
        <option value="all">Όλα</option>
        <option value="ok">OK</option>
        <option value="fix">Προς διόρθωση</option>
        <option value="skip">Παράβλεψη</option>
      </select>
    </label>
    <input id="search" type="search" placeholder="Αναζήτηση λέξης…" />
    <button id="exportBtn" class="primary" type="button">Εξαγωγή status JSON</button>
    <button id="importBtn" type="button">Εισαγωγή status</button>
    <input id="importFile" type="file" accept="application/json,.json" hidden />
  </div>
</header>
<main>
  <div class="stats" id="stats"></div>
  <div id="list"></div>
</main>
<script>
const STORAGE_KEY = "orthographia-grade-review-status-v1";
const GRADE_LABELS = {2:"Β΄",3:"Γ΄",4:"Δ΄",5:"Ε΄",6:"Στ΄"};
const OFFERED_GRADES = [2,3,4,5,6];

function loadStatus() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStatus(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

let pack = null;
let statusMap = loadStatus();

const gradeSel = document.getElementById("grade");
const prioritySel = document.getElementById("priority");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("search");
const listEl = document.getElementById("list");
const statsEl = document.getElementById("stats");

for (const g of OFFERED_GRADES) {
  const opt = document.createElement("option");
  opt.value = String(g);
  opt.textContent = GRADE_LABELS[g];
  gradeSel.appendChild(opt);
}

async function loadGrade(g) {
  const res = await fetch(`./grade-${g}.json`);
  if (!res.ok) throw new Error(`Missing grade-${g}.json — τρέξε: python grade_review.py --export-all`);
  pack = await res.json();
  render();
}

function itemStatus(key) {
  return (statusMap[key] && statusMap[key].status) || "pending";
}

function setItemStatus(key, status, extra = {}) {
  statusMap[key] = {
    ...(statusMap[key] || {}),
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  saveStatus(statusMap);
  render();
}

function filteredItems() {
  if (!pack) return [];
  const pri = prioritySel.value;
  const st = statusFilter.value;
  const q = searchInput.value.trim().toLowerCase();
  return pack.items.filter((it) => {
    if (pri !== "all" && it.priority !== pri) return false;
    const cur = itemStatus(it.key);
    if (st === "pending" && ["ok","fixed","skip"].includes(cur)) return false;
    if (st !== "all" && st !== "pending" && cur !== st) return false;
    if (q && !(it.word||"").toLowerCase().includes(q) && !(it.hintSentence||"").toLowerCase().includes(q)) return false;
    return true;
  });
}

function render() {
  if (!pack) return;
  const items = filteredItems();
  const all = pack.items;
  const counts = { pending:0, ok:0, fix:0, skip:0 };
  for (const it of all) {
    const s = itemStatus(it.key);
    if (s === "ok" || s === "fixed") counts.ok++;
    else if (s === "fix") counts.fix++;
    else if (s === "skip") counts.skip++;
    else counts.pending++;
  }
  statsEl.innerHTML = `
    <span><strong>${pack.label}</strong> · ${pack.summary.words} λέξεις · ${pack.summary.rule_examples} παραδείγματα κανόνων</span>
    <span>Εκκρεμή: <strong>${counts.pending}</strong></span>
    <span>OK: <strong>${counts.ok}</strong></span>
    <span>Fix: <strong>${counts.fix}</strong></span>
    <span>Skip: <strong>${counts.skip}</strong></span>
    <span>Εμφάνιση: <strong>${items.length}</strong></span>
  `;

  if (!items.length) {
    listEl.innerHTML = `<div class="empty">Δεν υπάρχουν στοιχεία με αυτά τα φίλτρα.</div>`;
    return;
  }

  listEl.innerHTML = items.map((it) => {
    const st = itemStatus(it.key);
    const draft = (statusMap[it.key] && statusMap[it.key].newHint) || it.hintSentence || "";
    const note = (statusMap[it.key] && statusMap[it.key].note) || "";
    const flags = (it.flags || []).map(f => `<span class="chip">${f}</span>`).join("");
    const done = ["ok","fixed","skip"].includes(st);
    return `
      <article class="card ${done ? "done" : ""}" data-key="${it.key}">
        <div class="meta">
          <span class="chip ${it.priority}">${it.priority}</span>
          <span class="chip">${it.kind}</span>
          <span class="chip">${it.source || ""}</span>
          <span class="chip">${st}</span>
          ${it.rule && it.rule.title ? `<span class="chip">${it.rule.title}</span>` : ""}
          ${it.ruleTitle ? `<span class="chip">${it.ruleTitle}</span>` : ""}
          ${flags}
        </div>
        <div class="word">${it.word || "(κενό παράδειγμα κανόνα)"}</div>
        <p class="sentence">${it.hintSentence || "—"}</p>
        ${it.definition ? `<p class="def">Ορισμός: ${it.definition}</p>` : ""}
        ${it.feedbackRule ? `<p class="extra">Feedback: ${it.feedbackRule}</p>` : ""}
        ${it.family ? `<p class="extra">Οικογένεια: ${it.family.root} → ${(it.family.members||[]).join(", ")}</p>` : ""}
        <label class="note">Νέα πρόταση (cloze με ___)</label>
        <textarea data-role="hint">${draft.replace(/</g,"&lt;")}</textarea>
        <label class="note">Σημείωση</label>
        <textarea data-role="note" style="min-height:2rem">${note.replace(/</g,"&lt;")}</textarea>
        <div class="actions">
          <button class="ok" data-act="ok" type="button">OK</button>
          <button class="fix" data-act="fix" type="button">Χρειάζεται διόρθωση</button>
          <button class="skip" data-act="skip" type="button">Παράβλεψη</button>
          <button data-act="wrong_grade" type="button">Λάθος τάξη</button>
        </div>
      </article>`;
  }).join("");
}

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".card");
  const key = card.dataset.key;
  const hint = card.querySelector('[data-role="hint"]').value.trim();
  const note = card.querySelector('[data-role="note"]').value.trim();
  const act = btn.dataset.act;
  if (act === "ok") setItemStatus(key, "ok", { newHint: hint, note });
  else if (act === "fix") setItemStatus(key, "fix", { newHint: hint, note });
  else if (act === "skip") setItemStatus(key, "skip", { newHint: hint, note });
  else if (act === "wrong_grade") setItemStatus(key, "fix", { newHint: hint, note: (note ? note + " | " : "") + "wrong_grade" });
});

gradeSel.addEventListener("change", () => loadGrade(gradeSel.value).catch(alert));
prioritySel.addEventListener("change", render);
statusFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);

document.getElementById("exportBtn").addEventListener("click", () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: statusMap,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "grade_review_status.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  statusMap = data.items || data;
  saveStatus(statusMap);
  render();
});

const params = new URLSearchParams(location.search);
gradeSel.value = params.get("grade") || "1";
loadGrade(gradeSel.value).catch((err) => {
  listEl.innerHTML = `<div class="empty">${err.message}</div>`;
});
</script>
</body>
</html>
"""


def _safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"))


def print_summary(packs: list[dict[str, Any]]) -> None:
    _safe_print(f"{'Grade':<6} {'Words':>7} {'Rules':>8} {'Pending':>8} {'High':>6} {'Med':>6} {'Low':>6}")
    _safe_print("-" * 56)
    for p in packs:
        s = p["summary"]
        bp = s.get("by_priority", {})
        label = f"G{p['grade']}"
        _safe_print(
            f"{label:<6} {s['words']:>7} {s['rule_examples']:>8} {s['pending']:>8} "
            f"{bp.get('high', 0):>6} {bp.get('medium', 0):>6} {bp.get('low', 0):>6}"
        )


def apply_status_to_overrides() -> int:
    """Merge status items with newHint into hint_overrides.json."""
    status = load_status()
    items = status.get("items") or {}
    if not items:
        print(f"No status entries in {STATUS_FILE}")
        return 0

    overrides: dict[str, str] = {}
    if HINT_OVERRIDES.exists():
        raw = load_json(HINT_OVERRIDES)
        if isinstance(raw, dict):
            overrides = {str(k): str(v) for k, v in raw.items()}

    words_data = load_json(WORDS_FILE)
    id_to_word = {w["id"]: w["word"] for w in words_data["words"]}

    applied = 0
    for key, meta in items.items():
        if meta.get("status") not in {"fix", "fixed", "ok"}:
            continue
        new_hint = (meta.get("newHint") or "").strip()
        if not new_hint or "___" not in new_hint:
            continue
        if not key.startswith("word:"):
            continue
        word_id = key.split(":", 1)[1]
        word = id_to_word.get(word_id)
        if not word:
            continue
        # Only apply if hint changed vs current
        current = next((w.get("hintSentence", "") for w in words_data["words"] if w["id"] == word_id), "")
        if new_hint == current:
            continue
        overrides[word] = new_hint
        applied += 1

    if applied:
        save_json(HINT_OVERRIDES, overrides)
        print(f"Wrote {applied} hint overrides → {HINT_OVERRIDES}")
        print("Next: run fix_hints.py to apply into words.json")
    else:
        print("No new hint overrides to write (need status with newHint different from current).")
    return applied


def export_packs(grades: list[int], open_browser: bool) -> None:
    words = load_json(WORDS_FILE)["words"]
    rules = load_json(RULES_FILE)["rules"]
    families = load_json(FAMILIES_FILE) if FAMILIES_FILE.exists() else {}
    status = load_status()
    status_items = status.get("items") or {}

    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    packs: list[dict[str, Any]] = []
    for g in grades:
        pack = build_grade_pack(g, words, rules, families, status_items)
        packs.append(pack)
        save_json(REVIEW_DIR / f"grade-{g}.json", pack)
        write_markdown(pack, REVIEW_DIR / f"grade-{g}.md")
        _safe_print(f"Wrote review/grade-{g}.json and .md ({pack['summary']['pending']} pending)")

    html_path = write_html_ui(REVIEW_DIR)
    index = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "grades": [
            {
                "grade": p["grade"],
                "label": p["label"],
                "summary": p["summary"],
            }
            for p in packs
        ],
    }
    save_json(REVIEW_DIR / "index.json", index)
    print_summary(packs)
    _safe_print(f"\nOpen reviewer: {html_path}")
    _safe_print("Tip: serve the folder so fetch works, e.g.")
    _safe_print(f'  python -m http.server 8765 --directory "{REVIEW_DIR}"')
    _safe_print("  then http://localhost:8765/?grade=2")

    if open_browser:
        # file:// often blocks fetch; prefer local server URL if possible
        webbrowser.open(html_path.as_uri())


def show_status() -> None:
    status = load_status()
    items = status.get("items") or {}
    if not items:
        _safe_print(f"No review status yet at {STATUS_FILE}")
        _safe_print("Review in the HTML UI, export JSON, save as inputs/grade_review_status.json")
        return
    counts = Counter(v.get("status", "?") for v in items.values())
    _safe_print(f"Status file: {STATUS_FILE}")
    _safe_print(f"Entries: {len(items)}")
    for k, n in sorted(counts.items()):
        _safe_print(f"  {k}: {n}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Review words/sentences/examples per grade")
    parser.add_argument("--grade", type=int, choices=OFFERED_GRADES, help="Single grade 2–6")
    parser.add_argument("--export-all", action="store_true", help="Export packs for all grades")
    parser.add_argument("--open", action="store_true", help="Open HTML reviewer")
    parser.add_argument("--status", action="store_true", help="Show review progress from status file")
    parser.add_argument("--apply-status", action="store_true", help="Write hint overrides from status")
    parser.add_argument(
        "--import-status",
        type=Path,
        help="Copy exported browser status JSON into inputs/grade_review_status.json",
    )
    args = parser.parse_args()

    if args.import_status:
        data = load_json(args.import_status)
        if "items" not in data and isinstance(data, dict):
            data = {"version": 1, "items": data}
        save_status(data)
        print(f"Imported {len(data.get('items', {}))} status items → {STATUS_FILE}")
        return

    if args.apply_status:
        apply_status_to_overrides()
        return

    if args.status:
        show_status()
        return

    if args.export_all:
        export_packs(list(OFFERED_GRADES), open_browser=args.open)
        return

    if args.grade:
        export_packs([args.grade], open_browser=args.open)
        return

    # Default: summary only (still builds packs for overview)
    words = load_json(WORDS_FILE)["words"]
    rules = load_json(RULES_FILE)["rules"]
    families = load_json(FAMILIES_FILE) if FAMILIES_FILE.exists() else {}
    status_items = load_status().get("items") or {}
    packs = [
        build_grade_pack(g, words, rules, families, status_items) for g in OFFERED_GRADES
    ]
    print_summary(packs)
    _safe_print("\nNext: python grade_review.py --export-all")
    _safe_print("Then open review/index.html via a local server and review per grade.")


if __name__ == "__main__":
    main()
