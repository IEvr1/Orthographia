import { useState, type FormEvent } from "react";

const API_BASE = import.meta.env.VITE_PROGRESS_API_URL ?? "/api";

type Status = "idle" | "sending" | "success" | "error";

export function ContactPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorText("");

    try {
      const res = await fetch(`${API_BASE.replace(/\/$/, "")}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = data?.error ?? "";
        if (res.status === 429) {
          setErrorText("Πάρα πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο.");
        } else if (code === "invalid email") {
          setErrorText("Παρακαλώ εισάγετε έγκυρο email.");
        } else if (code === "invalid subject") {
          setErrorText("Παρακαλώ συμπληρώστε το θέμα.");
        } else if (code === "email service unavailable") {
          setErrorText("Η αποστολή δεν είναι διαθέσιμη αυτή τη στιγμή.");
        } else {
          setErrorText("Η αποστολή απέτυχε. Δοκιμάστε ξανά.");
        }
        setStatus("error");
        return;
      }

      setStatus("success");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setErrorText("Η αποστολή απέτυχε. Ελέγξτε τη σύνδεσή σας.");
      setStatus("error");
    }
  };

  return (
    <main className="screen screen--legal fade-in">
      <div className="legal-card">
        <a href="/" className="btn-text">
          ← Επιστροφή
        </a>
        <h1 className="legal-title">Επικοινωνία</h1>
        <p className="legal-lead">
          Στείλτε μας μήνυμα και θα σας απαντήσουμε στο email που δηλώσατε.
        </p>

        {status === "success" ? (
          <p className="contact-status contact-status--success" role="status">
            Το μήνυμά σας στάλθηκε επιτυχώς. Ευχαριστούμε!
          </p>
        ) : null}

        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <label className="form-label" htmlFor="contact-email">
            Email
            <input
              id="contact-email"
              className="form-input"
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending"}
            />
          </label>

          <label className="form-label" htmlFor="contact-subject">
            Θέμα
            <input
              id="contact-subject"
              className="form-input"
              type="text"
              name="subject"
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={status === "sending"}
            />
          </label>

          <label className="form-label" htmlFor="contact-message">
            Μήνυμα
            <textarea
              id="contact-message"
              className="form-input form-textarea"
              name="message"
              rows={5}
              maxLength={4000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={status === "sending"}
            />
          </label>

          {status === "error" && errorText ? (
            <p className="contact-status contact-status--error" role="alert">
              {errorText}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary btn-xl"
            disabled={status === "sending" || !email.trim() || !subject.trim()}
          >
            {status === "sending" ? "Αποστολή…" : "Αποστολή"}
          </button>
        </form>

        <footer className="legal-footer">
          <div className="legal-footer__links">
            <a href="/privacy">Απορρήτο</a>
            <span>·</span>
            <a href="/terms">Όροι</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
