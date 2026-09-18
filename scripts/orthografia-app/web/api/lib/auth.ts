import { createClerkClient, verifyToken } from "@clerk/backend";
import type { VercelRequest } from "@vercel/node";

export interface AuthUser {
  userId: string;
  email: string | null;
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
      email = user.emailAddresses[0]?.emailAddress ?? null;
    } catch {
      email = typeof payload.email === "string" ? payload.email : null;
    }

    return { userId, email };
  } catch {
    return null;
  }
}
