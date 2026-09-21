import type { GradeProgressStats } from "./progressStats";

export function progressPercent(stats: GradeProgressStats): number {
  if (stats.total <= 0) return 0;
  return Math.round((stats.mastered / stats.total) * 100);
}

export function buildProgressInsights(
  stats: GradeProgressStats,
  lastSessionDate: string | null,
  now = new Date(),
): string[] {
  const insights: string[] = [];
  const pct = progressPercent(stats);

  if (stats.total === 0) {
    return insights;
  }

  if (stats.mastered === 0) {
    insights.push("Ξεκίνα σήμερα — η πρόοδος σου εμφανίζεται εδώ.");
  } else if (pct >= 80) {
    insights.push(`Εξαιρετικά! Έχεις κατακτήσει ${pct}% των λέξεων της τάξης.`);
  } else if (pct >= 50) {
    insights.push(`Καλή πρόοδος — ${pct}% των λέξεων σε επίπεδο «ξέρω».`);
  } else {
    insights.push(`Συνεχίζεις σταθερά — ${pct}% ολοκληρωμένο.`);
  }

  if (stats.needsReview > 0) {
    insights.push(
      `${stats.needsReview} λέξ${stats.needsReview === 1 ? "η" : "εις"} χρειάζ${stats.needsReview === 1 ? "εται" : "ονται"} επανάληψη σήμερα.`,
    );
  } else if (stats.mastered > 0) {
    insights.push("Καμία επείγουσα επανάληψη — όλα εντάξει για σήμερα.");
  }

  const practice = formatLastPractice(lastSessionDate, now);
  if (practice) {
    insights.push(practice);
  }

  return insights;
}

function formatLastPractice(lastSessionDate: string | null, now: Date): string | null {
  if (!lastSessionDate) return null;

  const today = now.toISOString().slice(0, 10);
  if (lastSessionDate === today) {
    return "Έκανες εξάσκηση σήμερα.";
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastSessionDate === yesterday.toISOString().slice(0, 10)) {
    return "Τελευταία εξάσκηση: χθες.";
  }

  return null;
}
