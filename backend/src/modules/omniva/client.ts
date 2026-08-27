/**
 * The one thing in this backend that actually talks to OMX over HTTP, and the
 * two calls `createFulfillment` (`service.ts`) makes through it.
 *
 * **Two calls, and they fail differently — read this before touching either
 * method.**
 *
 * {@link OmnivaClient.registerShipment} creates a real parcel at Omniva and
 * **cannot be undone from here**: there is no "unregister" call in the OMX
 * API manual (v1.7), only a courier-pickup cancellation and a return-shipment
 * registration, neither of which erases the original. A refusal from this
 * method must reach `createFulfillment`'s caller unchanged, because the
 * fulfilment failing in front of an operator — order stays unfulfilled,
 * nothing is emailed, someone retries by hand — is the only safe response to
 * "did this actually get created or not".
 *
 * {@link OmnivaClient.requestLabel} is a read against a barcode that already
 * exists; nothing is created or changed by asking for its label a second
 * time. `createFulfillment` is the one place that turns a refusal from this
 * method into "log it and carry on" — see its own docstring for why that
 * asymmetry is deliberate rather than an oversight. This file only supplies
 * the two calls; it does not decide how their failures are handled.
 *
 * ## Where the shapes below come from
 *
 * Every field name, and every message-shape assertion in `registerShipment`
 * and `requestLabel`, is transcribed from OMX API manual for customers,
 * v1.7 (23.10.2025) — sections 1.4.2 ("Shipment registration responses") and
 * 1.7 ("Request label") — not inferred from the stub server this repository's
 * own tests run against. The stub can only prove this file parses what it is
 * told to expect; the manual is what says OMX's real response actually looks
 * like this.
 */

import type { OmnivaConfig } from "./config";

/** `POST business-to-client`. Registers a real parcel. See this file's header. */
const REGISTER_PATH = "/api/v01/omx/shipments/business-to-client";

/** `POST package-labels`. Reads a label for a barcode that already exists. */
const LABEL_PATH = "/api/v01/omx/shipments/package-labels";

/**
 * Ten seconds. OMX's manual documents no SLA for either call, so this is a
 * judgment call, not a transcribed figure: long enough that a normal
 * request/response round trip over the public internet is never cut short,
 * short enough that a hung TCP connection does not stall a Medusa admin
 * request — or, worse, the `createFulfillment` workflow step — indefinitely.
 * `AbortSignal.timeout` turns a hang into a normal rejection either call
 * already has to handle.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/** One entry of OMX's `savedShipments[]` — section 1.4.2 of the manual. */
interface SavedShipment {
  readonly barcode?: unknown;
}

/** One entry of OMX's `failedShipments[]` — section 1.4.2 of the manual. */
interface FailedShipment {
  readonly messageCode?: unknown;
  readonly message?: unknown;
}

/** The whole `business-to-client` response body, narrowed to what this file reads. */
interface RegisterResponseBody {
  readonly resultCode?: unknown;
  readonly savedShipments?: unknown;
  readonly failedShipments?: unknown;
}

/** One entry of OMX's `successAddressCards[]` — section 1.7 of the manual. */
interface SuccessAddressCard {
  readonly barcode?: unknown;
  readonly filedata?: unknown;
}

/** One entry of OMX's `failedAddressCards[]` — section 1.7 of the manual. */
interface FailedAddressCard {
  readonly barcode?: unknown;
  readonly messageCode?: unknown;
}

/** The whole `package-labels` response body, narrowed to what this file reads. */
interface LabelResponseBody {
  readonly successAddressCards?: unknown;
  readonly failedAddressCards?: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The `OmnivaConfig.apiUser`/`apiPassword` pair, as the `Authorization`
 * header the manual's section 1.2 ("Authentication") specifies: "HTTP BASIC
 * AUTHENTICATION". Node's global `Buffer` — no dependency added for a
 * base64 encoding this small.
 */
function basicAuthorizationHeader(config: OmnivaConfig): string {
  return `Basic ${Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString("base64")}`;
}

/**
 * OMX, over HTTP — nothing else in this module is allowed to hold a `fetch`
 * call to `config.baseUrl`. Constructed fresh by `service.ts`'s
 * `createFulfillment` from whatever `readOmnivaConfig` returns; it carries no
 * state beyond that config, so there is nothing to share or memoize across
 * requests the way `redis-cache.ts`'s Redis client is.
 */
export class OmnivaClient {
  constructor(private readonly config: OmnivaConfig) {}

  /**
   * One POST, JSON in, JSON (or nothing) out, refusing anything OMX answers
   * that is not a successful HTTP status.
   *
   * A non-2xx status refuses with as much of OMX's own explanation as the
   * body carries — `developerMessage` if present, the raw body text
   * otherwise — rather than just the status code, because an operator
   * reading this in a log is trying to learn what OMX objected to, not just
   * that it objected.
   */
  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: {
        Authorization: basicAuthorizationHeader(this.config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const raw = await response.text();

    if (!response.ok) {
      let detail = raw;
      try {
        const parsed = raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};
        if (typeof parsed.developerMessage === "string") {
          detail = parsed.developerMessage;
        } else if (parsed.errors !== undefined) {
          detail = JSON.stringify(parsed.errors);
        }
      } catch {
        // `raw` is kept as-is: OMX answered a non-2xx with a body this
        // method cannot parse as JSON, and the raw text is still more useful
        // to an operator than nothing.
      }
      throw new Error(`OMX ${path} answered ${String(response.status)}: ${detail}`);
    }

    if (raw.length === 0) return {};
    return JSON.parse(raw) as unknown;
  }

  /**
   * Registers one shipment. `body` is `buildShipmentRegistration`'s output —
   * this method sends it unchanged and reads only OMX's response.
   *
   * **Refuses unless `resultCode === "OK"` with exactly one `savedShipments`
   * entry carrying a barcode.** Not "at least one": this client only ever
   * registers a single shipment per call (`buildShipmentRegistration` always
   * emits a one-element `shipments` array), so zero or more than one saved
   * entry is OMX disagreeing with this client about how many shipments were
   * in the request — a shape this client should refuse rather than guess at,
   * not a business outcome to report as if it were the one expected.
   *
   * A `resultCode: "ERROR"` raises the first `failedShipments` entry's
   * `messageCode` and `message` **verbatim** — see this file's header for
   * why that string, unedited, is what an operator needs.
   */
  async registerShipment(body: unknown): Promise<{ barcode: string }> {
    const parsed = (await this.post(REGISTER_PATH, body)) as RegisterResponseBody;

    if (parsed.resultCode !== "OK") {
      const failed = Array.isArray(parsed.failedShipments)
        ? (parsed.failedShipments[0] as FailedShipment | undefined)
        : undefined;
      if (failed !== undefined) {
        throw new Error(`${text(failed.messageCode)}: ${text(failed.message)}`);
      }
      throw new Error(
        `OMX refused the shipment registration (resultCode: ${JSON.stringify(parsed.resultCode)})`,
      );
    }

    const saved = Array.isArray(parsed.savedShipments) ? parsed.savedShipments : [];
    if (saved.length !== 1) {
      throw new Error(
        `OMX reported resultCode "OK" but returned ${String(saved.length)} savedShipments for one shipment`,
      );
    }

    const barcode = text((saved[0] as SavedShipment).barcode);
    if (barcode.length === 0) {
      throw new Error('OMX reported resultCode "OK" but the saved shipment carries no barcode');
    }

    return { barcode };
  }

  /**
   * Requests the PDF label for an **already-registered** barcode, as base64.
   *
   * `sendAddressCardTo: "RESPONSE"` — not `"EMAIL"` — is what makes OMX
   * return `filedata` in this response at all rather than mailing it, per
   * the manual's section 1.7; `createFulfillment` needs the PDF in hand to
   * store on the fulfilment, not delivered to an inbox nobody here reads.
   *
   * Every failure path here — a non-2xx status, `failedAddressCards`
   * carrying this barcode, or a `successAddressCards` entry with no
   * `filedata` — throws. This method has no "partial success" to report; it
   * is `createFulfillment`'s `try`/`catch` around this call, not this
   * method, that decides a label failure must not fail the fulfilment.
   */
  async requestLabel(barcode: string): Promise<string> {
    const parsed = (await this.post(LABEL_PATH, {
      customerCode: this.config.customerCode,
      barcodes: [barcode],
      sendAddressCardTo: "RESPONSE",
    })) as LabelResponseBody;

    const failed = Array.isArray(parsed.failedAddressCards)
      ? (parsed.failedAddressCards as FailedAddressCard[]).find((card) => text(card.barcode) === barcode)
      : undefined;
    if (failed !== undefined) {
      throw new Error(`OMX refused the label for ${barcode}: ${text(failed.messageCode)}`);
    }

    const successCards = Array.isArray(parsed.successAddressCards)
      ? (parsed.successAddressCards as SuccessAddressCard[])
      : [];
    const success = successCards.find((card) => text(card.barcode) === barcode) ?? successCards[0];
    const filedata = text(success?.filedata);
    if (filedata.length === 0) {
      throw new Error(`OMX returned no label data for ${barcode}`);
    }

    return filedata;
  }
}
