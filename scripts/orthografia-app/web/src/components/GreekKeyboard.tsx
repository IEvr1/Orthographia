import { useCallback, useRef, useState } from "react";

interface GreekKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onCheck: () => void;
  disabled?: boolean;
  checkLabel?: string;
}

const ROW1 = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ"];
const ROW2 = ["ν", "ξ", "ο", "π", "ρ", "σ", "ς", "τ", "υ", "φ", "χ", "ψ", "ω"];
const DIGRAPHS = ["αι", "ει", "οι", "ου", "μπ", "ντ", "γκ", "τσ", "τζ"];
const ACCENTED = ["ά", "έ", "ή", "ί", "ό", "ύ", "ώ"];

const ACCENT_MAP: Record<string, string> = {
  α: "ά",
  ε: "έ",
  η: "ή",
  ι: "ί",
  ο: "ό",
  υ: "ύ",
  ω: "ώ",
};

export function GreekKeyboard({
  value,
  onChange,
  onCheck,
  disabled = false,
  checkLabel = "Έλεγξε",
}: GreekKeyboardProps) {
  const [showAccents, setShowAccents] = useState(false);
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
      const lower = chars[i].toLowerCase();
      const accented = ACCENT_MAP[lower];
      if (accented) {
        chars[i] = accented;
        onChange(chars.join(""));
        return;
      }
    }
  };

  const handlePointerDown = (key: string) => {
    longPressKey.current = key;
    longPressTimer.current = window.setTimeout(() => {
      const accented = ACCENT_MAP[key];
      if (accented) append(accented);
      longPressKey.current = null;
    }, 450);
  };

  const handlePointerUp = (key: string) => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressKey.current === key) {
      append(key);
    }
    longPressKey.current = null;
  };

  return (
    <div className="keyboard">
      <label className="input-label" htmlFor="word-input">
        Γράψε εδώ
      </label>
      <input
        id="word-input"
        className="word-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Γράψε τη λέξη"
      />

      <div className="keyboard-rows">
        {[ROW1, ROW2].map((row, ri) => (
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
                {key}
              </button>
            ))}
          </div>
        ))}

        <div className="keyboard-row keyboard-row--digraphs">
          {DIGRAPHS.map((d) => (
            <button
              key={d}
              type="button"
              className="key key--wide"
              disabled={disabled}
              onClick={() => append(d)}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="keyboard-row keyboard-row--actions">
          <button
            type="button"
            className="key key--action"
            disabled={disabled}
            onClick={() => setShowAccents((s) => !s)}
          >
            {showAccents ? "abc" : "Ά"}
          </button>
          {showAccents &&
            ACCENTED.map((a) => (
              <button key={a} type="button" className="key" disabled={disabled} onClick={() => append(a)}>
                {a}
              </button>
            ))}
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
            onClick={onCheck}
          >
            {checkLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
