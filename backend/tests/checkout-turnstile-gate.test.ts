import { describe, expect, it, vi } from "vitest";

import middleware from "../src/api/middlewares.js";
import { checkoutTurnstileGate } from "../src/checkout/turnstile-gate.js";

const config = { secretKey: "synthetic-turnstile-secret" };

function request(token: unknown) {
  return { headers: { "x-plepic-turnstile-token": token } } as never;
}

function response() {
  return { sendStatus: vi.fn() };
}

describe("checkout Turnstile gate", () => {
  it("registers only the standard POST cart completion route", () => {
    expect(middleware.routes).toHaveLength(1);
    expect(middleware.routes?.[0]).toMatchObject({
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
    });
  });

  it("rejects absent, malformed, empty, and oversized header tokens without verifying", async () => {
    for (const token of [undefined, ["token"], "   ", "x".repeat(4097)] as const) {
      const res = response();
      const next = vi.fn();
      const verify = vi.fn<typeof fetch>();

      await checkoutTurnstileGate(request(token), res, next, config, verify);

      expect(res.sendStatus).toHaveBeenCalledExactlyOnceWith(403);
      expect(next).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
    }
  });

  it("fails closed without logging submitted content when verification rejects or is unavailable", async () => {
    for (const [fetcher, status] of [
      [vi.fn<typeof fetch>(async () => Response.json({ success: false })), 403],
      [vi.fn<typeof fetch>(async () => { throw new Error("unavailable"); }), 503],
      [vi.fn<typeof fetch>(async () => new Response("", { status: 503 })), 503],
    ] as const) {
      const res = response();
      const next = vi.fn();
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await checkoutTurnstileGate(request("synthetic-checkout-token"), res, next, config, fetcher);

      expect(res.sendStatus).toHaveBeenCalledExactlyOnceWith(status);
      expect(next).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    }
  });

  it("continues to Medusa's normal completion handler exactly once after verification", async () => {
    const res = response();
    const next = vi.fn();

    await checkoutTurnstileGate(
      request("synthetic-checkout-token"),
      res,
      next,
      config,
      vi.fn<typeof fetch>(async () => Response.json({ success: true })),
    );

    expect(res.sendStatus).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
