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
 */
interface StubOmx {
  readonly baseUrl: string;
  readonly authorizationHeaders: string[];
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

async function stubOmx(options: StubOmxOptions): Promise<StubOmx> {
  const authorizationHeaders: string[] = [];

  const server: Server = createServer((request, response) => {
    // The body is never read: the stub only needs to answer by path, and
    // `client.ts`'s own request-shape correctness is proven by typechecking
    // its `post` callers against `OmnivaConfig`/`buildShipmentRegistration`,
    // not by this stub re-parsing what it sent.
    request.resume();
    request.on("end", () => {
      authorizationHeaders.push(request.headers.authorization ?? "");

      if (request.url === REGISTER_PATH) {
        const status = options.registerStatus ?? 200;
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(options.register));
        return;
      }

      if (request.url === LABEL_PATH) {
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
      label: { successAddressCards: [{ barcode: "CE123456789EE", filedata: "JVBERi0=" }] },
    });
    try {
      const { service } = providerAgainst(omx);
      const result = await service.createFulfillment(
        { parcel_machine_zip: "10145" },
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
      expect(omx.authorizationHeaders).toEqual([
        "Basic " + Buffer.from("user:pass").toString("base64"),
        "Basic " + Buffer.from("user:pass").toString("base64"),
      ]);
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
      label: { successAddressCards: [{ barcode: "CE_SOME_OTHER_PARCEL", filedata: "unrelated" }] },
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
  });
});
