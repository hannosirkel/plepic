/**
 * The logic behind `GET /admin/omniva/labels/:barcode` — behind a port, the
 * same shape `../admin/seed-administrator.ts` and
 * `../payment/customer-stripe-payment-session.ts` already use, and for the
 * same reason: the interesting behaviour here is not "call Medusa's
 * fulfillment module and Omniva's HTTP API", it is the branching between a
 * stored label, a re-requested one, and four distinct refusals — none of
 * which is observable from a route file that can only be exercised by
 * booting a real Medusa and a real OMX.
 *
 * ## Why a barcode with no stored label is not a bug
 *
 * `../modules/omniva/service.ts`'s `createFulfillment` registers a real
 * parcel and *then* asks Omniva for that parcel's PDF label in a separate
 * call, deliberately allowed to fail without failing the fulfilment — see
 * that file's own docstring on why: registration cannot be undone, so a
 * rolled-back fulfilment would make an operator's retry register a *second*
 * parcel and a second carrier charge over what may only have been a label
 * timeout. The result is a fulfilment that legitimately carries a barcode
 * and no PDF, with no record anywhere of *why* the label call failed beyond
 * a log line. This module is the repair: given the barcode, it re-requests
 * only the label — never the shipment — and stores whatever comes back.
 *
 * ## What this module refuses, and why each is a distinct outcome
 *
 * - **No fulfilment anywhere carries this barcode** (`unknown_barcode`): the
 *   barcode is stale, mistyped, or was never Omniva's to begin with.
 * - **A fulfilment carries this barcode but its provider is not Omniva**
 *   (`not_omniva`): defensive, not a case this codebase's own writers can
 *   produce today (only `createFulfillment` ever writes `data.barcode`, and
 *   only onto an Omniva fulfilment) — the same "refuse rather than guess"
 *   `../modules/omniva/client.ts`'s `requestLabel` already applies to a
 *   `successAddressCards` entry naming the wrong barcode. Answering as if a
 *   `data.barcode` collision on a non-Omniva fulfilment were this barcode's
 *   real label would print a wrong parcel's paperwork onto a shipment; a
 *   named refusal is what tells whoever reads it that its premise, not just
 *   this barcode, needs re-examining.
 * - **Omniva is not configured** (`not_configured`): only reachable on the
 *   re-request path — see below.
 * - **Omniva refuses the re-request** (`label_request_failed`): OMX itself
 *   answered, and refused; `../modules/omniva/client.ts`'s `requestLabel`
 *   throws with OMX's own explanation, wrapped here to also name the
 *   barcode.
 *
 * **The stored-PDF path is checked before configuration is.** A fulfilment
 * whose label was already fetched and stored must stay downloadable even if
 * `OMNIVA_*` is later unset (a merchant switching carriers, say) — Omniva
 * being unconfigured is only a real refusal on the path that would need to
 * *call* Omniva, which the stored path never does. Getting this order
 * backwards would turn "download a label that already exists" into "the
 * label is a 503 today", for no request this module actually needs to make.
 */

import { OMNIVA_FULFILLMENT_PROVIDER_ID } from "../commerce/shipping-model.js";

/**
 * The one slice of a Medusa `FulfillmentDTO` this module reads. Narrower
 * than the SDK's own type on purpose, the same way `../modules/omniva/service.ts`'s
 * `OmnivaLocationsReader` is narrower than `OmnivaLocations` — so a test can
 * hand this module a plain object literal rather than a real Medusa entity.
 */
export interface OmnivaLabelFulfillmentRecord {
  readonly id: string;
  readonly provider_id: string;
  readonly data: Record<string, unknown> | null;
}

export type OmnivaLabelErrorCode =
  | "missing_barcode"
  | "unknown_barcode"
  | "not_omniva"
  | "not_configured"
  | "label_request_failed";

/**
 * Every refusal this module raises, tagged with {@link OmnivaLabelErrorCode}
 * so the route can map each one onto its own HTTP status without parsing a
 * message string to decide what went wrong.
 */
export class OmnivaLabelError extends Error {
  readonly code: OmnivaLabelErrorCode;

  constructor(code: OmnivaLabelErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OmnivaLabelError";
    this.code = code;
  }
}

/**
 * What `resolveOmnivaLabel` needs from the outside world, and nothing more.
 *
 * Deliberately **no `registerShipment`-shaped dependency exists on this
 * interface at all** — not merely unused. That is what makes "can the
 * re-request path double-register a parcel?" answerable by reading this
 * file's imports rather than by trusting a runtime check: there is no
 * capability here through which this module could register a shipment even
 * if a future edit tried to.
 */
export interface OmnivaLabelPort {
  /**
   * Every fulfilment this route needs to be able to find its match in — not
   * pre-filtered to Omniva's provider, because {@link OmnivaLabelErrorCode}'s
   * `not_omniva` case needs to see a *non*-Omniva fulfilment carrying this
   * barcode in order to refuse it by name rather than answering
   * `unknown_barcode` for a barcode that, in fact, is not unknown at all.
   *
   * Unfiltered and unpaginated on purpose: Medusa's `FilterableFulfillmentProps`
   * has no `data` filter (`data` is a JSON column; nothing here can ask the
   * database "the fulfilment whose `data.barcode` is X" without a raw query
   * this codebase does not otherwise write), and this shop sells one SKU —
   * see `../commerce/product-model.ts`'s own docstring on that being a
   * frozen, load-bearing fact rather than an oversight. A fulfilment count
   * large enough to make an unfiltered scan slow is a scale this route does
   * not serve today; the fix, if that day comes, is a raw
   * `data->>'barcode'` query behind this same port, not a change to
   * anything below.
   */
  listFulfillments(): Promise<readonly OmnivaLabelFulfillmentRecord[]>;

  /** Whether Omniva is configured to be called at all — see this file's header. */
  isOmnivaConfigured(): boolean;

  /**
   * Re-requests **only** the label for a barcode that already exists at
   * Omniva. Implemented by the route as a single call to
   * `OmnivaClient.requestLabel` — never `registerShipment` — which is the
   * whole of why the re-request path cannot create a second parcel.
   */
  requestLabel(barcode: string): Promise<string>;

  /** Persists `data` (the matched fulfilment's own `data`, plus the new label) onto that fulfilment. */
  storeLabel(fulfillmentId: string, data: Record<string, unknown>): Promise<void>;
}

export interface OmnivaLabelResult {
  readonly barcode: string;
  readonly fulfillmentId: string;
  readonly pdfBase64: string;
}

function storedBarcode(record: OmnivaLabelFulfillmentRecord): string | null {
  const value = record.data?.barcode;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function storedLabel(record: OmnivaLabelFulfillmentRecord): string | null {
  const value = record.data?.label_pdf_base64;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Find the fulfilment `barcode` belongs to, and answer with its label —
 * stored already, or freshly re-requested and stored on the way out. See
 * this file's header for the full reasoning behind every branch below; this
 * docstring only orders them.
 *
 * 1. An empty barcode is refused before anything is looked up.
 * 2. No fulfilment anywhere carries it: `unknown_barcode`.
 * 3. It belongs to a fulfilment, but that fulfilment's provider is not
 *    Omniva: `not_omniva`.
 * 4. It already has a stored label: return it. Configuration is not
 *    consulted on this path — see this file's header.
 * 5. It does not, and Omniva is not configured: `not_configured`.
 * 6. It does not, Omniva is configured, and the re-request itself fails:
 *    `label_request_failed`, naming the barcode and OMX's own reason.
 * 7. It does not, and the re-request succeeds: the new label is stored
 *    (merged onto the fulfilment's existing `data`, so `parcel_machine_zip`/
 *    `parcel_machine_name` survive) and returned.
 */
export async function resolveOmnivaLabel(
  rawBarcode: string,
  port: OmnivaLabelPort,
): Promise<OmnivaLabelResult> {
  const barcode = rawBarcode.trim();
  if (barcode.length === 0) {
    throw new OmnivaLabelError("missing_barcode", "A barcode is required");
  }

  const fulfillments = await port.listFulfillments();
  const match = fulfillments.find((candidate) => storedBarcode(candidate) === barcode);
  if (match === undefined) {
    throw new OmnivaLabelError(
      "unknown_barcode",
      `No fulfilment carries the Omniva barcode ${barcode}`,
    );
  }

  if (match.provider_id !== OMNIVA_FULFILLMENT_PROVIDER_ID) {
    throw new OmnivaLabelError(
      "not_omniva",
      `Fulfilment ${match.id} carries barcode ${barcode} but its provider is ` +
        `${match.provider_id}, not ${OMNIVA_FULFILLMENT_PROVIDER_ID}`,
    );
  }

  const stored = storedLabel(match);
  if (stored !== null) {
    return { barcode, fulfillmentId: match.id, pdfBase64: stored };
  }

  if (!port.isOmnivaConfigured()) {
    throw new OmnivaLabelError(
      "not_configured",
      "Omniva is not configured: set OMNIVA_API_USER, OMNIVA_API_PASSWORD, " +
        "OMNIVA_CUSTOMER_CODE and OMNIVA_BASE_URL before a label can be re-requested",
    );
  }

  let pdfBase64: string;
  try {
    pdfBase64 = await port.requestLabel(barcode);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new OmnivaLabelError(
      "label_request_failed",
      `Omniva refused to re-issue the label for ${barcode}: ${reason}`,
      { cause: error },
    );
  }

  await port.storeLabel(match.id, { ...(match.data ?? {}), label_pdf_base64: pdfBase64 });

  return { barcode, fulfillmentId: match.id, pdfBase64 };
}
