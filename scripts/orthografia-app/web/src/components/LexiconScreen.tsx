import { useMemo, useState, type ClipboardEvent, type MouseEvent } from "react";
import type { WordEntry } from "../types";
import {
  addWordToList,
  createWordList,
  ensureDefaultList,
  loadWordLists,
  type WordList,
  type WordListsStore,
} from "../lib/wordLists";
import { AudioPlayer } from "./AudioPlayer";
import { GRADE_LABELS } from "../lib/grades";

/** Block bulk copy of lexicon words; allow clipboard in form fields. */
function blockWordCopy(e: ClipboardEvent | MouseEvent) {
  const t = e.target as HTMLElement | null;
  if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
  e.preventDefault();
}

interface LexiconScreenProps {
  words: WordEntry[];
  grade: number;
  onBack: () => void;
  onGradeChange?: (grade: number) => void;
  availableGrades: Set<number>;
  profileId?: string | null;
  onOpenLists?: () => void;
  onListsChanged?: () => void;
}

export function LexiconScreen({
  words,
  grade,
  onBack,
  onGradeChange,
  availableGrades,
  profileId = null,
  onOpenLists,
  onListsChanged,
}: LexiconScreenProps) {
  const [query, setQuery] = useState("");
  const [onlyDefined, setOnlyDefined] = useState(false);
  const [selected, setSelected] = useState<WordEntry | null>(null);
  const [listsStore, setListsStore] = useState<WordListsStore>(() =>
    ensureDefaultList(loadWordLists(profileId), grade, profileId),
  );
  const [targetListId, setTargetListId] = useState<string>(
    () => listsStore.activeListId ?? listsStore.lists[0]?.id ?? "",
  );
  const [toast, setToast] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");

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

  const targetList: WordList | undefined = listsStore.lists.find((l) => l.id === targetListId);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const refreshLists = (next: WordListsStore) => {
    setListsStore(next);
    if (!next.lists.some((l) => l.id === targetListId) && next.lists[0]) {
      setTargetListId(next.lists[0].id);
    }
    onListsChanged?.();
  };

  const handleAdd = (word: WordEntry) => {
    let store = listsStore;
    if (store.lists.length === 0) {
      store = ensureDefaultList(store, grade, profileId);
    }
    const listId = targetListId || store.lists[0]?.id;
    if (!listId) return;
    const result = addWordToList(store, listId, word.id, profileId);
    refreshLists(result.store);
    flash(result.ok ? `Προστέθηκε: ${word.word}` : result.reason ?? "Σφάλμα");
  };

  const handleCreateList = () => {
    const next = createWordList(listsStore, newListName || "Νέα λίστα", grade, profileId);
    refreshLists(next);
    if (next.lists[0]) setTargetListId(next.lists[0].id);
    setNewListName("");
    flash("Δημιουργήθηκε νέα λίστα");
  };

  return (
    <main
      className="screen screen--lexicon fade-in"
      onCopy={blockWordCopy}
      onCut={blockWordCopy}
      onContextMenu={blockWordCopy}
    >
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Πίσω
        </button>
        <h1 className="lexicon-title">Λεξικό μαθητή</h1>
        {onOpenLists && (
          <button type="button" className="btn-text" onClick={onOpenLists}>
            Λίστες
          </button>
        )}
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

        <div className="list-assign-bar">
          <label className="form-label" htmlFor="target-list">
            Πρόσθεσε στη λίστα
            <select
              id="target-list"
              className="form-input"
              value={targetListId}
              onChange={(e) => setTargetListId(e.target.value)}
            >
              {listsStore.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.wordIds.length})
                </option>
              ))}
            </select>
          </label>
          <div className="list-assign-new">
            <input
              type="text"
              className="form-input"
              placeholder="Όνομα νέας λίστας…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              maxLength={60}
            />
            <button type="button" className="btn btn-secondary" onClick={handleCreateList}>
              Νέα
            </button>
          </div>
          {targetList && (
            <p className="hint-text">
              Ενεργή: <strong>{targetList.name}</strong> · {targetList.wordIds.length} λέξεις
            </p>
          )}
        </div>

        <p className="hint-text">{filtered.length} λέξεις</p>
        {toast && (
          <p className="hint-text settings-saved" role="status">
            {toast}
          </p>
        )}
      </div>

      <ul className="lexicon-list">
        {filtered.map((w) => {
          const inList = targetList?.wordIds.includes(w.id);
          return (
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={inList}
                    onClick={() => handleAdd(w)}
                  >
                    {inList ? "Ήδη στη λίστα" : "Πρόσθεσε στη λίστα"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
