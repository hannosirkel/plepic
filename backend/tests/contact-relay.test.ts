import { describe, expect, it, vi } from "vitest";

import { relayContactMessage } from "../src/contact/relay.js";

const request = {
  name: "Example Person",
  email: "writer@example.com",
  subject: "Rules question",
  message: "Could you clarify one rule?",
  honeypot: "",
  turnstileToken: "synthetic-turnstile-token",
};

const config = {
  recipient: "contact@example.test",
  turnstileSecretKey: "synthetic-turnstile-secret",
};

describe("contact relay", () => {
  it("verifies Turnstile and sends only to the configured recipient with visitor Reply-To", async () => {
    const verify = vi.fn<typeof fetch>(async () =>
      Response.json({ success: true }),
    );
    const sender = { send: vi.fn().mockResolvedValue({ id: "message-id" }) };

    await expect(relayContactMessage(request, config, sender, verify)).resolves.toBe(204);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0]![0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    const verification = verify.mock.calls[0]![1]!;
    expect(verification.method).toBe("POST");
    expect(verification.body).toBeInstanceOf(URLSearchParams);
    expect((verification.body as URLSearchParams).toString()).toBe(
      "secret=synthetic-turnstile-secret&response=synthetic-turnstile-token",
    );
    expect(sender.send).toHaveBeenCalledWith({
      to: "contact@example.test",
      replyTo: "writer@example.com",
      subject: "Contact: Rules question",
      text: "From: Example Person <writer@example.com>\n\nCould you clarify one rule?",
      html: "<p>From: Example Person &lt;writer@example.com&gt;</p><p>Could you clarify one rule?</p>",
    });
  });

  it("rejects invalid input, bot fields, and failed verification without sending", async () => {
    for (const [candidate, verifyResult] of [
      [{ ...request, email: "invalid" }, true],
      [{ ...request, honeypot: "filled" }, true],
      [{ ...request, message: "x".repeat(5001) }, true],
      [request, false],
    ] as const) {
      const verify = vi.fn<typeof fetch>(async () =>
        Response.json({ success: verifyResult }),
      );
      const sender = { send: vi.fn() };

      await expect(relayContactMessage(candidate, config, sender, verify)).resolves.toBe(
        verifyResult ? 400 : 403,
      );
      expect(sender.send).not.toHaveBeenCalled();
    }
  });

  it("fails closed on verification and SMTP errors without exposing details", async () => {
    const sender = {
      send: vi.fn().mockRejectedValue(new Error("recipient@example.test message body")),
    };
    await expect(
      relayContactMessage(
        request,
        config,
        sender,
        vi.fn<typeof fetch>(async () => Response.json({ success: true })),
      ),
    ).resolves.toBe(503);
    await expect(
      relayContactMessage(
        request,
        config,
        sender,
        vi.fn<typeof fetch>(async () => {
          throw new Error("turnstile secret");
        }),
      ),
    ).resolves.toBe(503);
  });
});
