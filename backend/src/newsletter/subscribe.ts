import { verifyTurnstile } from "../turnstile/verify.js";
import type { NewsletterRateLimiter } from "./rate-limit.js";

const BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts";

interface NewsletterConfig {
  readonly apiKey: string;
  readonly listId: number;
  readonly turnstileSecretKey: string;
}

function boundedString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximum ? trimmed : null;
}

/** Verifies and upserts one explicit opt-in without local persistence or logs. */
export async function subscribeToNewsletter(
  input: unknown,
  config: NewsletterConfig,
  limiter: NewsletterRateLimiter,
  fetcher: typeof fetch = fetch,
): Promise<204 | 400 | 403 | 429 | 503> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return 400;
  const source = input as Record<string, unknown>;
  const email = boundedString(source.email, 254);
  const token = boundedString(source.turnstileToken, 4096);
  if (
    email === null ||
    token === null ||
    source.honeypot !== "" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\r\n]/.test(email)
  ) return 400;

  const limit = await limiter.consume();
  if (limit === "denied") return 429;
  if (limit === "unavailable") return 503;

  const verification = await verifyTurnstile(token, config.turnstileSecretKey, fetcher);
  if (verification === "rejected") return 403;
  if (verification === "unavailable") return 503;

  try {
    const response = await fetcher(BREVO_CONTACTS_URL, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, listIds: [config.listId], updateEnabled: true }),
    });
    return response.status === 201 || response.status === 204 ? 204 : 503;
  } catch {
    return 503;
  }
}
