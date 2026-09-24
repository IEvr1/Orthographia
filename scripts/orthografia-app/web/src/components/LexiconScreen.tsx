import { useMemo, useState } from "react";
import type { WordEntry } from "../types";
import { AudioPlayer } from "./AudioPlayer";
import { GRADE_LABELS } from "../lib/grades";

interface LexiconScreenProps {
  words: WordEntry[];
  grade: number;
  onBack: () => void;
  onGradeChange?: (grade: number) => void;
  availableGrades: Set<number>;
}

export function LexiconScreen({
  words,
  grade,
  onBack,
  onGradeChange,
  availableGrades,
}: LexiconScreenProps) {
  const [query, setQuery] = useState("");
  const [onlyDefined, setOnlyDefined] = useState(false);
  const [selected, setSelected] = useState<WordEntry | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("el-GR");
    return words
      .filter((w) => w.grade === grade)
      .filter((w) => !onlyDefined || Boolean(w.definition))
      .filter((w) => {
        if (!q) return true;
        return (
          w.word.toLocaleLowerCase("el-GR").includes(q) ||
          (w.definition?.toLocaleLowerCase("el-GR").includes(q) ?? false)
        );
      })
      .sort((a, b) => a.word.localeCompare(b.word, "el"));
  }, [words, grade, query, onlyDefined]);

  return (
    <main className="screen screen--lexicon fade-in">
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Πίσω
        </button>
        <h1 className="lexicon-title">Λεξικό μαθητή</h1>
      </header>

      <div className="lexicon-filters">
        <div className="grade-options grade-options--compact">
          {[...availableGrades].sort((a, b) => a - b).map((g) => (
            <button
              key={g}
              type="button"
              className={`grade-chip${grade === g ? " grade-chip--active" : ""}`}
              onClick={() => onGradeChange?.(g)}
            >
              {GRADE_LABELS[g] ?? g}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="lexicon-search"
          placeholder="Αναζήτηση λέξης ή ορισμού…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Αναζήτηση"
        />
        <label className="lexicon-check">
          <input
            type="checkbox"
            checked={onlyDefined}
            onChange={(e) => setOnlyDefined(e.target.checked)}
          />
          Μόνο με ορισμό
        </label>
        <p className="hint-text">{filtered.length} λέξεις</p>
      </div>

      <ul className="lexicon-list">
        {filtered.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              className={`lexicon-row${selected?.id === w.id ? " lexicon-row--open" : ""}`}
              onClick={() => setSelected(selected?.id === w.id ? null : w)}
            >
              <span className="lexicon-word">{w.word}</span>
              {w.definition && <span className="lexicon-preview">{w.definition}</span>}
            </button>
            {selected?.id === w.id && (
              <div className="lexicon-detail">
                <AudioPlayer src={`/content/${w.audioFile}`} autoPlay={false} />
                {w.definition && <p>{w.definition}</p>}
                {w.morphemes?.root && (
                  <p className="hint-text">
                    Ρίζα: {w.morphemes.root}
                    {w.morphemes.suffix ? ` · κατάληξη: ${w.morphemes.suffix}` : ""}
                  </p>
                )}
                {w.hintSentence && (
                  <p className="hint-text">{w.hintSentence.replace("___", w.word)}</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
