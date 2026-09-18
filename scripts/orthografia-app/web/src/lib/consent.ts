export const POLICY_VERSION = "privacy-v1";
const CONSENT_KEY = "orthografia-parental-consent";

export interface LocalConsent {
  version: string;
  acceptedAt: string;
}

export function hasLocalConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as LocalConsent;
    return data.version === POLICY_VERSION;
  } catch {
    return false;
  }
}

export function saveLocalConsent(): LocalConsent {
  const consent: LocalConsent = {
    version: POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  return consent;
}

const API_BASE = import.meta.env.VITE_PROGRESS_API_URL ?? "/api";

/** Upload local consent to server after parent signs in (Clerk). */
export async function syncConsentToServer(
  getToken: () => Promise<string | null>,
): Promise<void> {
  if (!hasLocalConsent()) return;
  const token = await getToken();
  if (!token) return;

  try {
    await fetch(`${API_BASE.replace(/\/$/, "")}/consent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ policyVersion: POLICY_VERSION }),
    });
  } catch {
    // Non-blocking — local consent still valid
  }
}
