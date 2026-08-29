/**
 * The Omniva parcel machine list, read same-origin.
 *
 * `CheckoutPageContent` needs one thing from this module: the machines a
 * buyer in a given country may collect from, once they have selected the
 * Omniva parcel machine method. It is a **read**, not a cart mutation — see
 * `store-checkout.ts`'s `addGuestShippingMethod` for the operation that adds
 * the method itself, which is the one Task 5's guard withholds until a
 * machine is chosen.
 */

import { ConfigError } from "../config/env.js";
import type { createMedusaStoreClient } from "./medusa-client.js";

type StoreClient = ReturnType<typeof createMedusaStoreClient>;

export interface StorefrontParcelMachine {
  readonly zip: string;
  readonly name: string;
  readonly group: string;
}

/**
 * The machines for one country, through the same-origin `/store-api` proxy.
 *
 * Nothing here talks to Omniva. The backend holds the list and the cache, so
 * the checkout's CSP gains no origin and the buyer's browser makes no
 * third-party request — `GET /store/omniva/parcel-machines` is served by
 * `backend/src/api/store/omniva/parcel-machines/route.ts`, from the
 * backend's own cached copy of Omniva's feed, and the proxy at
 * `src/app/store-api/[...path]/route.ts` is what keeps the request on this
 * site's own origin.
 *
 * **Takes the Store client, not a bare `fetch`.** This used to hand-roll its
 * own `fetch("/store-api/store/omniva/parcel-machines?...")` call, carrying
 * only an `accept` header — and Medusa refuses every `/store/*` route without
 * `x-publishable-api-key`, so that call was a guaranteed `400` in any real
 * deployment: `{"type":"not_allowed","message":"Publishable API key required
 * in the request header: x-publishable-api-key…"}`. Every other Store read in
 * this codebase (`prepareGuestShipping`, `addGuestShippingMethod` in
 * `./store-checkout.ts`, `initiateStripePayment` in `./store-payment.ts`)
 * goes through the `@medusajs/js-sdk` client `createMedusaStoreClient`
 * builds, which attaches that header itself — so this function takes the same
 * client and calls its generic `client.client.fetch`, rather than adding the
 * header by hand a second time. A second hand-rolled header is exactly the
 * shape that produced this defect in the first place: one more place that has
 * to remember the key exists, and the one place that forgot to is what broke
 * the checkout. There should be exactly one thing in this codebase that knows
 * how to authenticate a Store call, and it is `createMedusaStoreClient`.
 * `client.client.fetch` (verified against the installed
 * `@medusajs/js-sdk`'s `dist/client.d.ts`) is used rather than `client.store.*`
 * because the SDK's typed `store` namespace has no method for this route —
 * it is this shop's own endpoint, not a stock Medusa one — and `fetch` is the
 * SDK's documented escape hatch for exactly that case, the same one
 * `initiateStripePayment` already uses for `stripe-payment-session`.
 *
 * `countryCode` is expected to be one of the three ISO 3166-1 alpha-2 codes
 * the backend serves machines for; the backend is the sole authority on that
 * set (`400` for anything else) and this function does not repeat it.
 *
 * Refuses — rather than returning an empty list — on a non-2xx response or a
 * response with no machines, because both are the same fact from a buyer's
 * point of view: there is nothing to choose from, and the picker cannot be
 * populated. The `503` the backend answers when its own cache and Omniva are
 * both unavailable lands here as one of those two branches. A non-2xx
 * response reaches this function as a thrown `FetchError` — `client.client.
 * fetch` throws rather than resolving, per its own doc comment — which is
 * caught and folded into the same `ConfigError` an empty list produces,
 * because the picker has no more use for the status code than it does for an
 * empty array.
 */
export async function fetchParcelMachines(
  client: StoreClient,
  countryCode: string,
): Promise<readonly StorefrontParcelMachine[]> {
  let body: { parcel_machines?: unknown };
  try {
    body = await client.client.fetch<{ parcel_machines?: unknown }>(
      "/store/omniva/parcel-machines",
      { query: { country: countryCode } },
    );
  } catch {
    throw new ConfigError("The parcel machine list is unavailable");
  }
  if (!Array.isArray(body.parcel_machines) || body.parcel_machines.length === 0) {
    throw new ConfigError("The parcel machine list is unavailable");
  }
  return body.parcel_machines as readonly StorefrontParcelMachine[];
}
