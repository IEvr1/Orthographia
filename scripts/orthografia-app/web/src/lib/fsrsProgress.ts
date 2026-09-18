import {
  type Card,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Grade,
} from "ts-fsrs";

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, maximum_interval: 90 }));

export interface FsrsSnapshot {
  due: string;
  stability: number;
  difficulty: number;
  state: string;
  reps: number;
  lapses: number;
}

export function emptyFsrsSnapshot(now = new Date()): FsrsSnapshot {
  const card = createEmptyCard(now);
  return cardToSnapshot(card);
}

function cardToSnapshot(card: Card): FsrsSnapshot {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    state: State[card.state] ?? "New",
    reps: card.reps,
    lapses: card.lapses,
  };
}

function snapshotToCard(snapshot: FsrsSnapshot): Card {
  const base = createEmptyCard(new Date(snapshot.due));
  const stateKey = snapshot.state as keyof typeof State;
  const stateVal = State[stateKey] ?? State.New;
  return {
    ...base,
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    state: stateVal,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
  };
}

export function ratingFromAttempt(correct: boolean, hadRewrite: boolean): Rating {
  if (!correct) return Rating.Again;
  if (hadRewrite) return Rating.Hard;
  return Rating.Good;
}

export function scheduleReview(
  snapshot: FsrsSnapshot | undefined,
  correct: boolean,
  hadRewrite: boolean,
  now = new Date(),
): FsrsSnapshot {
  const card = snapshot ? snapshotToCard(snapshot) : createEmptyCard(now);
  const rating = ratingFromAttempt(correct, hadRewrite) as Grade;
  const result = scheduler.repeat(card, now)[rating];
  return cardToSnapshot(result.card);
}

export function isDue(snapshot: FsrsSnapshot | undefined, now = new Date()): boolean {
  if (!snapshot) return true;
  return new Date(snapshot.due).getTime() <= now.getTime();
}

export function daysUntilDue(snapshot: FsrsSnapshot | undefined, now = new Date()): number {
  if (!snapshot) return 0;
  return (new Date(snapshot.due).getTime() - now.getTime()) / 86400000;
}
