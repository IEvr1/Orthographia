export function getSuperAdminEmail(): string | null {
  const email = import.meta.env.VITE_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmail = getSuperAdminEmail();
  if (!adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail;
}
