import { createHmac, timingSafeEqual } from "crypto";

export function weeklyEmailSecret(): string {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "dev-weekly-email-secret"
  );
}

export function makeUnsubscribeToken(userId: string): string {
  return createHmac("sha256", weeklyEmailSecret()).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token || token.length < 16) return false;
  const expected = makeUnsubscribeToken(userId);
  try {
    const a = new Uint8Array(Buffer.from(expected));
    const b = new Uint8Array(Buffer.from(token));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.VITE_APP_URL?.trim() ||
    "https://orthografia.app"
  ).replace(/\/$/, "");
}

export function unsubscribeUrl(userId: string): string {
  const t = makeUnsubscribeToken(userId);
  return `${appBaseUrl()}/api/preferences/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(t)}`;
}

export type ProgressBlob = {
  words?: Record<
    string,
    {
      attempts?: number;
      correct?: number;
      mastered?: boolean;
      needsReview?: boolean;
    }
  >;
  streak?: { current?: number; best?: number };
  errorStats?: Record<string, number>;
  lastSessionDate?: string | null;
  badges?: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
  ending: "Καταλήξεις",
  derivation: "Παράγωγα",
  root: "Ρίζα",
  stress: "Τονισμός",
  "final-sigma": "Τελικό σίγμα",
  other: "Άλλα",
};

function summarizeBlob(data: ProgressBlob, childName: string): string[] {
  const words = Object.values(data.words ?? {});
  const attempted = words.filter((w) => (w.attempts ?? 0) > 0).length;
  const mastered = words.filter((w) => w.mastered).length;
  const needsReview = words.filter((w) => w.needsReview).length;
  const streak = data.streak?.current ?? 0;
  const best = data.streak?.best ?? 0;

  const stats = data.errorStats ?? {};
  const top = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, n]) => `${CATEGORY_LABELS[k] ?? k} (${n})`)
    .join(", ");

  const lines = [
    `• ${childName}`,
    `  Δοκιμασμένες λέξεις: ${attempted} · Κατακτημένες: ${mastered} · Επανάληψη: ${needsReview}`,
    `  Σερί: ${streak} ημέρες (ρεκόρ ${best})`,
  ];
  if (top) lines.push(`  Συχνότερα λάθη: ${top}`);
  if (data.lastSessionDate) lines.push(`  Τελευταία εξάσκηση: ${data.lastSessionDate}`);
  return lines;
}

export function buildWeeklyEmail(opts: {
  parentEmail: string;
  userId: string;
  children: { name: string; progress: ProgressBlob }[];
}): { subject: string; text: string; html: string } {
  const unsub = unsubscribeUrl(opts.userId);
  const subject = "Ορθογραφία — εβδομαδιαία σύνοψη προόδου";

  const bodyLines: string[] = [
    "Γεια σου,",
    "",
    "Αυτή είναι η προαιρετική εβδομαδιαία σύνοψη από την Ορθογραφία.",
    "",
  ];

  if (opts.children.length === 0) {
    bodyLines.push("Δεν υπάρχει ακόμη αποθηκευμένη πρόοδος για αυτή την εβδομάδα.");
  } else {
    for (const child of opts.children) {
      bodyLines.push(...summarizeBlob(child.progress, child.name));
      bodyLines.push("");
    }
  }

  bodyLines.push(
    "Συμβουλή: άνοιξε την εφαρμογή → Αναφορά προόδου → «Εξάσκησε τα λάθη μου».",
    "",
    "———",
    "Αυτά τα email είναι προαιρετικά (opt-in).",
    `Για διακοπή με ένα κλικ: ${unsub}`,
    "Ή από την εφαρμογή: Ρυθμίσεις → Εβδομαδιαία σύνοψη (απενεργοποίηση).",
    "",
    "Καλή συνέχεια,",
    "Ομάδα Ορθογραφίας",
  );

  const text = bodyLines.join("\n");
  const htmlParts = [
    "<p>Γεια σου,</p>",
    "<p>Αυτή είναι η <strong>προαιρετική</strong> εβδομαδιαία σύνοψη από την Ορθογραφία.</p>",
  ];
  if (opts.children.length === 0) {
    htmlParts.push("<p>Δεν υπάρχει ακόμη αποθηκευμένη πρόοδος για αυτή την εβδομάδα.</p>");
  } else {
    for (const child of opts.children) {
      htmlParts.push(
        `<pre style="font-family:inherit;white-space:pre-wrap">${summarizeBlob(child.progress, child.name)
          .join("\n")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</pre>`,
      );
    }
  }
  htmlParts.push(
    "<p>Συμβουλή: άνοιξε την εφαρμογή → Αναφορά προόδου → «Εξάσκησε τα λάθη μου».</p>",
    `<p><a href="${unsub}">Διακοπή εβδομαδιαίων email με ένα κλικ</a></p>`,
    "<p>Ή από την εφαρμογή: Ρυθμίσεις → Εβδομαδιαία σύνοψη (απενεργοποίηση).</p>",
    "<p>Καλή συνέχεια,<br/>Ομάδα Ορθογραφίας</p>",
  );

  return { subject, text, html: htmlParts.join("\n") };
}
