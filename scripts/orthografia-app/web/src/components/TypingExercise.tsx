import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { FamiliesPayload, GradeResult, SessionSummary, WordEntry } from "../types";
import { resolveFamily } from "../lib/families";
import { gradeAnswer } from "../lib/grader";
import { resolveClozeHint, CLOZE_MARKER, letterBlank } from "../lib/hintMask";
import { pickMisspelling, scrambleWord } from "../lib/spellingVariants";
import { useExerciseFlow } from "../lib/useExerciseFlow";
import { AudioPlayer } from "./AudioPlayer";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { DifficultyBadge } from "./DifficultyBadge";
import { ExerciseHeader } from "./ExerciseHeader";
import { FeedbackPanel } from "./FeedbackPanel";
import { GreekKeyboard } from "./GreekKeyboard";
import { SessionProgress } from "./SessionProgress";

export type TypingMode = "sentence" | "dictation" | "error-fix" | "scramble" | "morphemes";

interface TypingExerciseProps {
  mode: TypingMode;
  words: WordEntry[];
  families?: FamiliesPayload | null;
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
}

type Phase = "writing" | "feedback" | "rewrite";

const TITLES: Record<TypingMode, string> = {
  sentence: "Πρόταση",
  dictation: "Υπαγόρευση",
  "error-fix": "Διόρθωση",
  scramble: "Ανακάτεμα",
  morphemes: "Μορφήματα",
};

/** Which scramble tiles are already consumed by the current input (greedy left-to-right). */
function scrambleTileUsed(scrambled: string, input: string): boolean[] {
  const tiles = [...scrambled.normalize("NFC")];
  const used = tiles.map(() => false);
  for (const ch of [...input.normalize("NFC")]) {
    const idx = tiles.findIndex((tile, i) => !used[i] && tile === ch);
    if (idx >= 0) used[idx] = true;
  }
  return used;
}

/** Extend the correct prefix by one letter — gentle progressive hint. */
function nextScrambleHelp(word: string, input: string): string {
  const target = [...word.normalize("NFC")];
  const typed = [...input.normalize("NFC")];
  let prefixLen = 0;
  while (
    prefixLen < typed.length &&
    prefixLen < target.length &&
    typed[prefixLen] === target[prefixLen]
  ) {
    prefixLen += 1;
  }
  if (prefixLen >= target.length) return word;
  return target.slice(0, prefixLen + 1).join("");
}

export function TypingExercise({
  mode,
  words,
  families = null,
  onComplete,
  onQuit,
  sessionBanner = null,
}: TypingExerciseProps) {
  const {
    index,
    current,
    celebrationGoal,
    finishCelebration,
    onCorrect,
    onWrong,
    onSkip,
  } = useExerciseFlow({ words, onComplete });

  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("writing");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [helpCount, setHelpCount] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const misspelling = useMemo(
    () => (mode === "error-fix" ? pickMisspelling(current.word) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh per word
    [mode, current.id],
  );
  const scrambled = useMemo(
    () => (mode === "scramble" ? scrambleWord(current.word) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, current.id],
  );
  const scrambleTiles = useMemo(
    () => (mode === "scramble" ? [...scrambled.normalize("NFC")] : []),
    [mode, scrambled],
  );
  const scrambleUsed = useMemo(
    () => (mode === "scramble" ? scrambleTileUsed(scrambled, input) : []),
    [mode, scrambled, input],
  );
  const scrambleSlots = useMemo(
    () => (mode === "scramble" ? [...current.word.normalize("NFC")] : []),
    [mode, current.word],
  );

  const sentence = resolveClozeHint(
    current.hintSentence,
    current.word,
    current.morphemes.root,
  );
  const family = resolveFamily(current, families);
  const audioSrc = `/content/${current.audioFile}`;
  const targetWord =
    mode === "morphemes" ? current.morphemes.suffix.replace(/^-/, "") : current.word;
  const wordBlank = letterBlank(targetWord);

  useEffect(() => {
    setInput("");
    setPhase("writing");
    setResult(null);
    setHelpCount(0);
  }, [index, current.id]);

  useEffect(() => {
    if (phase !== "feedback" || !result) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phase, result]);

  const handleCheck = () => {
    const entryForGrade =
      mode === "morphemes"
        ? { ...current, word: targetWord, morphemes: { root: "", suffix: targetWord } }
        : current;
    const graded = gradeAnswer(entryForGrade, input.trim());
    setResult(graded);
    if (graded.isCorrect) {
      setPhase("feedback");
      onCorrect({
        hadRewrite: phase === "rewrite",
        delayMs: current.definition || family ? 2300 : 1200,
      });
    } else {
      if (phase === "writing") {
        onWrong(graded.errorCategory);
      }
      setPhase("feedback");
    }
  };

  const showingFeedback = phase === "feedback" && result !== null;

  const needsRewrite = phase === "feedback" && result && !result.isCorrect;
  const showingCorrectFeedback = phase === "feedback" && result?.isCorrect === true;
  const canSkip = !showingCorrectFeedback && celebrationGoal === null;
  const canUseScrambleHelp =
    mode === "scramble" &&
    !showingCorrectFeedback &&
    celebrationGoal === null &&
    input.normalize("NFC") !== current.word.normalize("NFC");

  return (
    <main className="screen screen--exercise fade-in">
      {celebrationGoal !== null && (
        <CelebrationOverlay goal={celebrationGoal} onContinue={finishCelebration} />
      )}
      <ExerciseHeader
        onBack={onQuit}
        showNext={canSkip}
        onNext={() =>
          onSkip(phase === "rewrite" || (phase === "feedback" && result !== null && !result.isCorrect))
        }
      >
        <SessionProgress
          current={index + 1}
          total={words.length}
          label={`${TITLES[mode]} ${index + 1} από ${words.length}`}
        >
          <DifficultyBadge word={current} />
        </SessionProgress>
        {sessionBanner && index === 0 && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </ExerciseHeader>

      <section className="exercise-body">
        {(mode === "sentence" || mode === "dictation") && (
          <AudioPlayer src={audioSrc} autoPlay autoPlayDelayMs={mode === "dictation" ? 800 : 3000} key={current.id} />
        )}

        {mode === "sentence" && (
          <p className="hint-sentence">
            <span className="hint-label">Συμπλήρωσε τη λέξη στην πρόταση</span>
            {sentence.split(CLOZE_MARKER).map((part, i, parts) => (
              <Fragment key={i}>
                {part}
                {i < parts.length - 1 && (
                  <span className="hint-blank hint-blank--sized" aria-hidden="true">
                    {wordBlank}
                  </span>
                )}
              </Fragment>
            ))}
          </p>
        )}

        {mode === "dictation" && (
          <p className="hint-sentence">
            <span className="hint-label">Άκου και γράψε τη λέξη</span>
            <span className="hint-blank hint-blank--sized" aria-hidden="true">
              {wordBlank}
            </span>
          </p>
        )}

        {mode === "error-fix" && (
          <p className="hint-sentence">
            <span className="hint-label">Διόρθωσε τη λέξη</span>
            <span className="misspelled-word">{misspelling}</span>
            {current.hintSentence.includes(CLOZE_MARKER) && (
              <span className="hint-context">{sentence.replace(CLOZE_MARKER, "…")}</span>
            )}
          </p>
        )}

        {mode === "scramble" && (
          <div className="hint-sentence scramble-prompt">
            <span className="hint-label">Πάτα τα γράμματα στη σωστή σειρά</span>
            {current.definition?.trim() && (
              <p className="scramble-clue">
                <span className="lexicon-label">Ορισμός:</span> {current.definition}
              </p>
            )}
            {sentence.includes(CLOZE_MARKER) && (
              <p className="scramble-clue scramble-clue--sentence">
                <span className="lexicon-label">Πρόταση:</span>{" "}
                {sentence.split(CLOZE_MARKER).map((part, i, parts) => (
                  <Fragment key={i}>
                    {part}
                    {i < parts.length - 1 && (
                      <span className="hint-blank hint-blank--sized" aria-hidden="true">
                        {wordBlank}
                      </span>
                    )}
                  </Fragment>
                ))}
              </p>
            )}
            <span className="scramble-letters" aria-label="Ανακατεμένα γράμματα">
              {scrambleTiles.map((ch, i) => {
                const used = scrambleUsed[i] === true;
                return (
                  <button
                    key={`${ch}-${i}`}
                    type="button"
                    className={`scramble-tile${used ? " scramble-tile--used" : ""}`}
                    disabled={used || showingCorrectFeedback}
                    aria-label={used ? `Χρησιμοποιήθηκε το ${ch}` : `Πρόσθεσε το ${ch}`}
                    onClick={() => {
                      if (used || showingCorrectFeedback) return;
                      setInput((prev) => prev + ch);
                      if (phase === "feedback") {
                        setPhase("writing");
                        setResult(null);
                      }
                    }}
                  >
                    {ch}
                  </button>
                );
              })}
            </span>
            <span className="scramble-slots" aria-label="Η λέξη που σχηματίζεις" aria-live="polite">
              {scrambleSlots.map((_, i) => {
                const typed = [...input.normalize("NFC")];
                const ch = typed[i];
                return (
                  <span
                    key={i}
                    className={`scramble-slot${ch ? " scramble-slot--filled" : ""}`}
                  >
                    {ch ?? ""}
                  </span>
                );
              })}
            </span>
            {canUseScrambleHelp && (
              <button
                type="button"
                className="btn-text scramble-help-btn"
                onClick={() => {
                  setInput((prev) => nextScrambleHelp(current.word, prev));
                  setHelpCount((n) => n + 1);
                  if (phase === "feedback") {
                    setPhase("writing");
                    setResult(null);
                  }
                }}
              >
                {helpCount === 0 ? "Χρειάζομαι βοήθεια" : "Ακόμα μία βοήθεια"}
              </button>
            )}
          </div>
        )}

        {mode === "morphemes" && (
          <p className="hint-sentence">
            <span className="hint-label">Συμπλήρωσε την κατάληξη</span>
            <span className="morpheme-prompt">
              <strong>{current.morphemes.root || "…"}</strong>
              <span className="hint-blank hint-blank--sized" aria-hidden="true">
                {wordBlank}
              </span>
            </span>
          </p>
        )}

        <GreekKeyboard
          value={input}
          onChange={setInput}
          onCheck={handleCheck}
          disabled={showingCorrectFeedback}
          hideKeys={showingFeedback}
          checkLabel={phase === "rewrite" ? "Έλεγξε ξανά" : "Έλεγξε"}
        />

        {showingFeedback && (
          <div ref={feedbackRef} className="feedback-anchor">
            <FeedbackPanel
              result={result}
              correctWord={targetWord}
              mode={needsRewrite ? "rewrite" : "check"}
              definition={current.definition}
              family={family}
            />
            {needsRewrite && (
              <button
                type="button"
                className="btn btn-primary btn-xl"
                onClick={() => {
                  setInput("");
                  setPhase("rewrite");
                  setResult(null);
                }}
              >
                Γράψε τη σωστή
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
