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

export function extractUserIdFromOwner(ownerId: string): string | null {
  if (USER_RE.test(ownerId)) return ownerId;
  const match = ownerId.match(/^(user_[a-zA-Z0-9]+)--/);
  return match ? match[1] : null;
}

export function resolveProgressOwnerId(
  userId: string | null | undefined,
  deviceId: string | undefined,
  profileId?: string | null,
): string | null {
  if (userId && profileId) return `${userId}--${profileId}`;
  if (userId) return userId;
  if (deviceId && profileId && DEVICE_RE.test(deviceId)) return `${deviceId}--${profileId}`;
  if (deviceId && DEVICE_RE.test(deviceId)) return deviceId;
  return null;
}

export function isClerkConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
}
