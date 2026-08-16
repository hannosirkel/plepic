import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The gate, executed **through the middleware Medusa is given**, rather than
 * called directly.
 *
 * `checkout-turnstile-gate.test.ts` proves the gate's own logic thoroughly and
 * proves that `middlewares.ts` declares one route with the right matcher and
 * method. Between those two facts sits the eight-line closure that connects
 * them — it reads the secret out of `process.env`, and passes `req`, `res`,
 * `next` and that config to the gate in that order — and nothing executed it.
 * Wrong argument order, a dropped `await`, a config read that throws on a
 * missing secret: each ships green, and each turns "checkout is protected by
 * Turnstile" into "checkout is not protected by anything".
 *
 * This drives the exported declaration: it takes `routes[0].middlewares[0]`
 * out of the default export and calls it, which is the same value and the same
 * call Medusa's HTTP layer makes.
 */

type Middleware = (
  req: { headers: Record<string, string> },
  res: { sendStatus: (status: number) => void },
  next: () => void,
) => Promise<void> | void;

interface MiddlewareRoute {
  readonly matcher: string;
  readonly methods?: readonly string[];
  readonly middlewares: readonly Middleware[];
}

async function completionMiddleware(): Promise<MiddlewareRoute> {
  const declared = (await import("../src/api/middlewares.js")).default as unknown as {
    routes: readonly MiddlewareRoute[];
  };
  const route = declared.routes.find((candidate) => candidate.matcher.includes("/complete"));
  expect(route, "no middleware is registered on the cart completion route").toBeDefined();
  expect(route?.middlewares).toHaveLength(1);
  return route as MiddlewareRoute;
}

const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the registered cart-completion middleware refuses an unverified checkout", () => {
  it("answers 403 and never calls the completion handler when no token is presented", async () => {
    process.env.TURNSTILE_SECRET_KEY = "synthetic-turnstile-secret";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const route = await completionMiddleware();
    const sendStatus = vi.fn();
    const next = vi.fn();

    await route.middlewares[0]?.({ headers: {} }, { sendStatus }, next);

    expect(sendStatus).toHaveBeenCalledWith(403);
    expect(next, "Medusa's completion handler ran without verification").not.toHaveBeenCalled();
    expect(fetchSpy, "an absent token was sent to Cloudflare rather than refused").not.toHaveBeenCalled();
  });

  it("answers 403 when Cloudflare rejects the token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "synthetic-turnstile-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 })),
    );

    const route = await completionMiddleware();
    const sendStatus = vi.fn();
    const next = vi.fn();

    await route.middlewares[0]?.(
      { headers: { "x-plepic-turnstile-token": "a-token-cloudflare-does-not-like" } },
      { sendStatus },
      next,
    );

    expect(sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed with 503, never open, when Cloudflare cannot be reached", async () => {
    process.env.TURNSTILE_SECRET_KEY = "synthetic-turnstile-secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network is unreachable")));

    const route = await completionMiddleware();
    const sendStatus = vi.fn();
    const next = vi.fn();

    await route.middlewares[0]?.(
      { headers: { "x-plepic-turnstile-token": "a-token" } },
      { sendStatus },
      next,
    );

    expect(sendStatus).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("continues to the completion handler exactly once on a verified token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "synthetic-turnstile-secret";
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const route = await completionMiddleware();
    const sendStatus = vi.fn();
    const next = vi.fn();

    await route.middlewares[0]?.(
      { headers: { "x-plepic-turnstile-token": "a-good-token" } },
      { sendStatus },
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(sendStatus).not.toHaveBeenCalled();

    // The closure really did reach Cloudflare with the configured secret,
    // rather than short-circuiting to a permissive default.
    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams | string | undefined;
    expect(String(body)).toContain("synthetic-turnstile-secret");
  });

  /**
   * The unconfigured deployment. A gate that treated a missing secret as
   * "nothing to check" would be worse than no gate, because the operator would
   * believe there was one.
   */
  it("does not let a checkout through when no Turnstile secret is configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.stubGlobal("fetch", vi.fn());

    const route = await completionMiddleware();
    const sendStatus = vi.fn();
    const next = vi.fn();

    let threw = false;
    try {
      await route.middlewares[0]?.(
        { headers: { "x-plepic-turnstile-token": "a-token" } },
        { sendStatus },
        next,
      );
    } catch {
      threw = true;
    }

    expect(
      threw || sendStatus.mock.calls.length > 0,
      "an unconfigured deployment neither refused nor failed",
    ).toBe(true);
    expect(next, "an unconfigured deployment completed the checkout").not.toHaveBeenCalled();
  });
});
