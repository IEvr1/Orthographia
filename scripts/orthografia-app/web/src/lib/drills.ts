import type { DrillItem, DrillKind, GameMode } from "../types";
import { getWordProgress, isWordDue, type ProgressStore } from "./storage";

export const DRILL_SESSION_SIZE = 10;
/** Items per workbook-style page (choice drills). */
export const DRILL_BATCH_SIZE = 8;
/** Max pages per endings session. */
export const DRILL_BATCHES_PER_SESSION = 2;

const ENDINGS_KINDS = new Set<DrillKind>([
  "ending",
  "binary",
  "infix",
  "article",
  "cloze",
  "choice",
  "homophone",
]);

/** Kinds shown as a multi-item page with Έλεγχος at the end. */
export const BATCHABLE_KINDS = new Set<DrillKind>([
  "ending",
  "binary",
  "infix",
  "article",
  "cloze",
  "choice",
  "homophone",
]);

export function drillsForMode(drills: DrillItem[], mode: GameMode): DrillItem[] {
  switch (mode) {
    case "endings":
      return drills.filter((d) => ENDINGS_KINDS.has(d.kind));
    case "compound":
      return drills.filter((d) => d.kind === "compound");
    case "classify":
      // Keep verb suffix groups + πολύ επίθετο/επίρρημα (not Κύρια/Κοινά).
      return drills.filter(
        (d) =>
          d.kind === "classify" &&
          (d.ruleId === "verb-suffix-class" || d.ruleId === "polys-adj-adv"),
      );
    default:
      return [];
  }
}

export function drillsForGrade(drills: DrillItem[], grade: number): DrillItem[] {
  return drills.filter((d) => d.grades.includes(grade));
}

export function modeUsesDrills(mode: GameMode): boolean {
  return mode === "endings" || mode === "compound" || mode === "classify";
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function isUnseen(store: ProgressStore, id: string): boolean {
  const p = getWordProgress(store, id);
  return !p.lastSeen && p.attempts === 0;
}

function isDue(store: ProgressStore, id: string): boolean {
  if (isUnseen(store, id)) return false;
  const p = getWordProgress(store, id);
  if (p.needsReview) return true;
  return isWordDue(store, id);
}

function prioritize(pool: DrillItem[], store: ProgressStore): DrillItem[] {
  const due = shuffle(pool.filter((d) => isDue(store, d.id)));
  const unseen = shuffle(pool.filter((d) => isUnseen(store, d.id)));
  const rest = shuffle(
    pool.filter((d) => !due.some((x) => x.id === d.id) && !unseen.some((x) => x.id === d.id)),
  );
  return [...due, ...unseen, ...rest];
}

function groupByRule(items: DrillItem[]): Map<string, DrillItem[]> {
  const map = new Map<string, DrillItem[]>();
  for (const item of items) {
    const list = map.get(item.ruleId) ?? [];
    list.push(item);
    map.set(item.ruleId, list);
  }
  return map;
}

/** Build same-topic pages of ~6–8 choice drills. */
function planBatches(
  pool: DrillItem[],
  store: ProgressStore,
  batchSize = DRILL_BATCH_SIZE,
  maxBatches = DRILL_BATCHES_PER_SESSION,
  /** When true, keep only BATCHABLE_KINDS. When false, use the whole pool (e.g. classify). */
  filterBatchable = true,
): DrillItem[][] {
  const batchable = prioritize(
    filterBatchable ? pool.filter((d) => BATCHABLE_KINDS.has(d.kind)) : pool,
    store,
  );
  if (batchable.length === 0) return [];

  const byRule = groupByRule(batchable);
  const ruleOrder = [...byRule.entries()]
    .map(([ruleId, items]) => ({
      ruleId,
      items: prioritize(items, store),
      score:
        items.filter((d) => isDue(store, d.id)).length * 10 +
        items.filter((d) => isUnseen(store, d.id)).length * 3 +
        items.length,
    }))
    .sort((a, b) => b.score - a.score);

  const batches: DrillItem[][] = [];
  const used = new Set<string>();
  const minBatch = Math.min(6, batchSize);

  for (const rule of ruleOrder) {
    if (batches.length >= maxBatches) break;
    const available = rule.items.filter((d) => !used.has(d.id));
    if (available.length < minBatch && batches.length > 0) continue;
    if (available.length === 0) continue;

    const take = available.slice(0, Math.min(batchSize, available.length));
    if (take.length < Math.min(4, minBatch) && batches.length > 0) continue;

    for (const d of take) used.add(d.id);
    batches.push(take);

    // Second page from same rule if enough remain
    if (batches.length < maxBatches) {
      const more = rule.items.filter((d) => !used.has(d.id)).slice(0, batchSize);
      if (more.length >= minBatch) {
        for (const d of more) used.add(d.id);
        batches.push(more);
      }
    }
  }

  // Fallback: mixed batch if nothing grouped
  if (batches.length === 0) {
    const take = batchable.slice(0, Math.min(batchSize, batchable.length));
    if (take.length > 0) batches.push(take);
  }

  return batches;
}

export interface DrillSessionPlan {
  items: DrillItem[];
  /** Workbook-style pages; null = one-at-a-time (compound). */
  batches: DrillItem[][] | null;
  banner: string | null;
}

/** Pick a drill session: batched pages for endings & classify; flat for compound. */
export function planDrillSession(
  drills: DrillItem[],
  store: ProgressStore,
  grade: number,
  mode: GameMode,
  size = DRILL_SESSION_SIZE,
): DrillSessionPlan {
  const pool = drillsForMode(drillsForGrade(drills, grade), mode);
  if (pool.length === 0) {
    return { items: [], batches: null, banner: null };
  }

  if (mode === "endings") {
    const batches = planBatches(pool, store);
    const items = batches.flat();
    const dueAny = pool.some((d) => isDue(store, d.id));
    const unseenAny = pool.some((d) => isUnseen(store, d.id));
    const banner =
      !dueAny && !unseenAny
        ? "Επανάληψη ασκήσεων καταλήξεων — όλα ενημερωμένα!"
        : batches.length > 1
          ? `${batches.length} ομάδες · ${batches[0]?.length ?? 0} ασκήσεις η καθεμία`
          : batches[0]
            ? `Ομάδα · ${batches[0].length} ασκήσεις`
            : null;
    return { items, batches, banner };
  }

  if (mode === "classify") {
    const batches = planBatches(pool, store, 10, DRILL_BATCHES_PER_SESSION, false);
    const items = batches.flat();
    const dueAny = pool.some((d) => isDue(store, d.id));
    const unseenAny = pool.some((d) => isUnseen(store, d.id));
    const banner =
      !dueAny && !unseenAny
        ? "Επανάληψη ομάδων — όλα ενημερωμένα!"
        : batches.length > 1
          ? `${batches.length} ομάδες · ${batches[0]?.length ?? 0} λέξεις η καθεμία`
          : batches[0]
            ? `Ομάδα · ${batches[0].length} λέξεις`
            : null;
    return { items, batches, banner };
  }

  const ordered = prioritize(pool, store);
  const picked = ordered.slice(0, Math.min(size, ordered.length));
  const dueAny = pool.some((d) => isDue(store, d.id));
  const unseenAny = pool.some((d) => isUnseen(store, d.id));
  const banner =
    !dueAny && !unseenAny ? "Επανάληψη — όλα ενημερωμένα!" : null;

  return { items: picked, batches: null, banner };
}
