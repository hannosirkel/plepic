import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeToNewsletter } from "../src/newsletter/subscribe.js";
import type { NewsletterRateLimiter } from "../src/newsletter/rate-limit.js";

const request = {
  email: "reader@example.test",
  honeypot: "",
  turnstileToken: "synthetic-turnstile-token",
};

const config = {
  apiKey: "synthetic-newsletter-api-key",
  listId: 42,
  turnstileSecretKey: "synthetic-turnstile-secret",
};

function allowingLimiter(): NewsletterRateLimiter {
  return { consume: vi.fn(async () => "allowed" as const) };
}

afterEach(() => vi.restoreAllMocks());

describe("newsletter subscription", () => {
  it("verifies Turnstile before upserting only the configured Brevo list", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    await expect(subscribeToNewsletter(request, config, allowingLimiter(), fetcher)).resolves.toBe(204);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(fetcher.mock.calls[1]![0]).toBe("https://api.brevo.com/v3/contacts");
    const providerRequest = fetcher.mock.calls[1]![1]!;
    expect(providerRequest.method).toBe("POST");
    expect(providerRequest.headers).toEqual({
      "api-key": "synthetic-newsletter-api-key",
      "content-type": "application/json",
    });
    expect(JSON.parse(providerRequest.body as string)).toEqual({
      email: "reader@example.test",
      listIds: [42],
      updateEnabled: true,
    });
  });

  it("rejects malformed input and honeypot submissions before verification", async () => {
    for (const candidate of [
      { ...request, email: "not-an-email" },
      { ...request, email: "x".repeat(250) + "@e.test" },
      { ...request, honeypot: "bot" },
      { ...request, honeypot: undefined },
      { ...request, turnstileToken: "x".repeat(4097) },
    ]) {
      const fetcher = vi.fn<typeof fetch>();
      const limiter = allowingLimiter();

      await expect(subscribeToNewsletter(candidate, config, limiter, fetcher)).resolves.toBe(400);
      expect(limiter.consume).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("rejects null, undefined, and array bodies before any external operation", async () => {
    for (const candidate of [null, undefined, []]) {
      const fetcher = vi.fn<typeof fetch>();
      const limiter = allowingLimiter();

      await expect(subscribeToNewsletter(candidate, config, limiter, fetcher)).resolves.toBe(400);
      expect(limiter.consume).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("fails closed before Brevo when Turnstile rejects the request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ success: false }));

    await expect(subscribeToNewsletter(request, config, allowingLimiter(), fetcher)).resolves.toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns a generic unavailable status when verification or Brevo is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const verificationUnavailable = vi.fn<typeof fetch>(async () => {
      throw new Error("synthetic turnstile failure");
    });
    await expect(subscribeToNewsletter(request, config, allowingLimiter(), verificationUnavailable)).resolves.toBe(503);

    const providerUnavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockRejectedValueOnce(new Error("synthetic Brevo failure"));
    await expect(subscribeToNewsletter(request, config, allowingLimiter(), providerUnavailable)).resolves.toBe(503);
    expect(providerUnavailable).toHaveBeenCalledTimes(2);

    const providerRejected = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    await expect(subscribeToNewsletter(request, config, allowingLimiter(), providerRejected)).resolves.toBe(503);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("accepts Brevo's idempotent existing-contact update response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(subscribeToNewsletter(request, config, allowingLimiter(), fetcher)).resolves.toBe(204);
  });

  it("rejects an exhausted global limit before Turnstile or Brevo", async () => {
    const limiter: NewsletterRateLimiter = { consume: vi.fn(async () => "denied" as const) };
    const fetcher = vi.fn<typeof fetch>();

    await expect(subscribeToNewsletter(request, config, limiter, fetcher)).resolves.toBe(429);
    expect(limiter.consume).toHaveBeenCalledWith();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when the shared limiter is unavailable", async () => {
    const limiter: NewsletterRateLimiter = { consume: vi.fn(async () => "unavailable" as const) };
    const fetcher = vi.fn<typeof fetch>();

    await expect(subscribeToNewsletter(request, config, limiter, fetcher)).resolves.toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
