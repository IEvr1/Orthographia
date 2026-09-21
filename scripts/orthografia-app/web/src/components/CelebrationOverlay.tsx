interface CelebrationOverlayProps {
  goal: number;
  onContinue: () => void;
}

export function CelebrationOverlay({ goal, onContinue }: CelebrationOverlayProps) {
  return (
    <div className="modal-overlay celebration-overlay" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
      <div className="celebration-card bounce-in">
        <div className="celebration-burst" aria-hidden="true">
          <span>✦</span>
          <span>★</span>
          <span>✦</span>
        </div>
        <p className="brand">Ορθογραφία</p>
        <h2 id="celebration-title" className="celebration-title">
          Μπράβο!
        </h2>
        <p className="celebration-message">
          Έφτασες τον στόχο των <strong>{goal}</strong> σωστών απαντήσεων!
        </p>
        <p className="celebration-sub">Γιορτή! Είσαι πρωταθλητής της ορθογραφίας!</p>
        <button type="button" className="btn btn-primary btn-xl" onClick={onContinue}>
          Συνέχεια για νέο στόχο
        </button>
      </div>
    </div>
  );
}
