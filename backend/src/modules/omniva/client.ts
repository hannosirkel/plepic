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
 *
 * **Two exceptions, both confirmed by calling `test-omx.omniva.eu` on
 * 2026-08-28, both wrong in the manual as written:**
 *
 * - `requestLabel`'s outgoing `barcodes` field. The manual (section 1.7)
 *   says `array, string(5-30)` — an array of barcode strings. The live API
 *   disagrees: `{"barcodes":["CC405869298EE"]}` answers `500` —
 *   `Cannot construct instance of
 *   com.omniva.phoenix.domain.dto.common.BarcodeValueDto (although at least
 *   one Creator exists): no String-argument constructor/factory method to
 *   deserialize from String value ('CC405869298EE')` — while
 *   `{"barcodes":[{"barcode":"CC405869298EE"}]}` answers `200`. See
 *   `requestLabel`'s own docstring.
 * - `SuccessAddressCard`'s incoming label field. The manual spells it
 *   `filedata`; the live API returns `fileData` (capital D):
 *   `{"successAddressCards":[{"barcode":"CC405869298EE","fileData":"JVBERi0…"}]}`
 *   (`JVBERi0` decodes to `%PDF-1`, confirming it is the label PDF, not a
 *   coincidentally-similar field). See `requestLabel`'s own docstring for
 *   how this file reads both spellings.
 *
 * Trust the observed response over the manual for these two; a future
 * "correction" back to what the manual says would silently reintroduce a
 * `500` on every label request (`barcodes`) or a `filedata`-shaped hole that
 * makes every label request appear to succeed while storing nothing
 * (`fileData`).
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

/**
 * One entry of OMX's `successAddressCards[]` — section 1.7 of the manual.
 *
 * Carries **both** spellings of the label field. `fileData` is what the live
 * API actually sends — see this file's header for the observed response.
 * `filedata` — the manual's spelling — is kept as a fallback so this file
 * keeps working without a code change if Omniva ever aligns the API with its
 * own manual; see `requestLabel` for how the two are read.
 */
interface SuccessAddressCard {
  readonly barcode?: unknown;
  readonly fileData?: unknown;
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
 * OMX answered the HTTP call cleanly and refused the shipment on its merits:
 * a `resultCode` other than `"OK"`. Nothing was committed at Omniva, the
 * reason is OMX's own words, and it is usually something the person
 * fulfilling the order can act on — a parcel machine OMX does not recognise,
 * an address it will not accept.
 *
 * It exists so `service.ts` can tell that case apart from the *ambiguous*
 * one — a timeout, a reset, a non-2xx — without matching on message text.
 * The two must reach a merchant differently: a refusal is a `400` carrying
 * OMX's sentence verbatim, while an ambiguous failure is a `500` that says a
 * parcel may already exist. Collapsing them would either hide a real outage
 * behind a `400` or bury an actionable sentence behind "an unknown error
 * occurred".
 *
 * Deliberately **not** thrown for the two `resultCode: "OK"` disagreements
 * below (no barcode, or a `savedShipments` length other than one). Those are
 * this client and OMX disagreeing about what happened, which is exactly the
 * ambiguous case.
 */
export class OmnivaRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OmnivaRefusal";
  }
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
   *
   * **A failure before any response arrives is a separate case, caught here
   * and rethrown naming Omniva and the path.** `fetch` rejects with a bare
   * `TimeoutError` or `TypeError: fetch failed` for a timeout, a DNS
   * failure, or a connection reset — none of which mention Omniva, this
   * path, or which call was in flight. Left unwrapped, that is exactly the
   * message an operator would see for `registerShipment` failing *after*
   * OMX already committed the parcel (a request that times out on the way
   * back, or a 502 from a proxy in front of OMX, can each follow a real
   * commit) — the one case this file's header says must not read as an
   * ordinary, safely-retryable refusal. `registerShipment` below adds the
   * fulfilment id and the explicit "may already be registered" caution on
   * top of whatever this method throws; this method only owns naming Omniva
   * and the path, because it does not know which of the two calls, or which
   * fulfilment, it is answering for.
   */
  private async post(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    let raw: string;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/+$/, "")}${path}`, {
        method: "POST",
        headers: {
          Authorization: basicAuthorizationHeader(this.config),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      raw = await response.text();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Omniva did not answer POST ${path}: ${reason}`, { cause: error });
    }

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
   * `fulfillmentId` is not sent to Omniva a second time (it is already
   * `body`'s `partnerShipmentId`); it exists on this signature purely so the
   * ambiguous-failure case below can name the fulfilment an operator would
   * otherwise have to work out from context.
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
   * why that string, unedited, is what an operator needs. That case is not
   * ambiguous: the manual states `"ERROR"` means registration failed, so
   * nothing was committed, and the message below is deliberately not
   * decorated with a "may already be registered" caution that would not be
   * true.
   *
   * **Any failure reaching this point from `post` — a timeout, a connection
   * reset, a non-2xx status — is different, and is not left as `post`'s bare
   * message.** None of those tell this client whether OMX committed the
   * parcel before failing to answer; a 502 from a proxy in front of OMX, or a
   * timeout on the way back, can each follow a real commit. So this catch
   * names the fulfilment and says outright that a shipment may already
   * exist, so an operator sees that reasoning before retrying — not just
   * this file's header, which they are not reading at 2am.
   */
  async registerShipment(body: unknown, fulfillmentId: string): Promise<{ barcode: string }> {
    let parsed: RegisterResponseBody;
    try {
      parsed = (await this.post(REGISTER_PATH, body)) as RegisterResponseBody;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not confirm the Omniva registration for fulfilment ${fulfillmentId}: ${reason}. ` +
          "A shipment may already have been registered at Omniva for this fulfilment -- " +
          "check OMX before retrying, rather than registering a second one.",
        { cause: error },
      );
    }

    if (parsed.resultCode !== "OK") {
      const failed = Array.isArray(parsed.failedShipments)
        ? (parsed.failedShipments[0] as FailedShipment | undefined)
        : undefined;
      if (failed !== undefined) {
        throw new OmnivaRefusal(`${text(failed.messageCode)}: ${text(failed.message)}`);
      }
      throw new OmnivaRefusal(
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
   * return the label in this response at all rather than mailing it, per
   * the manual's section 1.7; `createFulfillment` needs the PDF in hand to
   * store on the fulfilment, not delivered to an inbox nobody here reads.
   *
   * **`barcodes` is sent as an array of objects, `[{ barcode }]`, not an
   * array of strings.** The manual (section 1.7) documents `barcodes` as
   * `array, string(5-30)`, and that is what this method used to send. OMX's
   * real test environment refuses it: `{"barcodes":["CC405869298EE"]}`
   * answers `500` — `Cannot construct instance of
   * com.omniva.phoenix.domain.dto.common.BarcodeValueDto (although at least
   * one Creator exists): no String-argument constructor/factory method to
   * deserialize from String value ('CC405869298EE')` — while
   * `{"barcodes":[{"barcode":"CC405869298EE"}]}` answers `200`. Trust the
   * observed shape, not the manual's `string(5-30)`: this is the one field
   * name in this file that is transcribed from the live response rather than
   * the document, and a future "correction" back to plain strings would fail
   * every label request in this backend.
   *
   * **Reads `fileData`, tolerating `filedata` as a fallback.** OMX's real
   * response carries `fileData` (capital D); the manual spells it
   * `filedata`, all lowercase. See this file's header for the observed body.
   * This is the one place in this file that reads a field the manual did not
   * predict *without* refusing the unexpected shape — a deliberate exception
   * to the "refuse rather than guess" rule this same method applies to
   * matching a `successAddressCards` entry by barcode (below): matching the
   * wrong barcode's label to this parcel is a correctness hazard (the wrong
   * PDF gets stored and printed), so that case refuses. Accepting either
   * capitalisation of the *same*, already-matched card's own field is not —
   * there is only one plausible reading of "the label content for the card
   * this method already confirmed is barcode X", and refusing it because OMX
   * capitalised a letter differently than its own manual would trade a
   * silent, indefinite label outage (`requestLabel` throwing
   * `OMX returned no label for …` forever, exactly what defect C's blast
   * radius was before this fix) for no real safety. If Omniva ever changes
   * the live response to match the manual's `filedata`, this method keeps
   * working with no code change.
   *
   * Every failure path here — a non-2xx status, `failedAddressCards`
   * carrying this barcode, or a `successAddressCards` entry with neither
   * `fileData` nor `filedata` — throws. This method has no "partial success"
   * to report; it is `createFulfillment`'s `try`/`catch` around this call,
   * not this method, that decides a label failure must not fail the
   * fulfilment.
   */
  async requestLabel(barcode: string): Promise<string> {
    const parsed = (await this.post(LABEL_PATH, {
      customerCode: this.config.customerCode,
      barcodes: [{ barcode }],
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
    // Matched by barcode, never defaulted to `successCards[0]`. A response
    // whose only success card names a different barcode is not this
    // fulfilment's label -- returning it anyway would store, and later
    // print, a label addressed to someone else's parcel. Refusing here is
    // the same "refuse rather than guess" `registerShipment` already applies
    // to a saved-shipments count it does not recognise; nothing in the
    // manual's section 1.7 describes a `successAddressCards` entry that
    // omits `barcode`, so there is no documented case this match is too
    // strict for.
    const success = successCards.find((card) => text(card.barcode) === barcode);
    // `fileData` first -- the field OMX's live API actually sends, per this
    // method's own docstring -- `filedata` as a fallback for the spelling
    // the manual documents, in case Omniva ever aligns the two. See the
    // docstring above for why this is a deliberate exception to "refuse
    // rather than guess", not an instance of it.
    const rawLabel = text(success?.fileData);
    const filedata = rawLabel.length > 0 ? rawLabel : text(success?.filedata);
    if (filedata.length === 0) {
      throw new Error(`OMX returned no label for ${barcode}`);
    }

    return filedata;
  }
}
