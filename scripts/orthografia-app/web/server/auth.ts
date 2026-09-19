import { createClerkClient, verifyToken } from "@clerk/backend";
import type { VercelRequest } from "@vercel/node";

const DEVICE_RE = /^[a-f0-9-]{16,64}$/i;
const USER_RE = /^user_[a-zA-Z0-9]+$/;
const COMPOSITE_RE = /^(user_[a-zA-Z0-9]+|[a-f0-9-]{16,64})--[a-zA-Z0-9_-]{8,64}$/;

export interface AuthUser {
  userId: string;
  email: string | null;
}

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

function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function requireUserId(req: VercelRequest): Promise<string | null> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;

  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const payload = await verifyToken(token, { secretKey: secret });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: VercelRequest): Promise<AuthUser | null> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;

  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const payload = await verifyToken(token, { secretKey: secret });
    const userId = payload.sub;
    if (!userId) return null;

    let email: string | null = null;
    try {
      const clerk = createClerkClient({ secretKey: secret });
      const user = await clerk.users.getUser(userId);
      const primary =
        user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId) ??
        user.emailAddresses[0];
      email = primary?.emailAddress ?? null;
    } catch {
      email = typeof payload.email === "string" ? payload.email : null;
    }

    return { userId, email };
  } catch {
    return null;
  }
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

  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const payload = await verifyToken(token, { secretKey });
    return payload.sub === userId;
  } catch {
    return false;
  }
}
