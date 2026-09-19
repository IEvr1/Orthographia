/** Fallback when VITE_SUPER_ADMIN_EMAIL is not baked into the bundle. */
export const DEFAULT_SUPER_ADMIN_EMAIL = "mustrene@gmail.com";

export function getSuperAdminEmail(): string {
  const email = import.meta.env.VITE_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return email || DEFAULT_SUPER_ADMIN_EMAIL;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getSuperAdminEmail();
}
