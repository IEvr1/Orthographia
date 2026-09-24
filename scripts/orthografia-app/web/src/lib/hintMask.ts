import { stripStress } from "./normalize";

/** Canonical cloze marker in word hint sentences (data + resolveClozeHint). */
export const CLOZE_MARKER = "___";

/** Underscores matching the number of letters to type/select (NFC code points). */
export function letterBlank(text: string, minLength = 1): string {
  const n = [...text.normalize("NFC")].length;
  return "_".repeat(Math.max(minLength, n));
}

/** Replace cloze markers with a blank sized to `answer`. */
export function sizeClozeBlank(hint: string, answer: string): string {
  if (!hint.includes(CLOZE_MARKER)) return hint;
  return hint.split(CLOZE_MARKER).join(letterBlank(answer));
}

/** Replace any underscore run in a prompt with a blank sized to `answer`. */
export function sizePromptGaps(prompt: string, answer: string): string {
  return prompt.replace(/_+/g, letterBlank(answer));
}

function normalizeForMatch(text: string): string {
  return stripStress(text.toLowerCase().normalize("NFC")).replace(/ς/g, "σ");
}

interface HintPart {
  text: string;
  isWord: boolean;
}

/** Split hint into word tokens and intervening whitespace/punctuation runs. */
function tokenizeHint(hint: string): HintPart[] {
  const parts: HintPart[] = [];
  const re = /\S+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(hint)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: hint.slice(lastIndex, match.index), isWord: false });
    }
    parts.push({ text: match[0], isWord: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < hint.length) {
    parts.push({ text: hint.slice(lastIndex), isWord: false });
  }

  return parts;
}

/** Strip trailing punctuation from a token before matching; preserve it in output. */
function splitTokenPunctuation(token: string): { word: string; punct: string } {
  const match = token.match(/^(.+?)([.,!?;:»«""…]*)$/u);
  if (!match) return { word: token, punct: "" };
  return { word: match[1], punct: match[2] };
}

function shouldMaskToken(wordPart: string, word: string, root?: string): boolean {
  const normalizedToken = normalizeForMatch(wordPart);
  const normalizedWord = normalizeForMatch(word);
  if (!normalizedToken) return false;

  if (normalizedWord && normalizedToken === normalizedWord) return true;

  const normalizedRoot = root ? normalizeForMatch(root) : "";
  if (normalizedRoot && normalizedToken.startsWith(normalizedRoot)) return true;

  return false;
}

/** Hide the target word (and same-root inflections) inside the hint sentence. */
export function maskWordInHint(hint: string, word: string, root?: string): string {
  return tokenizeHint(hint)
    .map((part) => {
      if (!part.isWord) return part.text;

      const { word: wordPart, punct } = splitTokenPunctuation(part.text);
      if (shouldMaskToken(wordPart, word, root)) {
        return CLOZE_MARKER + punct;
      }
      return part.text;
    })
    .join("");
}

/**
 * Resolve a cloze hint for sentence/choice exercises.
 * Prefers an existing `___`, else masks the target word in place,
 * else appends a trailing blank as a last resort.
 * The marker stays `___`; size it for display with `letterBlank` / `sizeClozeBlank`.
 */
export function resolveClozeHint(hint: string, word: string, root?: string): string {
  if (hint.includes(CLOZE_MARKER)) return hint;

  const masked = maskWordInHint(hint, word, root);
  if (masked.includes(CLOZE_MARKER)) return masked;

  return `${hint.replace(/\.$/, "")} ${CLOZE_MARKER}.`;
}
