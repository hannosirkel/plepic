import { cookies } from "next/headers";

import { destinationForCode, DESTINATION_COOKIE_NAME, type Destination } from "./destination.js";

/**
 * The destination this request is being quoted for, read on the **server**.
 *
 * The price is server-rendered, so the destination has to be known before the
 * first byte. Reading it here — rather than in a client effect — is what stops
 * the page painting one figure and swapping it after hydration, which on a
 * price is not a flicker but a second, different statement about what
 * something costs.
 *
 * This module only ever **reads**. The write is a `document.cookie` assignment
 * in `src/components/shop/DestinationSelector.tsx`, deliberately in one place
 * so `tests/browser-storage-disclosure.test.ts` has one write site to pin
 * against the row in `/legal/privacy`'s cookie table.
 *
 * A request with no cookie, or one carrying a value
 * `storefront/mock/countries.json` does not list, gets the operator's declared
 * default rather than a guess — see `./destination.js`.
 */
export async function getRequestDestination(): Promise<Destination> {
  const jar = await cookies();
  return destinationForCode(jar.get(DESTINATION_COOKIE_NAME)?.value);
}
