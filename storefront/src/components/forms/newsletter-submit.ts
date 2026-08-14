interface NewsletterRuntime {
  readonly backendUrl: string | null;
  readonly publishableKey: string | null;
}

type Fetcher = typeof fetch;

function field(formData: FormData, name: string, maximum: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximum ? trimmed : null;
}

/** Sends one affirmative newsletter opt-in without retaining or echoing it. */
export async function submitNewsletterAddress(
  formData: FormData,
  runtime: NewsletterRuntime,
  fetcher: Fetcher = fetch,
): Promise<{ readonly ok: boolean }> {
  const email = field(formData, "email", 254);
  const honeypot = formData.get("additional-notes");
  const consent = formData.get("newsletter-consent");
  const turnstileToken = field(formData, "cf-turnstile-response", 4096);
  if (
    runtime.backendUrl === null ||
    runtime.publishableKey === null ||
    email === null ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    honeypot !== "" ||
    consent !== "on" ||
    turnstileToken === null
  ) return { ok: false };

  try {
    const response = await fetcher(new URL("/store/newsletter", runtime.backendUrl).toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-publishable-api-key": runtime.publishableKey,
      },
      body: JSON.stringify({ email, honeypot, turnstileToken }),
      cache: "no-store",
    });
    return { ok: response.status === 204 };
  } catch {
    return { ok: false };
  }
}
