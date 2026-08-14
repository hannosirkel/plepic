const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Verifies one bounded, single-use Turnstile response without logging it. */
export async function verifyTurnstile(
  token: string,
  secret: string,
  fetcher: typeof fetch = fetch,
): Promise<"verified" | "rejected" | "unavailable"> {
  try {
    const response = await fetcher(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!response.ok) return "unavailable";
    const result = await response.json() as { readonly success?: unknown };
    return result.success === true ? "verified" : "rejected";
  } catch {
    return "unavailable";
  }
}
