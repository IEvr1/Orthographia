/**
 * Smoke checks for new practice libs (run: node scripts/verify-modes.mjs)
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const words = JSON.parse(readFileSync(join(root, "public/content/words.json"), "utf8")).words;
const families = JSON.parse(readFileSync(join(root, "public/content/families.json"), "utf8"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- inline ports of key logic (JS) ---
function stripStress(text) {
  const map = { ά: "α", έ: "ε", ή: "η", ί: "ι", ό: "ο", ύ: "υ", ώ: "ω" };
  return [...text.toLowerCase()].map((c) => map[c] ?? c).join("");
}

function orthographyVariants(word, limit = 8) {
  const out = [];
  const push = (v) => {
    if (v && v !== word && !out.includes(v)) out.push(v);
  };
  const base = stripStress(word);
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    const tonos = { α: "ά", ε: "έ", η: "ή", ι: "ί", ο: "ό", υ: "ύ", ω: "ώ" }[ch];
    if (tonos) push(base.slice(0, i) + tonos + base.slice(i + 1));
  }
  if (word.endsWith("ς")) push(word.slice(0, -1) + "σ");
  push(base);
  return out.slice(0, limit);
}

function buildChoiceOptions(word, pool) {
  const options = new Set([word.word]);
  for (const v of orthographyVariants(word.word, 10)) {
    if (options.size >= 4) break;
    options.add(v);
  }
  for (const entry of pool) {
    if (options.size >= 4) break;
    if (entry.id !== word.id) options.add(entry.word);
  }
  return [...options].slice(0, 4);
}

const sample = words.find((w) => w.word.length > 4) ?? words[0];
const opts = buildChoiceOptions(sample, words.filter((w) => w.grade === sample.grade).slice(0, 50));
assert(opts.includes(sample.word), "choice must include correct word");
assert(opts.length === 4, `choice should have 4 options, got ${opts.length}`);
assert(opts.some((o) => o !== sample.word), "choice needs distractors");

const withFam = words.filter((w) => w.familyId && families[w.familyId]?.members?.length);
assert(withFam.length > 0, "need family words");
const fam = families[withFam[0].familyId];
assert(fam.members.length >= 1, "family members");

const withDef = words.filter((w) => w.definition);
assert(withDef.length >= 8, "need definitions for matching");

const withSuffix = words.filter((w) => w.morphemes?.suffix?.length >= 1);
assert(withSuffix.length > 0, "need morphemes");

const withStress = words.filter((w) => /[άέήίόύώ]/.test(w.word));
assert(withStress.length > 0, "need stressed words for tonos");

const variants = orthographyVariants(sample.word);
assert(variants.length >= 1, "orthography variants");

console.log("OK verify-modes");
console.log({
  choiceSample: sample.word,
  options: opts,
  familiesUsable: withFam.length,
  definitions: withDef.length,
  morphemes: withSuffix.length,
  stressed: withStress.length,
  variants: variants.slice(0, 5),
});
