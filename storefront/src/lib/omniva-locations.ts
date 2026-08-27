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
 * `countryCode` is expected to be one of the three ISO 3166-1 alpha-2 codes
 * the backend serves machines for; the backend is the sole authority on that
 * set (`400` for anything else) and this function does not repeat it.
 *
 * Refuses — rather than returning an empty list — on a non-2xx response or a
 * response with no machines, because both are the same fact from a buyer's
 * point of view: there is nothing to choose from, and the picker cannot be
 * populated. The `503` the backend answers when its own cache and Omniva are
 * both unavailable lands here as one of those two branches.
 */
export async function fetchParcelMachines(
  countryCode: string,
): Promise<readonly StorefrontParcelMachine[]> {
  const response = await fetch(
    `/store-api/store/omniva/parcel-machines?country=${encodeURIComponent(countryCode)}`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new ConfigError("The parcel machine list is unavailable");
  }
  const body = (await response.json()) as { parcel_machines?: unknown };
  if (!Array.isArray(body.parcel_machines) || body.parcel_machines.length === 0) {
    throw new ConfigError("The parcel machine list is unavailable");
  }
  return body.parcel_machines as readonly StorefrontParcelMachine[];
}
