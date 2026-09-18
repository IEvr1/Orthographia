import { useState } from "react";
import { saveLocalConsent } from "../lib/consent";

interface ConsentScreenProps {
  onAccepted: () => void;
}

export function ConsentScreen({ onAccepted }: ConsentScreenProps) {
  const [isAdult, setIsAdult] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  const canProceed = isAdult && acceptedPolicy;

  const handleAccept = () => {
    if (!canProceed) return;
    saveLocalConsent();
    onAccepted();
  };

  return (
    <main className="screen screen--legal fade-in">
      <div className="legal-card">
        <p className="brand">Ορθογραφία</p>
        <h1 className="legal-title">Συγκατάθεση γονέα / κηδεμόνα</h1>
        <p className="legal-lead">
          Η εφαρμογή απευθύνεται σε παιδιά Δημοτικού. Σύμφωνα με τον GDPR, απαιτείται η
          συγκατάθεση γονέα ή νόμιμου κηδεμόνα πριν από τη χρήση.
        </p>

        <section className="legal-section">
          <h2>Τι δεδομένα συλλέγουμε</h2>
          <ul className="legal-list">
            <li>Πρόοδος εξάσκησης (λέξεις, σωστές/λανθασμένες απαντήσεις, επανάληψη FSRS)</li>
            <li>Αναγνωριστικό συσκευής για συγχρονισμό cloud (αν ενεργοποιηθεί)</li>
            <li>Email λογαριασμού γονέα (μέσω Clerk) για συνδρομή και cloud sync</li>
            <li>Κατάσταση συνδρομής Stripe (χωρίς αποθήκευση στοιχείων κάρτας)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Τα δικαιώματά σας</h2>
          <ul className="legal-list">
            <li>
              <strong>Εξαγωγή:</strong> «Εξαγωγή προόδου» από την αρχική οθόνη (JSON)
            </li>
            <li>
              <strong>Διαγραφή:</strong> email στο{" "}
              <a href="mailto:privacy@orthografia.app">privacy@orthografia.app</a> ή διαγραφή
              λογαριασμού Clerk
            </li>
            <li>
              <strong>Cookies / localStorage:</strong> μόνο για πρόοδο, συγκατάθεση και PWA — όχι
              διαφημιστική παρακολούθηση
            </li>
          </ul>
        </section>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={isAdult}
            onChange={(e) => setIsAdult(e.target.checked)}
          />
          <span>Είμαι γονέας ή κηδεμόνας άνω των 18 ετών και χρησιμοποιώ την εφαρμογή για το παιδί μου.</span>
        </label>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(e) => setAcceptedPolicy(e.target.checked)}
          />
          <span>
            Έχω διαβάσει και αποδέχομαι την{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              Πολιτική Απορρήτου
            </a>{" "}
            και τους{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Όρους Χρήσης
            </a>{" "}
            (έκδοση privacy-v1).
          </span>
        </label>

        <button
          type="button"
          className="btn btn-primary btn-xl"
          disabled={!canProceed}
          onClick={handleAccept}
        >
          Συνέχεια
        </button>
      </div>
    </main>
  );
}
