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
 * Stubs every environment variable a fully-configured Omniva needs, pointed
 * at `omx`, and returns a fresh provider. `vi.unstubAllEnvs()` in `afterEach`
 * below is what keeps this from leaking into
 * "refuses to register when unconfigured", regardless of which test runs
 * first.
 */
function providerAgainst(omx: StubOmx): OmnivaFulfillmentProviderService {
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
  return new OmnivaFulfillmentProviderService();
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
      const result = await providerAgainst(omx).createFulfillment(
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
      await expect(
        providerAgainst(omx).createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
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
      const result = await providerAgainst(omx).createFulfillment(
        {},
        ITEMS,
        ORDER,
        { id: STUB_FULFILLMENT_ID },
      );
      expect(result.data.barcode).toBe("CE123456789EE");
      expect(result.data.label_pdf_base64).toBeUndefined();
      expect(result.labels[0]?.tracking_number).toBe("CE123456789EE");
    } finally {
      await omx.close();
    }
  });

  it("refuses to register at all when Omniva is not configured", async () => {
    await expect(
      unconfiguredProvider().createFulfillment({}, ITEMS, ORDER, { id: STUB_FULFILLMENT_ID }),
    ).rejects.toThrow(/OMNIVA_API_USER|not configured/i);
  });
});
