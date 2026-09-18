/** Common Greek declension endings (from Γραμματική Ε-ΣΤ tables). */
export const DECLENSION_ENDINGS = [
  "ος",
  "η",
  "ο",
  "ες",
  "ων",
  "ους",
  "ας",
  "ης",
  "μα",
  "ι",
  "α",
  "ών",
  "έων",
  "ίου",
  "ίων",
  "ικό",
  "ική",
  "ικό",
] as const;

export function endsWithDeclensionSuffix(token: string): boolean {
  const norm = token.toLowerCase();
  return DECLENSION_ENDINGS.some((end) => norm.endsWith(end));
}
