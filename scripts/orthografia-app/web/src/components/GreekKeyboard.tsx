import { useCallback, useRef, useState } from "react";

interface GreekKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onCheck: () => void;
  disabled?: boolean;
  /** Hide letter keys after check so feedback is visible without scrolling. */
  hideKeys?: boolean;
  checkLabel?: string;
}

/** Standard Greek QWERTY layout (phone / laptop), not alphabetical. */
const ROWS = [
  ["ς", "ε", "ρ", "τ", "υ", "θ", "ι", "ο", "π"],
  ["α", "σ", "δ", "φ", "γ", "η", "ξ", "κ", "λ"],
  ["ζ", "χ", "ψ", "ω", "β", "ν", "μ"],
];

const ACCENT_MAP: Record<string, string> = {
  α: "ά",
  ε: "έ",
  η: "ή",
  ι: "ί",
  ο: "ό",
  υ: "ύ",
  ω: "ώ",
};

function withCase(ch: string, upper: boolean): string {
  return upper ? ch.toUpperCase() : ch;
}

export function GreekKeyboard({
  value,
  onChange,
  onCheck,
  disabled = false,
  hideKeys = false,
  checkLabel = "Έλεγξε",
}: GreekKeyboardProps) {
  const [caps, setCaps] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressKey = useRef<string | null>(null);

  const append = useCallback(
    (ch: string) => {
      if (disabled) return;
      onChange(value + ch);
    },
    [disabled, onChange, value],
  );

  const backspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  const accentLastVowel = () => {
    if (disabled || !value) return;
    const chars = [...value];
    for (let i = chars.length - 1; i >= 0; i--) {
      const ch = chars[i];
      const lower = ch.toLowerCase();
      const accented = ACCENT_MAP[lower];
      if (accented) {
        chars[i] = ch === lower ? accented : accented.toUpperCase();
        onChange(chars.join(""));
        return;
      }
    }
  };

  const handlePointerDown = (key: string) => {
    longPressKey.current = key;
    longPressTimer.current = window.setTimeout(() => {
      const accented = ACCENT_MAP[key];
      if (accented) append(withCase(accented, caps));
      longPressKey.current = null;
    }, 450);
  };

  const handlePointerUp = (key: string) => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressKey.current === key) {
      append(withCase(key, caps));
    }
    longPressKey.current = null;
  };

  const handleCheckClick = () => {
    inputRef.current?.blur();
    onCheck();
  };

  return (
    <div className={`keyboard${hideKeys ? " keyboard--compact" : ""}`}>
      <label className="input-label" htmlFor="word-input">
        {hideKeys ? "Η απάντησή σου" : "Γράψε εδώ"}
      </label>
      <input
        ref={inputRef}
        id="word-input"
        className="word-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || hideKeys}
        readOnly={hideKeys}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Γράψε τη λέξη"
      />

      {!hideKeys && (
        <div className="keyboard-rows">
          {ROWS.map((row, ri) => (
            <div className="keyboard-row" key={ri}>
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="key"
                  disabled={disabled}
                  onPointerDown={() => handlePointerDown(key)}
                  onPointerUp={() => handlePointerUp(key)}
                  onPointerLeave={() => {
                    if (longPressTimer.current) {
                      window.clearTimeout(longPressTimer.current);
                      longPressTimer.current = null;
                    }
                    longPressKey.current = null;
                  }}
                >
                  {withCase(key, caps)}
                </button>
              ))}
            </div>
          ))}

          <div className="keyboard-row keyboard-row--actions">
            <button
              type="button"
              className={`key key--action${caps ? " key--caps-on" : ""}`}
              disabled={disabled}
              aria-pressed={caps}
              aria-label="Κεφαλαία"
              onClick={() => setCaps((v) => !v)}
            >
              Αα
            </button>
            <button type="button" className="key key--action" disabled={disabled} onClick={accentLastVowel}>
              τόνος
            </button>
            <button type="button" className="key key--action" disabled={disabled} onClick={backspace}>
              ⌫
            </button>
            <button
              type="button"
              className="key key--check"
              disabled={disabled || !value.trim()}
              onClick={handleCheckClick}
            >
              {checkLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
