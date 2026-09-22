import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors } from "../server/cors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 4000;
const MAX_EMAIL = 254;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

const recentByIp = new Map<string, number[]>();

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = recentByIp.get(ip) ?? [];
  const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    recentByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  recentByIp.set(ip, recent);
  return false;
}

function parseBody(req: VercelRequest): {
  email?: string;
  subject?: string;
  message?: string;
} {
  const raw = req.body;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { email?: string; subject?: string; message?: string };
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") {
    return raw as { email?: string; subject?: string; message?: string };
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  if (isRateLimited(clientIp(req))) {
    return res.status(429).json({ error: "too many requests" });
  }

  const body = parseBody(req);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!email || !EMAIL_RE.test(email) || email.length > MAX_EMAIL) {
    return res.status(400).json({ error: "invalid email" });
  }
  if (!subject || subject.length > MAX_SUBJECT) {
    return res.status(400).json({ error: "invalid subject" });
  }
  if (message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: "message too long" });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[contact-api] RESEND_API_KEY is not configured");
    return res.status(503).json({ error: "email service unavailable" });
  }

  const to = process.env.CONTACT_TO?.trim() || "info@nexaipla.com";
  const from = process.env.CONTACT_FROM?.trim() || "onboarding@resend.dev";

  const textLines = [
    `Από: ${email}`,
    `Θέμα: ${subject}`,
    "",
    message || "(χωρίς μήνυμα)",
  ];

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `[Ορθογραφία] ${subject}`,
        text: textLines.join("\n"),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[contact-api] Resend error", response.status, detail);
      return res.status(502).json({ error: "failed to send email" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[contact-api]", err);
    return res.status(500).json({ error: "internal error" });
  }
}
