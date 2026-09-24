/**
 * Thin Resend wrapper used by contact form and weekly parent emails.
 */
export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "email service unavailable" };
  }

  const from =
    process.env.WEEKLY_EMAIL_FROM?.trim() ||
    process.env.CONTACT_FROM?.trim() ||
    "onboarding@resend.dev";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[resend]", response.status, detail);
      return { ok: false, error: "failed to send email" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[resend]", err);
    return { ok: false, error: "internal error" };
  }
}
