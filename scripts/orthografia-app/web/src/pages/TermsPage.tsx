export function TermsPage() {
  return (
    <main className="screen screen--legal fade-in">
      <div className="legal-card legal-card--wide">
        <a href="/" className="btn-text">← Επιστροφή</a>
        <h1 className="legal-title">Όροι Χρήσης</h1>
        <p className="legal-meta">Έκδοση privacy-v1 · Τελευταία ενημέρωση: Σεπτέμβριος 2026</p>

        <section className="legal-section">
          <h2>1. Αποδοχή όρων</h2>
          <p>
            Η χρήση της εφαρμογής «Ορθογραφία» υπόκειται σε αυτούς τους όρους. Ο γονέας ή κηδεμόνας
            που δημιουργεί λογαριασμό δηλώνει ότι είναι άνω των 18 ετών και συναινεί για τη χρήση από
            το παιδί του.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Περιγραφή υπηρεσίας</h2>
          <p>
            Η εφαρμογή παρέχει εκπαιδευτικές ασκήσεις ελληνικής ορθογραφίας για μαθητές
            Δημοτικού (τάξεις Β΄–Στ΄). Απαιτείται σύνδεση λογαριασμού για εξάσκηση. Νέοι
            χρήστες λαμβάνουν δωρεάν δοκιμή 5 ημερών με πλήρη πρόσβαση σε όλες τις τάξεις και τους
            τρόπους εξάσκησης. Μετά τη λήξη της δοκιμής, η εξάσκηση συνεχίζεται μόνο με ενεργή
            συνδρομή.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Συνδρομές και πληρωμές</h2>
          <ul className="legal-list">
            <li>Παιδικό ετήσιο: 39€/έτος</li>
            <li>Παιδικό μηνιαίο: 4,90€/μήνα</li>
            <li>Οικογενειακό ετήσιο: 59€/έτος (έως 4 παιδιά)</li>
          </ul>
          <p>
            Οι πληρωμές διεκπεραιώνονται μέσω Stripe. Η ακύρωση γίνεται από τον λογαριασμό Stripe
            Customer Portal ή επικοινωνώντας μαζί μας.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Υποχρεώσεις χρήστη</h2>
          <p>
            Ο γονέας/κηδεμόνας είναι υπεύθυνος για την επίβλεψη της χρήσης από το παιδί και για την
            ακρίβεια των στοιχείων λογαριασμού.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Περιορισμός ευθύνης</h2>
          <p>
            Η εφαρμογή παρέχεται «ως έχει» για εκπαιδευτικούς σκοπούς. Δεν εγγυόμαστε ακαδημαϊκά
            αποτελέσματα. Δεν φέρουμε ευθύνη για διακοπές υπηρεσίας τρίτων (Clerk, Stripe, Vercel).
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Τερματισμός</h2>
          <p>
            Μπορείτε να διαγράψετε τον λογαριασμό σας ανά πάσα στιγμή. Με τη διαγραφή τερματίζεται η
            πρόσβαση στη συνδρομή σύμφωνα με την πολιτική επιστροφών Stripe.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Επικοινωνία</h2>
          <p>
            Για ερωτήσεις χρησιμοποιήστε τη φόρμα{" "}
            <a href="/contact">Επικοινωνία</a> ή το email{" "}
            <a href="mailto:info@nexaipla.com">info@nexaipla.com</a>.
          </p>
        </section>

        <footer className="legal-footer">
          <a href="/privacy">Απορρήτο</a>
          <span>·</span>
          <a href="/contact">Επικοινωνία</a>
        </footer>
      </div>
    </main>
  );
}
