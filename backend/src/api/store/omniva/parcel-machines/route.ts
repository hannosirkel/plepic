import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { ICacheService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { PARCEL_MACHINE_COUNTRY_CODES } from "../../../../commerce/shipping-model.js";
import { OmnivaLocations } from "../../../../modules/omniva/locations.js";

/**
 * The parcel machines a buyer in one country may choose from at checkout.
 *
 * Served by the backend, from the backend's own cached copy of Omniva's
 * location feed, rather than fetched by the storefront directly from
 * `omniva.ee`. That is a CSP requirement, not a style choice: the checkout
 * page's Content-Security-Policy lists no third-party `connect-src`, and
 * adding one for Omniva just to fetch a machine list would open a channel
 * from every buyer's browser to a host this shop otherwise never talks to
 * from the client. Routing the request through `/store-api` instead keeps
 * the checkout same-origin and keeps Omniva reachable from the backend only
 * -- the same containment `OmnivaFulfillmentProviderService`'s docstring
 * describes for `createFulfillment`.
 *
 * `country` is required and validated against
 * {@link PARCEL_MACHINE_COUNTRY_CODES} rather than passed through to
 * `OmnivaLocations` unchecked: an unrecognised or missing code is a request
 * this route can reject on its own terms (`400`), instead of quietly asking
 * `OmnivaLocations` for a country it will only ever answer with an empty
 * list for -- which would look, from the storefront, exactly like a real
 * country that simply has no machines nearby.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const country = String(req.query.country ?? "").trim().toUpperCase();
  if (!PARCEL_MACHINE_COUNTRY_CODES.includes(country)) {
    res.status(400).json({ message: "Parcel machines are offered in EE, LV and LT only" });
    return;
  }

  const cache = req.scope.resolve<ICacheService>(Modules.CACHE);
  const locations = new OmnivaLocations(cache);
  try {
    res.json({ parcel_machines: await locations.list(country) });
  } catch (error) {
    // `OmnivaLocations` throws with a message naming what went wrong (Omniva
    // unreachable, an HTTP error, an empty or unparsable payload). That
    // detail is logged for the operator rather than returned to the buyer's
    // browser, which gets a uniform, generic refusal instead.
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(
      "The Omniva parcel machine list is unavailable",
      error as Error,
    );
    res.status(503).json({ message: "The parcel machine list is unavailable" });
  }
}
