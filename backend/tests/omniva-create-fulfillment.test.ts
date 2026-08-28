import { createServer } from "node:http";
import type { Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import OmnivaFulfillmentProviderService from "../src/modules/omniva/service.js";

/**
 * A real `http.createServer` standing in for OMX, on a loopback port chosen
 * by the OS. Not a mocked `fetch` -- per ruling R16, the point of this suite
 * is to exercise `OmnivaClient`'s actual HTTP behaviour (its Basic-Auth
 * header, its status handling, its JSON parsing) on the real path, and a
 * mocked `fetch` would prove none of that; it would only prove this test
 * file agrees with itself about what `fetch` returns.
 *
 * Every request's `Authorization` header is recorded, in order, so
 * "registers, labels, and returns the barcode" can assert the client sent
 * exactly the Basic credential `readOmnivaConfig` was given -- not merely
 * *some* header.
 *
 * **The body posted to the registration path is captured and parsed, and
 * this is new.** It used to say only "the body is never read: the stub only
 * needs to answer by path" -- true of the *client*, but that framing quietly
 * covered a much bigger hole: nothing anywhere asserted that the JSON this
 * stub received was the *right* JSON. `service.ts`'s `createFulfillment`
 * builds that body from real order data -- `deliveryChannel`, the receiver's
 * `personName`, the customs `financialValue` -- and every one of those is a
 * plain string or number a typechecker cannot tell from a wrong one of the
 * same type (`"PARCEL_MACHINE"` vs `"COURIER"` is the same union;
 * `first_name` swapped for `last_name` is still a `string`;
 * `PRODUCT.amountMinor / 100` vs `PRODUCT.amountMinor` are both `number`).
 * Recording `registeredBodies` is what lets the tests below assert on that
 * mapping directly, at the wire boundary, rather than trusting
 * `buildShipmentRegistration`'s own exhaustive pure tests to somehow also
 * prove that `service.ts` calls it with the right input -- they cannot, by
 * construction, since they never see `service.ts` at all.
 *
 * **The label-request body is now captured too, in `labelBodies`, for the
 * same reason.** It used to go unread because "`requestLabel` only sends a
 * barcode this stub already knows" was true but incomplete -- it says
 * nothing about the *shape* `barcodes` is sent in, and OMX's real test
 * environment refuses the shape this client used to send (see `client.ts`'s
 * header: `barcodes: ["X"]` answers `500`, `barcodes: [{"barcode":"X"}]`
 * answers `200`). Recording `labelBodies` is what lets "registers, labels,
 * and returns the barcode" below assert the actual wire shape rather than
 * just that a label request happened.
 *
 * **This stub also refuses a registration whose receiver address carries
 * `city`, the way OMX's real test environment does.** OMX's manual names the
 * field `deliverypoint`; a receiver address built with `city` answered `500`
 * -- `Unrecognized field "city" (class
 * com.omniva.phoenix.domain.dto.presend.OffLoadSupportedAddressDto), not
 * marked as ignorable` -- against the real API (see `shipment.ts`'s header on
 * that branch). This is **not** a general schema validator: the stub checks
 * for exactly this one field, on exactly this one path, because that is the
 * one shape the real API is known to refuse and the one this suite needs a
 * regression to a `city`-emitting `shipment.ts` to be caught by.
 *
 * **And a registration whose `customs.shipmentItems[].originCountry` is
 * alpha-3, the same way.** The OMX manual gives that field as `string(3)`,
 * read everywhere in this codebase (until 2026-08-28) as ISO 3166-1
 * alpha-3. It is not: `originCountry: "CHN"` against the real test API
 * answers `200` with `resultCode: "ERROR"` and a `failedShipments` entry
 * carrying `{jakarta.validation.constraints.Size.message}:
 * shipment.customs.shipmentItems[0].originCountry - size must be between
 * {min} and {max}`; `originCountry: "CN"`, nothing else changed, answers
 * `200` with `resultCode: "OK"`. See `product-model.ts`'s
 * `ProductCustoms.originCountry` docstring for the full citation. Modelled
 * the same way as the `city` check above -- one field, one path, not a
 * schema validator -- so a regression to `PRODUCT.customs.originCountry:
 * "CHN"` is caught here rather than reaching the carrier.
 */
interface StubOmx {
  readonly baseUrl: string;
  readonly authorizationHeaders: string[];
  /** Every JSON body posted to `REGISTER_PATH`, in order, parsed. See this file's header. */
  readonly registeredBodies: unknown[];
  /** Every JSON body posted to `LABEL_PATH`, in order, parsed. See this file's header. */
  readonly labelBodies: unknown[];
  close(): Promise<void>;
}

interface StubOmxOptions {
  readonly register: unknown;
  readonly registerStatus?: number;
  readonly label?: unknown;
  readonly labelStatus?: number;
}

const REGISTER_PATH = "/api/v01/omx/shipments/business-to-client";
const LABEL_PATH = "/api/v01/omx/shipments/package-labels";

/**
 * OMX's actual refusal for a receiver address carrying a field it does not
 * recognise -- transcribed from the real `500` this suite's header cites,
 * not invented. Modelled here, rather than as a generic "unknown field"
 * checker, because refusing exactly the one shape the real API is known to
 * refuse is what makes this stub a regression test for defect A rather than
 * a schema validator this repository does not otherwise want to build or
 * maintain.
 */
function unrecognizedCityFieldResponse(): unknown {
  return {
    developerMessage:
      'Unrecognized field "city" (class com.omniva.phoenix.domain.dto.presend.OffLoadSupportedAddressDto), not marked as ignorable',
  };
}

/**
 * OMX's actual refusal for an alpha-3 `customs.shipmentItems[].originCountry`
 * -- transcribed from the real `resultCode: "ERROR"` response this suite's
 * header cites (a `200` carrying a business-level refusal, not an HTTP
 * error -- see `client.ts`'s `registerShipment` for why that is handled as
 * a `failedShipments` entry rather than a non-2xx status). Modelled here the
 * same way `unrecognizedCityFieldResponse` models defect A's refusal: one
 * field, one path, not a schema validator.
 */
function alpha3OriginCountryResponse(): unknown {
  return {
    resultCode: "ERROR",
    failedShipments: [{
      messageCode: "jakarta.validation.constraints.Size.message",
      message:
        "shipment.customs.shipmentItems[0].originCountry - size must be between {min} and {max}",
    }],
  };
}

async function stubOmx(options: StubOmxOptions): Promise<StubOmx> {
  const authorizationHeaders: string[] = [];
  const registeredBodies: unknown[] = [];
  const labelBodies: unknown[] = [];

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      authorizationHeaders.push(request.headers.authorization ?? "");

      if (request.url === REGISTER_PATH) {
        const raw = Buffer.concat(chunks).toString("utf8");
        const body = raw.length > 0 ? (JSON.parse(raw) as unknown) : undefined;
        registeredBodies.push(body);

        // Models the one shape OMX's real test API is known to refuse: a
        // receiver address carrying `city` instead of `deliverypoint`. See
        // this file's header.
        const shipments = (
          body as
            | {
                shipments?: readonly {
                  receiverAddressee?: { address?: unknown };
                  customs?: { shipmentItems?: readonly { originCountry?: unknown }[] };
                }[];
              }
            | undefined
        )?.shipments;
        const receiverAddress = shipments?.[0]?.receiverAddressee?.address;
        if (
          receiverAddress !== null &&
          typeof receiverAddress === "object" &&
          Object.prototype.hasOwnProperty.call(receiverAddress, "city")
        ) {
          response.writeHead(500, { "Content-Type": "application/json" });
          response.end(JSON.stringify(unrecognizedCityFieldResponse()));
          return;
        }

        // Models the one shape OMX's real test API is known to refuse on the
        // customs path: an alpha-3 `originCountry`. See this file's header.
        const customsItems = shipments?.[0]?.customs?.shipmentItems;
        if (
          Array.isArray(customsItems) &&
          customsItems.some(
            (item) => typeof item?.originCountry === "string" && /^[A-Z]{3}$/.test(item.originCountry),
          )
        ) {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify(alpha3OriginCountryResponse()));
          return;
        }

        const status = options.registerStatus ?? 200;
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(options.register));
        return;
      }

      if (request.url === LABEL_PATH) {
        const raw = Buffer.concat(chunks).toString("utf8");
        labelBodies.push(raw.length > 0 ? (JSON.parse(raw) as unknown) : undefined);
        const status = options.labelStatus ?? 200;
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(
          options.label !== undefined ? JSON.stringify(options.label) : "synthetic label failure",
        );
        return;
      }

      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: `no stub route for ${request.url ?? ""}` }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    authorizationHeaders,
    registeredBodies,
    labelBodies,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

/**
 * Fulfilment items and order, shaped exactly as the real
 * `createOrderFulfillmentWorkflow` passes them -- see `client.ts`'s header
 * for the code path this was confirmed against
 * (`@medusajs/core-flows`'s `order/workflows/create-fulfillment.js`). Loose
 * enough that this file needs no cast to satisfy `createFulfillment`'s
 * Medusa-declared parameter types, and nothing else: this shop sells exactly
 * one physical product (`PRODUCT` in `commerce/product-model.ts`), so
 * `createFulfillment` reads that frozen weight and price rather than
 * anything carried on an order line item.
 */
const ITEMS = [{ id: "fulitem_1", title: "Lunar Base", quantity: 1 }];

const ORDER = {
  id: "order_1",
  email: "buyer@example.com",
  shipping_address: {
    id: "ordaddr_1",
    first_name: "Mari",
    last_name: "Tamm",
    address_1: "Tee 1",
    postal_code: "10111",
    city: "Tallinn",
    country_code: "EE",
    phone: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  },
};

/**
 * A destination outside the EU -- no test in this file drove one through
 * `createFulfillment` before this suite gained the customs assertions below.
 * `US` is outside `EU_MEMBER_STATE_CODES`, so `shipment.ts` attaches a
 * `customs` block, and outside `PHONE_OPTIONAL_COUNTRY_CODES`, so it needs a
 * phone -- carried here so this order builds a registration at all rather
 * than tripping the phone refusal before customs is even reached.
 */
const NON_EU_ORDER = {
  id: "order_2",
  email: "buyer@example.com",
  shipping_address: {
    id: "ordaddr_2",
    first_name: "Jane",
    last_name: "Doe",
    address_1: "5th Ave 1",
    postal_code: "10001",
    city: "New York",
    country_code: "US",
    phone: "+12025550123",
    created_at: new Date(),
    updated_at: new Date(),
  },
};

/** The one shipment entry a registration body ever carries. Narrowed to what these tests read. */
interface RegisteredShipment {
  readonly deliveryChannel?: unknown;
  readonly servicePackage?: { readonly code?: unknown };
  readonly receiverAddressee: {
    readonly personName?: unknown;
    readonly address: Record<string, unknown>;
  };
  readonly customs?: {
    readonly goodsCategoryCode?: unknown;
    readonly shipmentItems: readonly {
      readonly financialValue?: unknown;
      readonly tariffNumber?: unknown;
      readonly originCountry?: unknown;
      readonly weight?: unknown;
    }[];
  };
}

/** The single registered shipment out of `StubOmx.registeredBodies[index]`. */
function registeredShipment(omx: StubOmx, index = 0): RegisteredShipment {
  const body = omx.registeredBodies[index] as { shipments: readonly RegisteredShipment[] };
  expect(body.shipments, `registeredBodies[${String(index)}]`).toHaveLength(1);
  return body.shipments[0]!;
}

/**
 * The narrow slice of Medusa's `Logger` this suite needs: just `error`, as a
 * spy, so "keeps the fulfilment when the label fails" and the
 * different-barcode case below can assert the swallow in `createFulfillment`
 * left a trace naming the barcode -- `this.logger?.error` is a silent no-op
 * without one, which would let the whole `catch` body be deleted and every
 * test in this file still pass. Cast at the call site (`as never`), the same
 * way `tests/omniva-validate-fulfillment-data.test.ts` substitutes a partial
 * `locations` stub, rather than implementing every method Medusa's `Logger`
 * declares for a test that only ever reads `error`.
 */
interface StubLogger {
  readonly error: ReturnType<typeof vi.fn>;
}

/**
 * Stubs every environment variable a fully-configured Omniva needs, pointed
 * at `omx`, and returns a fresh provider alongside the {@link StubLogger} it
 * was constructed with. `vi.unstubAllEnvs()` in `afterEach` below is what
 * keeps this from leaking into "refuses to register when unconfigured",
 * regardless of which test runs first.
 */
function providerAgainst(omx: StubOmx): { service: OmnivaFulfillmentProviderService; logger: StubLogger } {
  vi.stubEnv("OMNIVA_API_USER", "user");
  vi.stubEnv("OMNIVA_API_PASSWORD", "pass");
  vi.stubEnv("OMNIVA_CUSTOMER_CODE", "CUSTOMER");
  vi.stubEnv("OMNIVA_BASE_URL", omx.baseUrl);
  vi.stubEnv("MERCHANT_SENDER_STREET", "Pihlaka tn 2");
  vi.stubEnv("MERCHANT_SENDER_CITY", "Jüri alevik");
  vi.stubEnv("MERCHANT_SENDER_POSTCODE", "75301");
  vi.stubEnv("MERCHANT_SENDER_COUNTRY", "EE");
  vi.stubEnv("MERCHANT_PHONE_NUMBER", "+37255550100");
  vi.stubEnv("MERCHANT_LEGAL_NAME", "Plepic Games OÜ");
  vi.stubEnv("MERCHANT_CONTACT_ADDRESS", "info@example.com");
  const logger: StubLogger = { error: vi.fn() };
  return { service: new OmnivaFulfillmentProviderService({ logger: logger as never }), logger };
}

/**
 * No stubbed variable at all -- proving the refusal against whatever this
 * process's real environment holds, which in this repository holds none of
 * the Omniva or merchant-sender variables (see `config.ts`'s header: Omniva
 * has not issued this project a test credential). Asserted defensively with
 * `vi.unstubAllEnvs()` beforehand so this test's result cannot depend on
 * suite ordering.
 */
function unconfiguredProvider(): OmnivaFulfillmentProviderService {
  vi.unstubAllEnvs();
  return new OmnivaFulfillmentProviderService();
}

const STUB_FULFILLMENT_ID = "ful_01JABCDEFGHJKMNPQRSTVWXYZ";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createFulfillment: registering a real parcel, and the asymmetry after it", () => {
  it("registers, labels, and returns the barcode as the tracking number", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
      // fileData, capital D: the field the real API sends. See client.ts's
      // header -- the manual spells it `filedata`, and is wrong.
      label: { successAddressCards: [{ barcode: "CE123456789EE", fileData: "JVBERi0=" }] },
    });
    try {
      const { service } = providerAgainst(omx);
      const result = await service.createFulfillment(
        { parcel_machine_zip: "10145", parcel_machine_name: "Tallinn, Kristiine Keskus" },
        ITEMS,
        ORDER,
        { id: STUB_FULFILLMENT_ID },
      );

      expect(result.labels).toEqual([{
        tracking_number: "CE123456789EE",
        tracking_url: "https://www.omniva.ee/private/track-and-trace?barcode=CE123456789EE",
        label_url: "",
      }]);
      expect(result.data.barcode).toBe("CE123456789EE");
      expect(result.data.label_pdf_base64).toBe("JVBERi0=");
      // Minor M6: the chosen machine's ZIP and name must survive onto the
      // fulfilment's own `data` -- the Admin widget and the label route both
      // read them from there, and nothing asserted they arrive before this.
      expect(result.data.parcel_machine_zip).toBe("10145");
      expect(result.data.parcel_machine_name).toBe("Tallinn, Kristiine Keskus");
      expect(omx.authorizationHeaders).toEqual([
        "Basic " + Buffer.from("user:pass").toString("base64"),
        "Basic " + Buffer.from("user:pass").toString("base64"),
      ]);

      // I1: the body actually posted to OMX, not merely "a request happened".
      const shipment = registeredShipment(omx);
      expect(shipment.deliveryChannel).toBe("PARCEL_MACHINE");
      expect(shipment.receiverAddressee.address.offloadPostcode).toBe("10145");
      // Minor M2: firstName/lastName swapped at shipment.ts:248 would print
      // "Tamm Mari" on every label; ORDER's address is first_name "Mari",
      // last_name "Tamm", so this is only right one way round.
      expect(shipment.receiverAddressee.personName).toBe("Mari Tamm");

      // Defect B: OMX wants `barcodes` as an array of objects, not strings --
      // `{"barcodes":["X"]}` answers 500 against the real test API,
      // `{"barcodes":[{"barcode":"X"}]}` answers 200. See client.ts's header.
      expect(omx.labelBodies).toEqual([{
        customerCode: "CUSTOMER",
        barcodes: [{ barcode: "CE123456789EE" }],
        sendAddressCardTo: "RESPONSE",
      }]);
    } finally {
      await omx.close();
    }
  });

  /**
   * I1's courier counterpart to the parcel-machine assertions just above --
   * `deliveryChannel: "COURIER"` and a **street** address, not an
   * `offloadPostcode`. `ORDER`'s country is EE, a parcel-machine country, on
   * purpose: it proves `deliveryChannel` follows the buyer's chosen method
   * (`data.parcel_machine_zip` absent below) rather than the destination --
   * exactly the case `service.ts`'s own docstring calls out ("a Latvian
   * *courier* order still correctly registers as COURIER even though Latvia
   * has machines").
   */
  it("registers a courier shipment to the street address, not a parcel machine", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
      label: { successAddressCards: [{ barcode: "CE123456789EE", fileData: "JVBERi0=" }] },
    });
    try {
      const { service } = providerAgainst(omx);
      await service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID });

      const shipment = registeredShipment(omx);
      expect(shipment.deliveryChannel).toBe("COURIER");
      // Defect A: OMX's field is `deliverypoint`, not `city` -- see
      // shipment.ts's header. `toEqual` here is exact, so this also proves
      // `city` is not sent at all, not merely that `deliverypoint` is.
      expect(shipment.receiverAddressee.address).toEqual({
        street: "Tee 1",
        postcode: "10111",
        deliverypoint: "Tallinn",
        country: "EE",
      });
      expect(shipment.receiverAddressee.address).not.toHaveProperty("offloadPostcode");
      expect(shipment.receiverAddressee.address).not.toHaveProperty("city");
    } finally {
      await omx.close();
    }
  });

  /**
   * I1: no test drove a non-EU destination through `createFulfillment`
   * before this one, so the customs block -- built from `PRODUCT`, not from
   * anything on the order -- was unasserted on this path. `financialValue`
   * is exactly where a 100x error is available: `service.ts` computes
   * `unitPriceNet` as `PRODUCT.amountMinor / 100` (2500 minor units -> EUR
   * 25.00), and asserting `25`, not `2500`, is what a `financialValue:
   * PRODUCT.amountMinor` regression would fail.
   */
  it("attaches a customs block, built from PRODUCT, for a non-EU destination", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE999999999US" }] },
      label: { successAddressCards: [{ barcode: "CE999999999US", fileData: "JVBERi0=" }] },
    });
    try {
      const { service } = providerAgainst(omx);
      await service.createFulfillment({}, ITEMS, NON_EU_ORDER, { id: STUB_FULFILLMENT_ID });

      const shipment = registeredShipment(omx);
      // EE/LV/LT-only field; a US shipment carries servicePackage instead.
      expect(shipment).not.toHaveProperty("deliveryChannel");
      expect(shipment.servicePackage).toEqual({ code: "ECONOMY" });

      expect(shipment.customs).toBeDefined();
      expect(shipment.customs?.goodsCategoryCode).toBe("SALE_OF_GOODS");
      expect(shipment.customs?.shipmentItems).toHaveLength(1);
      const customsItem = shipment.customs?.shipmentItems[0];
      expect(customsItem?.financialValue).toBe(25);
      expect(customsItem?.tariffNumber).toBe("9504400000");
      // Defect D: OMX's originCountry is alpha-2 ("CN"), not alpha-3 ("CHN")
      // -- see this file's header and product-model.ts's
      // ProductCustoms.originCountry docstring. This request also reaches
      // this stub's alpha-3 rejection (above) if PRODUCT.customs.originCountry
      // regresses to "CHN": createFulfillment would then throw, and this
      // whole test would fail rather than merely this one assertion.
      expect(customsItem?.originCountry).toBe("CN");
      expect(customsItem?.weight).toBe(0.3);
    } finally {
      await omx.close();
    }
  });

  it("refuses the fulfilment when OMX refuses the registration", async () => {
    const omx = await stubOmx({
      register: {
        resultCode: "ERROR",
        failedShipments: [{
          messageCode: "com.omniva.phoenix.omx.address.resolve.error",
          message: "Address not resolved: 'Tee 1'",
        }],
      },
    });
    try {
      const { service } = providerAgainst(omx);
      await expect(
        service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
      ).rejects.toThrow(/Address not resolved/);
    } finally {
      await omx.close();
    }
  });

  /**
   * The asymmetry, asserted rather than described.
   *
   * Registration creates a parcel and cannot be taken back; a label is a read
   * against a barcode that now exists. If a label failure failed the
   * fulfilment, the rollback would leave the parcel registered and the
   * operator's retry would register a SECOND one -- a transient timeout
   * turned into a duplicate shipment and a duplicate carrier charge.
   */
  it("keeps the fulfilment when the label fails after the shipment is registered", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
      labelStatus: 500,
    });
    try {
      const { service, logger } = providerAgainst(omx);
      const result = await service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID });
      expect(result.data.barcode).toBe("CE123456789EE");
      expect(result.data.label_pdf_base64).toBeUndefined();
      expect(result.labels[0]?.tracking_number).toBe("CE123456789EE");
      // The swallow (`service.ts`'s `catch` around `requestLabel`) is the
      // only place this module deliberately does not propagate a failure --
      // and the only trace it leaves is this log. A test that only checked
      // "did not throw" would still pass if that whole `catch` body,
      // including the log call, were deleted.
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0]?.[0]).toEqual(expect.stringContaining("CE123456789EE"));
    } finally {
      await omx.close();
    }
  });

  /**
   * `requestLabel`'s "refuse rather than guess" (`client.ts`): a response
   * whose only success card names a different barcode must not be attached
   * to this fulfilment as if it were this parcel's label -- that would be a
   * label addressed to someone else's parcel, not merely a missing one.
   * Handled through the same swallow as any other label failure: the
   * fulfilment still succeeds, with no PDF, and the mismatch is logged.
   */
  it("does not attach a label meant for a different barcode", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
      label: { successAddressCards: [{ barcode: "CE_SOME_OTHER_PARCEL", fileData: "unrelated" }] },
    });
    try {
      const { service, logger } = providerAgainst(omx);
      const result = await service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID });
      expect(result.data.barcode).toBe("CE123456789EE");
      expect(result.data.label_pdf_base64).toBeUndefined();
      expect(logger.error.mock.calls[0]?.[0]).toEqual(expect.stringContaining("CE123456789EE"));
    } finally {
      await omx.close();
    }
  });

  it("refuses to register at all when Omniva is not configured", async () => {
    await expect(
      unconfiguredProvider().createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
    ).rejects.toThrow(/OMNIVA_API_USER|not configured/i);
  });

  it("refuses to register a fulfilment with no id", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
    });
    try {
      const { service } = providerAgainst(omx);
      await expect(service.createFulfillment({}, ITEMS, ORDER, {})).rejects.toThrow(
        /no id|fulfilment/i,
      );
    } finally {
      await omx.close();
    }
  });

  /**
   * The three registration-refusal shapes `client.ts`'s `registerShipment`
   * docstring names, each proven against the same stub `StubOmxOptions`
   * already carries `registerStatus` for -- previously declared and read by
   * `stubOmx`, but never exercised by a test.
   */
  describe("registration response shapes registerShipment refuses", () => {
    it("refuses a non-2xx registration status, naming OMX's own explanation", async () => {
      const omx = await stubOmx({
        register: { developerMessage: "invalid customerCode" },
        registerStatus: 500,
      });
      try {
        const { service } = providerAgainst(omx);
        // Both OMX's own explanation and the ambiguous-failure caution
        // (client.ts's `registerShipment`: a non-2xx here does not tell this
        // client whether OMX committed the parcel before failing to answer)
        // must be in the one message an operator actually sees.
        await expect(
          service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
        ).rejects.toThrow(/invalid customerCode.*already have been registered/);
      } finally {
        await omx.close();
      }
    });

    it("refuses resultCode OK with zero savedShipments", async () => {
      const omx = await stubOmx({ register: { resultCode: "OK", savedShipments: [] } });
      try {
        const { service } = providerAgainst(omx);
        await expect(
          service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
        ).rejects.toThrow(/savedShipments/);
      } finally {
        await omx.close();
      }
    });

    it("refuses resultCode OK with two savedShipments for one shipment", async () => {
      const omx = await stubOmx({
        register: {
          resultCode: "OK",
          savedShipments: [{ barcode: "CE123456789EE" }, { barcode: "CE999999999EE" }],
        },
      });
      try {
        const { service } = providerAgainst(omx);
        await expect(
          service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
        ).rejects.toThrow(/savedShipments/);
      } finally {
        await omx.close();
      }
    });

    /**
     * `client.ts:153-156`'s *inner* wrapper -- the `catch` around `fetch`
     * itself, before any HTTP response exists at all. Every other case in
     * this describe block gets a real response from `stubOmx` (a 500, a
     * malformed success shape); none of them exercise a `fetch` that never
     * connects in the first place, which is a different code path (`post`'s
     * `try` around `fetch`/`response.text()`, not its `if (!response.ok)`
     * branch below it). The outer wrap -- naming the fulfilment and cautioning
     * that a shipment may already be registered -- is already proven by the
     * "non-2xx registration status" test above; this only needs to reach the
     * inner one, so a closed port is enough: nothing has to actually answer.
     */
    it("names Omniva and the path when the registration request never gets a response at all", async () => {
      // A server that was briefly listening, then closed, rather than a
      // hard-coded port number: this is a real "nothing is listening here"
      // (ECONNREFUSED) on whichever port the OS happens to hand out, so the
      // test cannot collide with anything else already bound on this machine.
      const deadServer: Server = createServer();
      await new Promise<void>((resolve) => deadServer.listen(0, "127.0.0.1", resolve));
      const deadAddress = deadServer.address();
      const deadPort = typeof deadAddress === "object" && deadAddress !== null ? deadAddress.port : 0;
      await new Promise<void>((resolve, reject) => {
        deadServer.close((error) => (error ? reject(error) : resolve()));
      });

      const unreachable: StubOmx = {
        baseUrl: `http://127.0.0.1:${String(deadPort)}`,
        authorizationHeaders: [],
        registeredBodies: [],
        labelBodies: [],
        close: () => Promise.resolve(),
      };
      const { service } = providerAgainst(unreachable);
      await expect(
        service.createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
      ).rejects.toThrow(/Omniva did not answer POST/);
    });
  });
});

describe("cancelFulfillment: OMX v1.7 has no shipment-cancellation endpoint", () => {
  /**
   * I3. `AbstractFulfillmentProviderService.cancelFulfillment` throws
   * `"cancelFulfillment must be overridden by the child class"` when a
   * provider does not supply its own -- reachable from the Admin's **Cancel
   * fulfilment** action and from `createFulfillmentStep`'s compensation (see
   * `service.ts`'s own class docstring for the exact call chain). This
   * provider now overrides it with a refusal that names the parcel rather
   * than the base class, because OMX genuinely has no unregister call
   * (`client.ts:8-15`).
   */
  it("refuses, naming the barcode and pointing at Omniva's e-service", async () => {
    const service = new OmnivaFulfillmentProviderService();
    await expect(service.cancelFulfillment({ barcode: "CE123456789EE" })).rejects.toThrow(
      /CE123456789EE/,
    );
    await expect(service.cancelFulfillment({ barcode: "CE123456789EE" })).rejects.toThrow(
      /e-service/i,
    );
  });

  it("still refuses, without a barcode to point at, when the fulfilment's data carries none", async () => {
    const service = new OmnivaFulfillmentProviderService();
    await expect(service.cancelFulfillment({})).rejects.toThrow(/e-service/i);
    // Not "undefined" printed where a barcode would go -- the message names
    // its own absence instead. Caught by hand, rather than a second
    // `.rejects.toThrow`, because asserting the *absence* of a substring is
    // not what `toThrow`'s pattern matching is for.
    try {
      await service.cancelFulfillment({});
      expect.unreachable("cancelFulfillment must always refuse");
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).not.toMatch(/undefined/);
    }
  });
});
