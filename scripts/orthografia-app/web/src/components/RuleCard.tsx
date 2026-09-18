interface RuleCardProps {
  onContinue: () => void;
}

const EXAMPLES = [
  { word: "ήλιος", hint: "Ο ήλιος λάμπει ψηλά." },
  { word: "πόρτα", hint: "Χτύπησε στην πόρτα." },
  { word: "βιβλίο", hint: "Διάβασα ένα βιβλίο." },
];

export function RuleCard({ onContinue }: RuleCardProps) {
  return (
    <main className="screen screen--rule fade-in">
      <div className="rule-card">
        <p className="rule-badge">Κανόνας</p>
        <h1 className="rule-title">Ο τόνος δείχνει ποια συλλαβή τονούμε</h1>
        <p className="rule-body">
          Στην ορθογραφία βάζουμε τόνο πάνω από το φωνήεν της τονισμένης συλλαβής. Έτσι
          ξέρουμε πώς να διαβάζουμε και να γράφουμε τη λέξη σωστά.
        </p>

        <ul className="rule-examples">
          {EXAMPLES.map((ex) => (
            <li key={ex.word}>
              <span className="rule-example-word">{ex.word}</span>
              <span className="rule-example-hint">{ex.hint}</span>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-primary btn-xl" onClick={onContinue}>
          Ξεκινάμε!
        </button>
      </div>
    </main>
  );
}
