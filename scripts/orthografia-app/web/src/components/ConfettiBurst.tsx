import type { CSSProperties } from "react";

/** Light brand-colored confetti for session end / reward celebration. */
const PIECES = 28;

const COLORS = [
  "var(--highlight)",
  "var(--teal)",
  "var(--sky)",
  "var(--coral)",
  "var(--ok)",
  "#f6bd60",
];

export function ConfettiBurst() {
  return (
    <div className="confetti-burst" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        const left = ((i * 37) % 100) + (i % 3) * 0.4;
        const delay = (i % 10) * 0.05;
        const duration = 1.6 + (i % 5) * 0.12;
        const size = 6 + (i % 4) * 2;
        const rotate = (i * 47) % 360;
        const shape = i % 3; // 0 square, 1 tall, 2 circle
        return (
          <span
            key={i}
            className={`confetti-piece confetti-piece--${shape}`}
            style={
              {
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                width: shape === 2 ? size : size * (shape === 1 ? 0.45 : 1),
                height: shape === 1 ? size * 1.6 : size,
                background: COLORS[i % COLORS.length],
                "--confetti-rot": `${rotate}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
