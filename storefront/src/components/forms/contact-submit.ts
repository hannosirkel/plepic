interface ContactRuntime {
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

/** Relays one validated contact message to Medusa without retaining or echoing it. */
export async function submitContactMessage(
  formData: FormData,
  runtime: ContactRuntime,
  fetcher: Fetcher = fetch,
): Promise<{ readonly ok: boolean }> {
  const name = field(formData, "name", 120);
  const email = field(formData, "email", 254);
  const subject = field(formData, "subject", 200);
  const message = field(formData, "message", 5000);
  const honeypot = formData.get("additional-notes");
  const turnstileToken = field(formData, "cf-turnstile-response", 4096);
  if (
    runtime.backendUrl === null ||
    runtime.publishableKey === null ||
    name === null ||
    email === null ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    subject === null ||
    message === null ||
    honeypot !== "" ||
    turnstileToken === null
  ) return { ok: false };

  try {
    const target = new URL("/store/contact", runtime.backendUrl);
    const response = await fetcher(target.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-publishable-api-key": runtime.publishableKey,
      },
      body: JSON.stringify({ name, email, subject, message, honeypot, turnstileToken }),
      cache: "no-store",
    });
    return { ok: response.status === 204 };
  } catch {
    return { ok: false };
  }
}
