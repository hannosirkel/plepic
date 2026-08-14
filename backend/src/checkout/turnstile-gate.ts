import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { verifyTurnstile } from "../turnstile/verify.js";

const TURNSTILE_HEADER = "x-plepic-turnstile-token";
const MAXIMUM_TOKEN_LENGTH = 4096;

export async function checkoutTurnstileGate(
  req: Pick<MedusaRequest, "headers">,
  res: Pick<MedusaResponse, "sendStatus">,
  next: MedusaNextFunction,
  config: { readonly secretKey: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const value = req.headers[TURNSTILE_HEADER];
  const token = typeof value === "string" ? value.trim() : "";
  if (token.length === 0 || token.length > MAXIMUM_TOKEN_LENGTH) {
    res.sendStatus(403);
    return;
  }
  const result = await verifyTurnstile(token, config.secretKey, fetcher);
  if (result === "verified") {
    next();
    return;
  }
  res.sendStatus(result === "rejected" ? 403 : 503);
}
