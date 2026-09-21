/** Letters (any script), spaces, hyphens, apostrophes — Greek, English, Greeklish. */
const CHILD_NAME_PATTERN = /^[\p{L}\p{M}'\s.-]+$/u;
export const MAX_CHILD_NAME_LENGTH = 40;

export function validateChildName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Το όνομα είναι υποχρεωτικό.";
  if (trimmed.length > MAX_CHILD_NAME_LENGTH) return "Το όνομα είναι πολύ μακρύ.";
  if (!CHILD_NAME_PATTERN.test(trimmed)) {
    return "Χρησιμοποίησε μόνο γράμματα (ελληνικά ή αγγλικά).";
  }
  return null;
}

export function sanitizeChildName(name: string): string {
  return name.trim();
}
