import { verifyToken } from "@clerk/backend";
import type { VercelRequest } from "@vercel/node";

const DEVICE_RE = /^[a-f0-9-]{16,64}$/i;
const USER_RE = /^user_[a-zA-Z0-9]+$/;
const COMPOSITE_RE = /^(user_[a-zA-Z0-9]+|[a-f0-9-]{16,64})--[a-zA-Z0-9_-]{8,64}$/;

export function isValidOwnerId(ownerId: string): boolean {
  return DEVICE_RE.test(ownerId) || USER_RE.test(ownerId) || COMPOSITE_RE.test(ownerId);
}

export function isUserOwnerId(ownerId: string): boolean {
  if (USER_RE.test(ownerId)) return true;
  return COMPOSITE_RE.test(ownerId) && ownerId.startsWith("user_");
}

function extractUserIdFromOwner(ownerId: string): string | null {
  if (USER_RE.test(ownerId)) return ownerId;
  const match = ownerId.match(/^(user_[a-zA-Z0-9]+)--/);
  return match ? match[1] : null;
}

function bearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

/** Anonymous device rows stay open; Clerk user rows require a matching session. */
export async function canAccessOwner(req: VercelRequest, ownerId: string): Promise<boolean> {
  const userId = extractUserIdFromOwner(ownerId);
  if (!userId) return true;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("[progress-api] CLERK_SECRET_KEY is not configured");
    return false;
  }

  const token = bearerToken(req);
  if (!token) return false;

  try {
    const payload = await verifyToken(token, { secretKey });
    return payload.sub === userId;
  } catch {
    return false;
  }
}
