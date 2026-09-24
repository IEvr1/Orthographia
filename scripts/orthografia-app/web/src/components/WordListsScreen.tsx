import { useMemo, useState, type ClipboardEvent, type MouseEvent } from "react";
import type { WordEntry } from "../types";
import {
  deleteWordList,
  getActiveList,
  loadWordLists,
  MIN_WORDS_TO_PRACTICE,
  removeWordFromList,
  renameWordList,
  setActiveWordList,
  type WordList,
  type WordListsStore,
} from "../lib/wordLists";
import { GRADE_LABELS } from "../lib/grades";

/** Block bulk copy of list words; allow clipboard in form fields. */
function blockWordCopy(e: ClipboardEvent | MouseEvent) {
  const t = e.target as HTMLElement | null;
  if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
  e.preventDefault();
}

interface WordListsScreenProps {
  words: WordEntry[];
  profileId?: string | null;
  onBack: () => void;
  onOpenLexicon: () => void;
  onPracticeList: (list: WordList) => void;
  onChanged?: () => void;
}

export function WordListsScreen({
  words,
  profileId = null,
  onBack,
  onOpenLexicon,
  onPracticeList,
  onChanged,
}: WordListsScreenProps) {
  const [store, setStore] = useState<WordListsStore>(() => loadWordLists(profileId));
  const [expandedId, setExpandedId] = useState<string | null>(store.activeListId);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const byId = useMemo(() => {
    const map = new Map<string, WordEntry>();
    for (const w of words) map.set(w.id, w);
    return map;
  }, [words]);

  const commit = (next: WordListsStore) => {
    setStore(next);
    onChanged?.();
  };

  const active = getActiveList(store);

  return (
    <main
      className="screen screen--lists fade-in"
      onCopy={blockWordCopy}
      onCut={blockWordCopy}
      onContextMenu={blockWordCopy}
    >
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Πίσω
        </button>
        <h1 className="lexicon-title">Λίστες εξάσκησης</h1>
      </header>

      <p className="hint-text lists-intro">
        Φτιάξε μικρές λίστες από το λεξικό (π.χ. «Τεστ Παρασκευής») και δώσε τις στο παιδί για
        εξάσκηση.
      </p>

      <button type="button" className="btn btn-secondary btn-start" onClick={onOpenLexicon}>
        Πρόσθεσε λέξεις από το λεξικό
      </button>

      {store.lists.length === 0 ? (
        <p className="hint-text">Δεν υπάρχουν ακόμη λίστες. Άνοιξε το λεξικό και πρόσθεσε λέξεις.</p>
      ) : (
        <ul className="word-lists">
          {store.lists.map((list) => {
            const open = expandedId === list.id;
            const entries = list.wordIds
              .map((id) => byId.get(id))
              .filter((w): w is WordEntry => Boolean(w));
            const canPractice = entries.length >= MIN_WORDS_TO_PRACTICE;
            const isActive = store.activeListId === list.id;

            return (
              <li key={list.id} className={`word-list-card${isActive ? " word-list-card--active" : ""}`}>
                <button
                  type="button"
                  className="word-list-card__head"
                  onClick={() => setExpandedId(open ? null : list.id)}
                >
                  <span className="word-list-card__title">
                    {list.name}
                    {isActive ? " · ενεργή" : ""}
                  </span>
                  <span className="hint-text">
                    {GRADE_LABELS[list.grade] ?? list.grade} · {entries.length} λέξεις
                  </span>
                </button>

                {open && (
                  <div className="word-list-card__body">
                    {renameId === list.id ? (
                      <div className="list-assign-new">
                        <input
                          className="form-input"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          maxLength={60}
                          aria-label="Νέο όνομα λίστας"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            commit(renameWordList(store, list.id, renameDraft, profileId));
                            setRenameId(null);
                          }}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="word-list-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={!canPractice}
                          onClick={() => onPracticeList(list)}
                        >
                          Ξεκίνα εξάσκηση
                        </button>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => {
                            commit(setActiveWordList(store, list.id, profileId));
                          }}
                        >
                          Στην αρχική
                        </button>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => {
                            setRenameId(list.id);
                            setRenameDraft(list.name);
                          }}
                        >
                          Μετονομασία
                        </button>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => {
                            if (window.confirm(`Διαγραφή «${list.name}»;`)) {
                              commit(deleteWordList(store, list.id, profileId));
                            }
                          }}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    )}

                    {entries.length === 0 ? (
                      <p className="hint-text">Άδεια λίστα — πρόσθεσε λέξεις από το λεξικό.</p>
                    ) : (
                      <ul className="word-list-words">
                        {entries.map((w) => (
                          <li key={w.id}>
                            <span>{w.word}</span>
                            <button
                              type="button"
                              className="btn-text"
                              aria-label={`Αφαίρεσε ${w.word}`}
                              onClick={() =>
                                commit(removeWordFromList(store, list.id, w.id, profileId))
                              }
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {active && active.wordIds.length > 0 && (
        <p className="hint-text">
          Στην αρχική εμφανίζεται: <strong>{active.name}</strong>
        </p>
      )}
    </main>
  );
}
