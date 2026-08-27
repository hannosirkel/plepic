import { createServer } from "node:http";
import type { Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { OMNIVA_FULFILLMENT_PROVIDER_ID } from "../src/commerce/shipping-model.js";
import { GET } from "../src/api/admin/omniva/labels/[barcode]/route.js";

/**
 * This file proves the route's *wiring* -- that `GET` reads `req.params`,
 * resolves the fulfilment module and Omniva's own configuration the way the
 * rest of this backend does, sets the response an admin operator's browser
 * needs to trigger a download, and maps each `OmnivaLabelError` code onto the
 * HTTP status this file's own docstring commits to. Every *branch* --
 * barcode lookup, the stored-PDF path, the re-request path, base64 handling,
 * and all four refusals -- is already proven against a plain port in
 * `tests/omniva-label.test.ts`; duplicating that here would only prove this
 * file agrees with itself about what its own mocks return.
 *
 * **Authentication is deliberately not exercised here.** `GET` is a bare
 * function; calling it directly, as this file does, bypasses the Express
 * middleware chain entirely -- the same is true of every other route test in
 * this backend (`tests/customer-stripe-payment-session-route.test.ts` does
 * not re-test store CORS or the publishable-key gate either). What makes
 * this an *admin* route, unconditionally, is that it lives under
 * `src/api/admin/`: `@medusajs/framework/dist/http/router.js`'s `ApiLoader`
 * applies `authenticate(..., "/admin", "user", ["bearer", "session",
 * "api-key"])` to every route under that prefix before Express ever reaches
 * a handler, without `allowUnauthenticated` -- unlike its own `/store` call,
 * which passes it explicitly. That is a fact about the framework's router,
 * read from its own compiled source, not a behaviour this file's handler
 * implements or could disable.
 */

const LABEL_PATH = "/api/v01/omx/shipments/package-labels";

interface StubOmx {
  readonly baseUrl: string;
  close(): Promise<void>;
}

async function stubOmxLabel(options: { readonly label: unknown; readonly status?: number }): Promise<StubOmx> {
  const server: Server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      if (request.url === LABEL_PATH) {
        response.writeHead(options.status ?? 200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(options.label));
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
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function stubOmnivaEnv(baseUrl: string): void {
  vi.stubEnv("OMNIVA_API_USER", "user");
  vi.stubEnv("OMNIVA_API_PASSWORD", "pass");
  vi.stubEnv("OMNIVA_CUSTOMER_CODE", "CUSTOMER");
  vi.stubEnv("OMNIVA_BASE_URL", baseUrl);
  vi.stubEnv("MERCHANT_SENDER_STREET", "Pihlaka tn 2");
  vi.stubEnv("MERCHANT_SENDER_CITY", "Jüri alevik");
  vi.stubEnv("MERCHANT_SENDER_POSTCODE", "75301");
  vi.stubEnv("MERCHANT_SENDER_COUNTRY", "EE");
  vi.stubEnv("MERCHANT_PHONE_NUMBER", "+37255550100");
  vi.stubEnv("MERCHANT_LEGAL_NAME", "Plepic Games OÜ");
  vi.stubEnv("MERCHANT_CONTACT_ADDRESS", "info@example.com");
}

interface FakeResponseState {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  sentBody: Buffer | undefined;
}

function fakeResponse(): { res: never; state: FakeResponseState } {
  const state: FakeResponseState = { statusCode: 200, headers: {}, jsonBody: undefined, sentBody: undefined };
  const res = {
    status: vi.fn((code: number) => {
      state.statusCode = code;
      return res;
    }),
    set: vi.fn((headers: Record<string, string>) => {
      Object.assign(state.headers, headers);
      return res;
    }),
    json: vi.fn((body: unknown) => {
      state.jsonBody = body;
      return res;
    }),
    send: vi.fn((body: Buffer) => {
      state.sentBody = body;
      return res;
    }),
  };
  return { res: res as never, state };
}

const FULFILLMENT_ID = "ful_01JABCDEFGHJKMNPQRSTVWXYZ";
const BARCODE = "CE123456789EE";

function fakeScope(fulfillmentModuleService: unknown, logger: { error: ReturnType<typeof vi.fn> }): { resolve: (key: string) => unknown } {
  return {
    resolve: (key: string) => {
      if (key === "logger") return logger;
      if (key === "fulfillment") return fulfillmentModuleService;
      throw new Error(`Unexpected container resolve: ${key}`);
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /admin/omniva/labels/:barcode", () => {
  it("serves a stored label as a downloadable PDF without calling Omniva", async () => {
    vi.unstubAllEnvs();
    const listFulfillments = vi.fn(async () => [{
      id: FULFILLMENT_ID,
      provider_id: OMNIVA_FULFILLMENT_PROVIDER_ID,
      data: { barcode: BARCODE, label_pdf_base64: "aGVsbG8=" },
    }]);
    const updateFulfillment = vi.fn();
    const logger = { error: vi.fn() };
    const { res, state } = fakeResponse();

    await GET(
      { params: { barcode: BARCODE }, scope: fakeScope({ listFulfillments, updateFulfillment }, logger) } as never,
      res,
    );

    expect(state.statusCode).toBe(200);
    expect(state.headers["Content-Type"]).toBe("application/pdf");
    expect(state.headers["Content-Disposition"]).toContain(BARCODE);
    expect(state.sentBody).toEqual(Buffer.from("aGVsbG8=", "base64"));
    expect(updateFulfillment).not.toHaveBeenCalled();
  });

  it("re-requests, stores, and serves a fresh label when none is stored", async () => {
    const omx = await stubOmxLabel({
      label: { successAddressCards: [{ barcode: BARCODE, filedata: "ZnJlc2g=" }] },
    });
    try {
      stubOmnivaEnv(omx.baseUrl);
      const listFulfillments = vi.fn(async () => [{
        id: FULFILLMENT_ID,
        provider_id: OMNIVA_FULFILLMENT_PROVIDER_ID,
        data: { barcode: BARCODE },
      }]);
      const updateFulfillment = vi.fn(async () => undefined);
      const logger = { error: vi.fn() };
      const { res, state } = fakeResponse();

      await GET(
        { params: { barcode: BARCODE }, scope: fakeScope({ listFulfillments, updateFulfillment }, logger) } as never,
        res,
      );

      expect(state.statusCode).toBe(200);
      expect(state.sentBody).toEqual(Buffer.from("ZnJlc2g=", "base64"));
      expect(updateFulfillment).toHaveBeenCalledWith(FULFILLMENT_ID, {
        data: { barcode: BARCODE, label_pdf_base64: "ZnJlc2g=" },
      });
    } finally {
      await omx.close();
    }
  });

  it("answers 404 for a barcode no fulfilment carries", async () => {
    vi.unstubAllEnvs();
    const listFulfillments = vi.fn(async () => []);
    const logger = { error: vi.fn() };
    const { res, state } = fakeResponse();

    await GET(
      { params: { barcode: BARCODE }, scope: fakeScope({ listFulfillments }, logger) } as never,
      res,
    );

    expect(state.statusCode).toBe(404);
    expect(state.jsonBody).toEqual({ message: expect.stringContaining(BARCODE) });
  });

  it("answers 404 for a fulfilment carrying this barcode that is not an Omniva one", async () => {
    vi.unstubAllEnvs();
    const listFulfillments = vi.fn(async () => [{
      id: FULFILLMENT_ID,
      provider_id: "manual_manual",
      data: { barcode: BARCODE },
    }]);
    const logger = { error: vi.fn() };
    const { res, state } = fakeResponse();

    await GET(
      { params: { barcode: BARCODE }, scope: fakeScope({ listFulfillments }, logger) } as never,
      res,
    );

    expect(state.statusCode).toBe(404);
  });

  it("answers 503 when Omniva is not configured and no label is stored", async () => {
    vi.unstubAllEnvs();
    const listFulfillments = vi.fn(async () => [{
      id: FULFILLMENT_ID,
      provider_id: OMNIVA_FULFILLMENT_PROVIDER_ID,
      data: { barcode: BARCODE },
    }]);
    const logger = { error: vi.fn() };
    const { res, state } = fakeResponse();

    await GET(
      { params: { barcode: BARCODE }, scope: fakeScope({ listFulfillments }, logger) } as never,
      res,
    );

    expect(state.statusCode).toBe(503);
  });

  it("answers 502 when Omniva refuses to re-issue the label", async () => {
    const omx = await stubOmxLabel({ label: { failedAddressCards: [{ barcode: BARCODE, messageCode: "nope" }] } });
    try {
      stubOmnivaEnv(omx.baseUrl);
      const listFulfillments = vi.fn(async () => [{
        id: FULFILLMENT_ID,
        provider_id: OMNIVA_FULFILLMENT_PROVIDER_ID,
        data: { barcode: BARCODE },
      }]);
      const updateFulfillment = vi.fn();
      const logger = { error: vi.fn() };
      const { res, state } = fakeResponse();

      await GET(
        { params: { barcode: BARCODE }, scope: fakeScope({ listFulfillments, updateFulfillment }, logger) } as never,
        res,
      );

      expect(state.statusCode).toBe(502);
      expect(updateFulfillment).not.toHaveBeenCalled();
    } finally {
      await omx.close();
    }
  });
});
