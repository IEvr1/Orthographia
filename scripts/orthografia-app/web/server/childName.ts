const CHILD_NAME_PATTERN = /^[\p{L}\p{M}'\s.-]+$/u;
const MAX_CHILD_NAME_LENGTH = 40;

export function validateChildName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "name required";
  if (trimmed.length > MAX_CHILD_NAME_LENGTH) return "name too long";
  if (!CHILD_NAME_PATTERN.test(trimmed)) return "invalid name";
  return null;
}

export function sanitizeChildName(name: string): string {
  return name.trim();
}
