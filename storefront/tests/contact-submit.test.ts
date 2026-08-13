import { describe, expect, it, vi } from "vitest";

import { submitContactMessage } from "../src/components/forms/contact-submit.js";

function form(overrides: Readonly<Record<string, string>> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Example Person",
    email: "writer@example.com",
    subject: "Rules question",
    message: "Could you clarify one rule?",
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

describe("contact form relay", () => {
  it("sends bounded fields to the private Store API without echoing them", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    await expect(submitContactMessage(form(), runtime, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      "http://plepic-backend:8102/store/contact",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-publishable-api-key": "pk_synthetic_store",
        }),
      }),
    );
    const body = JSON.parse(fetcher.mock.calls[0]![1]!.body as string);
    expect(body).toEqual({
      name: "Example Person",
      email: "writer@example.com",
      subject: "Rules question",
      message: "Could you clarify one rule?",
      honeypot: "",
      turnstileToken: "synthetic-turnstile-token",
    });
  });

  it("rejects malformed or abusive input before any request", async () => {
    for (const invalid of [
      form({ email: "invalid" }),
      form({ "additional-notes": "bot" }),
      form({ "cf-turnstile-response": "" }),
      form({ message: "x".repeat(5001) }),
    ]) {
      const fetcher = vi.fn();
      await expect(submitContactMessage(invalid, runtime, fetcher)).resolves.toEqual({ ok: false });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("fails closed without runtime Store configuration and redacts backend failure", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("sensitive upstream detail", { status: 500 }));
    await expect(submitContactMessage(form(), { backendUrl: null, publishableKey: null }, fetcher))
      .resolves.toEqual({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(submitContactMessage(form(), runtime, fetcher)).resolves.toEqual({ ok: false });
  });
});
