import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { FulfillmentDTO, IFulfillmentModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { readOmnivaConfig } from "../../../../../modules/omniva/config.js";
import { OmnivaClient } from "../../../../../modules/omniva/client.js";
import {
  OmnivaLabelError,
  resolveOmnivaLabel,
  type OmnivaLabelFulfillmentRecord,
} from "../../../../../fulfillment/omniva-label.js";

/**
 * Given an Omniva barcode, serves its shipping label as a downloadable PDF —
 * the stored one if `../../../../../modules/omniva/service.ts`'s
 * `createFulfillment` already fetched it, or a freshly re-requested one
 * (stored on the way out) if the label call failed at fulfilment time and
 * nobody has repaired it since. See `../../../../../fulfillment/omniva-label.ts`'s
 * own header for why that gap is a legitimate, expected state rather than a
 * bug, and for the full reasoning behind every refusal below; this file only
 * wires that module to a real Medusa container and maps its outcomes onto
 * HTTP.
 *
 * **Admin-only, and not by anything this file writes.** Every route under
 * `src/api/admin/` is authenticated by Medusa's own `ApiLoader` before
 * Express ever reaches a handler here — read `@medusajs/framework`'s
 * `dist/http/router.js` to confirm this rather than assume it: it applies
 * `authenticate(routesFinder, "/admin", "user", ["bearer", "session",
 * "api-key"])` with no `allowUnauthenticated`, unlike the call it makes for
 * `/store`. This route earns its authentication by living here, under
 * `admin/`, and specifically **not** under `store/` — see the task brief
 * this file was built against: the label carries a customer's name and
 * delivery address, and `/store` is reachable by anyone holding a
 * publishable key.
 *
 * **Why this is a `GET` that can still write to the database.** The
 * re-request path calls `OmnivaClient.requestLabel` — a read against a
 * barcode that already exists at Omniva, per `client.ts`'s own header — and
 * stores whatever comes back so the next request for the same barcode does
 * not have to ask Omniva again. Nothing here ever calls
 * `OmnivaClient.registerShipment`; that capability does not even exist on
 * `OmnivaLabelPort`, so there is no way for this route to create a second
 * parcel, whatever it does with the response.
 */

/**
 * Where each {@link OmnivaLabelError} code lands as an HTTP status.
 *
 * `not_omniva` and `unknown_barcode` share `404`: from this route's own
 * perspective, both mean "there is no Omniva label at this barcode for me to
 * serve", and an admin operator reading either message gets the real reason
 * regardless of the status code. `not_configured` is `503` — the label
 * cannot be re-requested right now, not "this barcode does not exist" — and
 * `label_request_failed` is `502`: Omniva itself answered and refused,
 * which is this route acting as a proxy in front of an upstream that said no.
 */
const ERROR_STATUS: Record<OmnivaLabelError["code"], number> = {
  missing_barcode: 400,
  unknown_barcode: 404,
  not_omniva: 404,
  not_configured: 503,
  label_request_failed: 502,
};

function toRecord(fulfillment: FulfillmentDTO): OmnivaLabelFulfillmentRecord {
  return {
    id: fulfillment.id,
    provider_id: fulfillment.provider_id,
    data: fulfillment.data ?? null,
  };
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const barcode = typeof req.params.barcode === "string" ? req.params.barcode : "";
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillmentModuleService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT);

  // Read once, up front, rather than once per port method: `readOmnivaConfig`
  // can itself throw (a *partially* configured environment — see its own
  // docstring on ruling R17), which is a distinct, operator-actionable
  // failure this route answers by name rather than folding into a generic
  // 500 or silently treating as "not configured at all".
  let config: ReturnType<typeof readOmnivaConfig>;
  try {
    config = readOmnivaConfig(process.env);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`Omniva's configuration is invalid: ${reason}`);
    res.status(503).json({ message: reason });
    return;
  }

  try {
    const result = await resolveOmnivaLabel(barcode, {
      listFulfillments: async () => {
        const fulfillments = await fulfillmentModuleService.listFulfillments(
          {},
          { select: ["id", "provider_id", "data"] },
        );
        return fulfillments.map(toRecord);
      },
      isOmnivaConfigured: () => config !== null,
      requestLabel: async (matchedBarcode) => {
        // Defensive, not a real-world branch: `resolveOmnivaLabel` only
        // calls this once `isOmnivaConfigured()` has already answered
        // `true` against this same `config`, which does not change between
        // the two calls.
        if (config === null) {
          throw new Error("Omniva configuration was unconfigured after isOmnivaConfigured() reported it configured");
        }
        return new OmnivaClient(config).requestLabel(matchedBarcode);
      },
      storeLabel: async (fulfillmentId, data) => {
        await fulfillmentModuleService.updateFulfillment(fulfillmentId, { data });
      },
    });

    // The PDF's own bytes are never logged, whatever happens above or
    // below — only the barcode and, on a refusal, the reason. It carries a
    // customer's name and delivery address; see this file's own header.
    const buffer = Buffer.from(result.pdfBase64, "base64");
    res.status(200);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="omniva-${result.barcode}.pdf"`,
      "Content-Length": String(buffer.length),
    });
    res.send(buffer);
  } catch (error) {
    if (error instanceof OmnivaLabelError) {
      logger.error(`Omniva label request for barcode "${barcode}" refused: ${error.message}`);
      res.status(ERROR_STATUS[error.code]).json({ message: error.message });
      return;
    }
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`Omniva label request for barcode "${barcode}" failed unexpectedly: ${reason}`);
    res.status(500).json({ message: "The Omniva label could not be retrieved" });
  }
}
