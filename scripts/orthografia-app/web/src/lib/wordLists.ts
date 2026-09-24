import { getActiveProfileId } from "./subscription";

const STORAGE_PREFIX = "orthografia-word-lists-v1";

export const MAX_LISTS = 20;
export const MAX_WORDS_PER_LIST = 30;
export const MIN_WORDS_TO_PRACTICE = 1;

export interface WordList {
  id: string;
  name: string;
  grade: number;
  wordIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WordListsStore {
  lists: WordList[];
  /** List highlighted on Home for quick practice. */
  activeListId: string | null;
}

function storageKey(profileId?: string | null): string {
  const id = profileId ?? getActiveProfileId();
  return id ? `${STORAGE_PREFIX}-${id}` : STORAGE_PREFIX;
}

function emptyStore(): WordListsStore {
  return { lists: [], activeListId: null };
}

export function loadWordLists(profileId?: string | null): WordListsStore {
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<WordListsStore>;
    return {
      lists: Array.isArray(parsed.lists) ? parsed.lists : [],
      activeListId: parsed.activeListId ?? null,
    };
  } catch {
    return emptyStore();
  }
}

export function saveWordLists(store: WordListsStore, profileId?: string | null): void {
  localStorage.setItem(storageKey(profileId), JSON.stringify(store));
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getActiveList(store: WordListsStore): WordList | null {
  if (!store.activeListId) return null;
  return store.lists.find((l) => l.id === store.activeListId) ?? null;
}

export function createWordList(
  store: WordListsStore,
  name: string,
  grade: number,
  profileId?: string | null,
): WordListsStore {
  const trimmed = name.trim().slice(0, 60) || "Νέα λίστα";
  if (store.lists.length >= MAX_LISTS) return store;
  const now = new Date().toISOString();
  const list: WordList = {
    id: newId(),
    name: trimmed,
    grade,
    wordIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const next: WordListsStore = {
    lists: [list, ...store.lists],
    activeListId: store.activeListId ?? list.id,
  };
  saveWordLists(next, profileId);
  return next;
}

export function renameWordList(
  store: WordListsStore,
  listId: string,
  name: string,
  profileId?: string | null,
): WordListsStore {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return store;
  const next: WordListsStore = {
    ...store,
    lists: store.lists.map((l) =>
      l.id === listId ? { ...l, name: trimmed, updatedAt: new Date().toISOString() } : l,
    ),
  };
  saveWordLists(next, profileId);
  return next;
}

export function deleteWordList(
  store: WordListsStore,
  listId: string,
  profileId?: string | null,
): WordListsStore {
  const lists = store.lists.filter((l) => l.id !== listId);
  const next: WordListsStore = {
    lists,
    activeListId: store.activeListId === listId ? (lists[0]?.id ?? null) : store.activeListId,
  };
  saveWordLists(next, profileId);
  return next;
}

export function setActiveWordList(
  store: WordListsStore,
  listId: string | null,
  profileId?: string | null,
): WordListsStore {
  const next: WordListsStore = { ...store, activeListId: listId };
  saveWordLists(next, profileId);
  return next;
}

export function addWordToList(
  store: WordListsStore,
  listId: string,
  wordId: string,
  profileId?: string | null,
): { store: WordListsStore; ok: boolean; reason?: string } {
  const list = store.lists.find((l) => l.id === listId);
  if (!list) return { store, ok: false, reason: "Η λίστα δεν βρέθηκε." };
  if (list.wordIds.includes(wordId)) {
    return { store, ok: false, reason: "Η λέξη είναι ήδη στη λίστα." };
  }
  if (list.wordIds.length >= MAX_WORDS_PER_LIST) {
    return { store, ok: false, reason: `Μέχρι ${MAX_WORDS_PER_LIST} λέξεις ανά λίστα.` };
  }
  const next: WordListsStore = {
    ...store,
    lists: store.lists.map((l) =>
      l.id === listId
        ? {
            ...l,
            wordIds: [...l.wordIds, wordId],
            updatedAt: new Date().toISOString(),
          }
        : l,
    ),
  };
  saveWordLists(next, profileId);
  return { store: next, ok: true };
}

export function removeWordFromList(
  store: WordListsStore,
  listId: string,
  wordId: string,
  profileId?: string | null,
): WordListsStore {
  const next: WordListsStore = {
    ...store,
    lists: store.lists.map((l) =>
      l.id === listId
        ? {
            ...l,
            wordIds: l.wordIds.filter((id) => id !== wordId),
            updatedAt: new Date().toISOString(),
          }
        : l,
    ),
  };
  saveWordLists(next, profileId);
  return next;
}

export function ensureDefaultList(
  store: WordListsStore,
  grade: number,
  profileId?: string | null,
): WordListsStore {
  if (store.lists.length > 0) return store;
  return createWordList(store, "Λίστα εξάσκησης", grade, profileId);
}
