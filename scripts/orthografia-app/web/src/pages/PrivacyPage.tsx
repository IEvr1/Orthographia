export function PrivacyPage() {
  return (
    <main className="screen screen--legal fade-in">
      <div className="legal-card legal-card--wide">
        <a href="/" className="btn-text">← Επιστροφή</a>
        <h1 className="legal-title">Πολιτική Απορρήτου</h1>
        <p className="legal-meta">Έκδοση privacy-v1 · Τελευταία ενημέρωση: Σεπτέμβριος 2026</p>

        <section className="legal-section">
          <h2>1. Υπεύθυνος επεξεργασίας</h2>
          <p>
            Η εφαρμογή «Ορθογραφία» παρέχεται για εκπαιδευτική χρήση. Για ερωτήσεις απορρήτου:
            <a href="mailto:privacy@orthografia.app"> privacy@orthografia.app</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Ποιοι χρησιμοποιούν την εφαρμογή</h2>
          <p>
            Η εφαρμογή απευθύνεται σε μαθητές Δημοτικού. Ο λογαριασμός δημιουργείται από γονέα ή
            νόμιμο κηδεμόνα άνω των 18 ετών, ο οποίος παρέχει συγκατάθεση για την επεξεργασία
            δεδομένων του παιδιού.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Δεδομένα που συλλέγουμε</h2>
          <ul className="legal-list">
            <li>Πρόοδος εξάσκησης (λέξεις, αποτελέσματα, χρονοδιάγραμμα επανάληψης)</li>
            <li>Τοπική αποθήκευση (localStorage) για offline λειτουργία</li>
            <li>Αναγνωριστικό συσκευής (UUID) για συγχρονισμό με άλλες συσκευές</li>
            <li>Email και αναγνωριστικό λογαριασμού γονέα (Clerk)</li>
            <li>Στοιχεία συνδρομής (Stripe): κατάσταση, πλάνο — όχι στοιχεία κάρτας</li>
            <li>IP κατά την καταγραφή συγκατάθεσης (προαιρετικά, για απόδειξη συμμόρφωσης)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Σκοπός επεξεργασίας</h2>
          <p>
            Παροχή εκπαιδευτικής εφαρμογής, αποθήκευση προόδου, συγχρονισμός μεταξύ συσκευών και
            διαχείριση συνδρομής.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Cookies και τοπική αποθήκευση</h2>
          <p>
            Χρησιμοποιούμε localStorage για πρόοδο, ρυθμίσεις και καταγραφή συγκατάθεσης. Δεν
            χρησιμοποιούμε cookies διαφημιστικής παρακολούθησης. Το PWA cache αποθηκεύει περιεχόμενο
            (λέξεις, ήχο) για offline χρήση.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Τρίτοι πάροχοι</h2>
          <ul className="legal-list">
            <li>Clerk — αυθεντικοποίηση γονέα</li>
            <li>Stripe — πληρωμές συνδρομής</li>
            <li>Neon Postgres — αποθήκευση προόδου και συνδρομής</li>
            <li>Vercel — φιλοξενία εφαρμογής</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>7. Δικαιώματα (GDPR)</h2>
          <ul className="legal-list">
            <li>Πρόσβαση και εξαγωγή δεδομένων (αντίγραφο ασφαλείας JSON από την αρχική οθόνη)</li>
            <li>Διόρθωση μέσω συγχρονισμού με άλλες συσκευές ή επικοινωνίας μαζί μας</li>
            <li>Διαγραφή: email στο privacy@orthografia.app ή διαγραφή λογαριασμού</li>
            <li>Ανάκληση συγκατάθεσης: διαγραφή λογαριασμού και επικοινωνία μαζί μας</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>8. Διατήρηση</h2>
          <p>
            Τα δεδομένα διατηρούνται όσο ο λογαριασμός είναι ενεργός. Μετά από αίτημα διαγραφής,
            διαγράφουμε τα δεδομένα εντός 30 ημερών.
          </p>
        </section>
      </div>
    </main>
  );
}
