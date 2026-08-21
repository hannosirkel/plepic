import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createMedusaStoreClient } from "../src/lib/medusa-client.js";
import { addGuestShippingMethod, prepareGuestShipping } from "../src/lib/store-checkout.js";
import { completeStripeOrder, initiateStripePayment } from "../src/lib/store-payment.js";

/**
 * Guest checkout, as the whole sequence rather than as one of its steps.
 *
 * The plan ships no customer accounts at launch, so every order is a guest
 * order — and the evidence for that was split in half and never joined.
 * `store-checkout.test.ts` proves the cart update carries `email` and the two
 * addresses and nothing else; `store-payment.test.ts` proves the completion
 * accepts only an explicit order response. Neither says a buyer with no
 * account can get from one to the other, and "there is no login page" is an
 * observation about today's routes, not a test.
 *
 * So this drives all four Store operations a guest performs, in order, against
 * one recording server, and then asserts the property over **every** request
 * the sequence made: an order came back, and nothing anywhere in the exchange
 * identified a customer. That second half is the one that fails if a future
 * unit starts attaching a `customer_id`, sends an `Authorization` header, or
 * requires a session before completion — each of which would turn guest
 * checkout off without breaking a single existing assertion.
 */

interface SeenRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
}

const address = {
  fullName: "Example Buyer",
  streetAddress: "1 Example Street",
  postalCode: "00000",
  city: "Example Town",
  country: "Estonia",
  email: "buyer@example.test",
};

const CART_ID = "cart_guest_example";

function respond(path: string): string | null {
  if (path === `/store-api/store/carts/${CART_ID}`) {
    return JSON.stringify({
      cart: {
        id: CART_ID,
        currency_code: "eur",
        total: 39.68,
        items: [
          {
            variant_id: "variant_lunar_base",
            title: "Lunar Base",
            quantity: 1,
            unit_price: 25,
          },
        ],
        payment_collection: {
          id: "paycol_example",
          payment_sessions: [
            {
              id: "payses_example",
              provider_id: "pp_stripe_stripe",
              amount: 39.68,
              currency_code: "eur",
              data: { client_secret: "pi_example_secret" },
            },
          ],
        },
      },
    });
  }
  if (path === `/store-api/store/shipping-options?cart_id=${CART_ID}`) {
    return JSON.stringify({
      shipping_options: [{
        id: "so_eu",
        name: "EU flat delivery",
        amount: 7,
        // A flat-rate option carries the tax-inclusivity flag and no with-tax
        // amount — see `tests/store-checkout.test.ts` for the verification.
        calculated_price: { calculated_amount: 7, is_calculated_price_tax_inclusive: false },
      }],
    });
  }
  if (path === `/store-api/store/carts/${CART_ID}/shipping-methods`) {
    return JSON.stringify({
      cart: {
        id: CART_ID,
        currency_code: "eur",
        item_total: 31,
        item_tax_total: 6,
        shipping_total: 8.68,
        shipping_tax_total: 1.68,
        tax_total: 7.68,
        total: 39.68,
      },
    });
  }
  if (path === `/store-api/store/carts/${CART_ID}/stripe-payment-session`) {
    return JSON.stringify({
      payment_collection: {
        id: "paycol_example",
        amount: 39.68,
        currency_code: "eur",
        payment_sessions: [
          {
            id: "payses_example",
            provider_id: "pp_stripe_stripe",
            amount: 39.68,
            currency_code: "eur",
            data: { client_secret: "pi_example_secret" },
          },
        ],
      },
    });
  }
  if (path === `/store-api/store/carts/${CART_ID}/complete`) {
    return JSON.stringify({ type: "order", order: { id: "order_example", display_id: 1042 } });
  }
  return null;
}

async function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const found = server.address();
      if (found === null || typeof found === "string") {
        reject(new Error("guest checkout test server exposed no TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${found.port}`);
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe("a buyer with no account can complete an order", () => {
  const servers: Server[] = [];

  afterEach(async () => Promise.all(servers.map(close)));

  async function runGuestSequence(): Promise<{ seen: SeenRequest[]; orderId: string; displayId: number }> {
    const seen: SeenRequest[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        seen.push({
          method: request.method ?? "",
          path: request.url ?? "",
          headers: request.headers,
          body: text === "" ? null : JSON.parse(text),
        });
        const payload = respond(request.url ?? "");
        response.setHeader("content-type", "application/json");
        if (payload === null) response.writeHead(404).end("{}");
        else response.end(payload);
      });
    });
    servers.push(server);

    const origin = await listen(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_guest" },
      origin,
    );

    const options = await prepareGuestShipping(client, CART_ID, address);
    expect(options.map((option) => option.id)).toEqual(["so_eu"]);

    await addGuestShippingMethod(
      client,
      CART_ID,
      { id: "so_eu", name: "EU flat delivery", amount: 700, amountWithTax: null, taxInclusive: false },
      true,
    );
    const session = await initiateStripePayment(client, CART_ID, { amount: 3968, currency: "EUR" });
    expect(session.clientSecret).toBe("pi_example_secret");

    const order = await completeStripeOrder(client, CART_ID, "a-turnstile-token");
    return { seen, ...order };
  }

  it("gets from an empty address form to a placed order with an email address and nothing more", async () => {
    const { orderId, displayId, seen } = await runGuestSequence();

    expect(orderId).toBe("order_example");
    expect(displayId).toBe(1042);

    // The whole exchange happened, rather than one call short-circuiting.
    expect(seen.map((request) => `${request.method} ${request.path.split("?")[0] ?? ""}`)).toContain(
      `POST /store-api/store/carts/${CART_ID}/complete`,
    );

    // The only identity anywhere in it is the email on the cart.
    const identified = seen.filter((request) =>
      JSON.stringify(request.body ?? {}).includes("buyer@example.test"),
    );
    expect(identified).toHaveLength(1);
    expect(identified[0]?.path).toBe(`/store-api/store/carts/${CART_ID}`);
  });

  it("sends no credential and claims no customer on any request in the sequence", async () => {
    const { seen } = await runGuestSequence();
    expect(seen.length).toBeGreaterThan(3);

    for (const request of seen) {
      expect(request.headers.authorization, `${request.path} carried an Authorization header`).toBeUndefined();

      const body = JSON.stringify(request.body ?? {});
      for (const field of ["customer_id", "customer\"", "password", "account", "login", "auth_identity"]) {
        expect(body.includes(field), `${request.path} sent ${field}`).toBe(false);
      }
    }
  });

  /**
   * The publishable key is the only credential a guest checkout uses, and it
   * is a public one delivered at runtime. Asserted here so "no credential"
   * above is understood to mean no *secret*, not "no headers at all".
   */
  it("authenticates the Store calls with the runtime publishable key alone", async () => {
    const { seen } = await runGuestSequence();

    for (const request of seen) {
      expect(request.headers["x-publishable-api-key"], request.path).toBe("pk_example_guest");
    }
  });
});
