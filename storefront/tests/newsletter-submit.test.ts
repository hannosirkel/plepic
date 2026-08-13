import { describe, expect, it, vi } from "vitest";

import { submitNewsletterAddress } from "../src/components/forms/newsletter-submit.js";

function form(overrides: Readonly<Record<string, string>> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "reader@example.com",
    "newsletter-consent": "on",
    "additional-notes": "",
    "cf-turnstile-response": "synthetic-turnstile-token",
    ...overrides,
  })) data.set(key, value);
  return data;
}

const runtime = {
  backendUrl: "http://plepic-backend:8102",
  publishableKey: "pk_synthetic_store",
};

describe("newsletter relay", () => {
  it("posts the bounded opt-in to the private Store API", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    await expect(submitNewsletterAddress(form(), runtime, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      "http://plepic-backend:8102/store/newsletter",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({
      email: "reader@example.com",
      honeypot: "",
      turnstileToken: "synthetic-turnstile-token",
    });
  });

  it("rejects malformed, bot, and unverified input before any request", async () => {
    for (const invalid of [
      form({ email: "invalid" }),
      form({ "additional-notes": "bot" }),
      form({ "cf-turnstile-response": "" }),
      form({ "newsletter-consent": "" }),
    ]) {
      const fetcher = vi.fn();
      await expect(submitNewsletterAddress(invalid, runtime, fetcher)).resolves.toEqual({ ok: false });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
});
