import type { SmtpSender } from "../notifications/smtp.js";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface ContactRelayConfig {
  readonly recipient: string;
  readonly turnstileSecretKey: string;
}

interface ContactMessage {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly honeypot: string;
  readonly turnstileToken: string;
}

function boundedString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximum ? trimmed : null;
}

function parseContactMessage(input: unknown): ContactMessage | null {
  if (typeof input !== "object" || input === null) return null;
  const source = input as Record<string, unknown>;
  const name = boundedString(source.name, 120);
  const email = boundedString(source.email, 254);
  const subject = boundedString(source.subject, 200);
  const message = boundedString(source.message, 5000);
  const turnstileToken = boundedString(source.turnstileToken, 4096);

  if (
    name === null ||
    email === null ||
    subject === null ||
    message === null ||
    turnstileToken === null ||
    source.honeypot !== "" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\r\n]/.test(email) ||
    /[\r\n]/.test(subject)
  ) return null;

  return { name, email, subject, message, honeypot: "", turnstileToken };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br>");
}

/** Verify and relay a contact message without storing or logging its contents. */
export async function relayContactMessage(
  input: unknown,
  config: ContactRelayConfig,
  sender: Pick<SmtpSender, "send">,
  fetcher: typeof fetch = fetch,
): Promise<204 | 400 | 403 | 503> {
  const message = parseContactMessage(input);
  if (message === null) return 400;

  try {
    const body = new URLSearchParams({
      secret: config.turnstileSecretKey,
      response: message.turnstileToken,
    });
    const response = await fetcher(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return 403;
    const result = await response.json() as { readonly success?: unknown };
    if (result.success !== true) return 403;
  } catch {
    return 503;
  }

  try {
    await sender.send({
      to: config.recipient,
      replyTo: message.email,
      subject: `Contact: ${message.subject}`,
      text: `From: ${message.name} <${message.email}>\n\n${message.message}`,
      html: `<p>From: ${escapeHtml(message.name)} &lt;${escapeHtml(message.email)}&gt;</p><p>${escapeHtml(message.message)}</p>`,
    });
    return 204;
  } catch {
    return 503;
  }
}
