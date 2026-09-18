import type { RuleDefinition } from "../types";

interface RuleCardProps {
  rule: RuleDefinition;
  onContinue: () => void;
}

export function RuleCard({ rule, onContinue }: RuleCardProps) {
  return (
    <main className="screen screen--rule fade-in">
      <div className="rule-card">
        <p className="rule-badge">Κανόνας</p>
        <h1 className="rule-title">{rule.title}</h1>
        <p className="rule-body">{rule.body}</p>

        {rule.examples.length > 0 && (
          <ul className="rule-examples">
            {rule.examples.map((ex) => (
              <li key={ex.word}>
                <span className="rule-example-word">{ex.word}</span>
                <span className="rule-example-hint">{ex.hint}</span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn-primary btn-xl" onClick={onContinue}>
          Ξεκινάμε!
        </button>
      </div>
    </main>
  );
}
