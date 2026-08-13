import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMedusaStoreClient } from "../src/lib/medusa-client.js";
import {
  completeStripeOrder,
  confirmAndCompleteStripeOrder,
  createSerialPaymentInitializer,
  initiateStripePayment,
  returnOrderDisclosure,
  stripeConfirmationForStatus,
  STRIPE_PROVIDER_ID,
} from "../src/lib/store-payment.js";

interface SeenRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

async function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("payment test server exposed no TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function client(origin: string) {
  return createMedusaStoreClient(
    { basePath: "/store-api", publishableKey: "pk_example_payment" },
    origin,
  );
}

describe("Stripe payment session Store operations", () => {
  const servers: Server[] = [];

  afterEach(async () => Promise.all(servers.map(close)));

  it("accepts only a complete authoritative cart for return-page order disclosure", () => {
    expect(returnOrderDisclosure({
      cart: {
        id: "cart_example",
        currency_code: "eur",
        item_total: 25,
        subtotal: 32,
        shipping_total: 7,
        total: 32,
        items: [{ title: "Lunar Base", quantity: 1 }],
        shipping_address: { first_name: "Ada", address_1: "Moon Street 1", postal_code: "10101", city: "Tallinn", country_code: "ee" },
        shipping_methods: [{ amount: 7, is_tax_inclusive: true, shipping_option_id: "so_standard" }],
      },
    }, "cart_example")).toEqual({
      currency: "EUR", goods: "Lunar Base × 1", goodsAmount: 2500, shippingAmount: 700,
      orderAmount: 3200, address: "Ada, Moon Street 1, 10101, Tallinn, EE",
    });
    expect(() => returnOrderDisclosure({
      cart: {
        id: "cart_example", currency_code: "eur", subtotal: 32,
        shipping_total: 7, total: 32, items: [{ title: "Lunar Base", quantity: 1 }],
        shipping_address: { first_name: "Ada", address_1: "Moon Street 1", postal_code: "10101", city: "Tallinn", country_code: "ee" },
        shipping_methods: [{ amount: 7, is_tax_inclusive: true, shipping_option_id: "so_standard" }],
      },
    }, "cart_example")).toThrow(/complete checkout disclosure/);
    expect(() => returnOrderDisclosure({ cart: { id: "cart_example" } }, "cart_example")).toThrow(/complete checkout disclosure/);
  });

  it("initiates the one maintained Stripe provider against the current cart total", async () => {
    const seen: SeenRequest[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const bodyText = Buffer.concat(chunks).toString("utf8");
        seen.push({
          method: request.method ?? "",
          path: request.url ?? "",
          body: bodyText === "" ? null : JSON.parse(bodyText),
        });
        response.setHeader("content-type", "application/json");
        if (request.url === "/store-api/store/carts/cart_example") {
          response.end(
            '{"cart":{"id":"cart_example","currency_code":"eur","total":32,"payment_collection":null}}',
          );
        } else if (request.url === "/store-api/store/payment-collections") {
          response.end('{"payment_collection":{"id":"paycol_example"}}');
        } else if (
          request.url ===
          "/store-api/store/payment-collections/paycol_example/payment-sessions"
        ) {
          response.end(
            '{"payment_collection":{"id":"paycol_example","currency_code":"eur","amount":32,"payment_sessions":[{"id":"payses_example","provider_id":"pp_stripe_stripe","status":"pending","amount":32,"currency_code":"eur","data":{"id":"pi_example","client_secret":"pi_example_secret_example"}}]}}',
          );
        } else {
          response.writeHead(404).end('{}');
        }
      });
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(
      initiateStripePayment(client(origin), "cart_example", {
        amount: 3200,
        currency: "EUR",
      }),
    ).resolves.toEqual({
      clientSecret: "pi_example_secret_example",
      paymentCollectionId: "paycol_example",
      paymentSessionId: "payses_example",
    });
    expect(STRIPE_PROVIDER_ID).toBe("pp_stripe_stripe");
    expect(seen).toEqual([
      { method: "GET", path: "/store-api/store/carts/cart_example", body: null },
      {
        method: "POST",
        path: "/store-api/store/payment-collections",
        body: { cart_id: "cart_example" },
      },
      {
        method: "POST",
        path: "/store-api/store/payment-collections/paycol_example/payment-sessions",
        body: { provider_id: "pp_stripe_stripe" },
      },
    ]);
  });

  it("refuses a payment session whose amount is stale or whose client secret is absent", async () => {
    const responses = [
      '{"payment_collection":{"id":"paycol_example","currency_code":"eur","amount":31,"payment_sessions":[{"id":"payses_example","provider_id":"pp_stripe_stripe","amount":31,"currency_code":"eur","data":{"client_secret":"pi_secret"}}]}}',
      '{"payment_collection":{"id":"paycol_example","currency_code":"eur","amount":32,"payment_sessions":[{"id":"payses_example","provider_id":"pp_stripe_stripe","amount":32,"currency_code":"eur","data":{}}]}}',
    ];
    for (const paymentResponse of responses) {
      const server = createServer((request, response) => {
        request.resume();
        request.on("end", () => {
          response.setHeader("content-type", "application/json");
          if (request.url === "/store-api/store/carts/cart_example") {
            response.end(
              '{"cart":{"id":"cart_example","currency_code":"eur","total":32,"payment_collection":{"id":"paycol_example"}}}',
            );
          } else {
            response.end(paymentResponse);
          }
        });
      });
      servers.push(server);
      const origin = await listen(server);

      await expect(
        initiateStripePayment(client(origin), "cart_example", {
          amount: 3200,
          currency: "EUR",
        }),
      ).rejects.toThrow(/malformed or stale Stripe payment session/);
      await close(server);
    }
  });

  it("accepts only Medusa's explicit order response as completion", async () => {
    const responses = [
      '{"type":"order","order":{"id":"order_example","display_id":42}}',
      '{"type":"cart","cart":{"id":"cart_example"},"error":{"message":"Payment is not authorized"}}',
    ];
    const outcomes: Array<Promise<unknown>> = [];
    for (const body of responses) {
      const server = createServer((request, response) => {
        request.resume();
        request.on("end", () => {
          response.setHeader("content-type", "application/json");
          response.end(body);
        });
      });
      servers.push(server);
      const origin = await listen(server);
      outcomes.push(completeStripeOrder(client(origin), "cart_example", "synthetic-checkout-token"));
    }

    await expect(outcomes[0]).resolves.toEqual({ orderId: "order_example", displayId: 42 });
    await expect(outcomes[1]).rejects.toThrow("Medusa did not place the order");
  });

  it("sends the bounded Turnstile token only in the cart completion request header", async () => {
    const seen: SeenRequest[] = [];
    const headers: string[] = [];
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        seen.push({ method: request.method ?? "", path: request.url ?? "", body: null });
        headers.push(String(request.headers["x-plepic-turnstile-token"] ?? ""));
        response.setHeader("content-type", "application/json");
        response.end('{"type":"order","order":{"id":"order_example","display_id":42}}');
      });
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(
      completeStripeOrder(client(origin), "cart_example", "synthetic-checkout-token"),
    ).resolves.toEqual({ orderId: "order_example", displayId: 42 });

    expect(seen).toEqual([{ method: "POST", path: "/store-api/store/carts/cart_example/complete", body: null }]);
    expect(headers).toEqual(["synthetic-checkout-token"]);
  });

  it("rejects missing and oversized completion tokens before calling Medusa", async () => {
    const complete = vi.fn();
    const storeClient = { store: { cart: { complete } } };

    for (const token of ["", "x".repeat(4097)] as const) {
      await expect(completeStripeOrder(storeClient as never, "cart_example", token)).rejects.toThrow(
        /verification challenge/i,
      );
    }
    expect(complete).not.toHaveBeenCalled();
  });

  it("never asks Medusa to complete when Stripe reports a confirmation error", async () => {
    let completions = 0;
    await expect(
      confirmAndCompleteStripeOrder(
        async () => ({ ok: false, pending: false, message: "The payment could not be confirmed" }),
        async () => {
          completions += 1;
          return { orderId: "order_should_not_exist", displayId: 99 };
        },
      ),
    ).rejects.toThrow("The payment could not be confirmed");
    expect(completions).toBe(0);
  });

  it("returns only the order Medusa creates after Stripe confirms", async () => {
    const sequence: string[] = [];
    await expect(
      confirmAndCompleteStripeOrder(
        async () => {
          sequence.push("stripe");
          return { ok: true };
        },
        async () => {
          sequence.push("medusa");
          return { orderId: "order_example", displayId: 42 };
        },
      ),
    ).resolves.toEqual({ orderId: "order_example", displayId: 42 });
    expect(sequence).toEqual(["stripe", "medusa"]);
  });

  it("serializes payment-session creation so PaymentIntents cannot race", async () => {
    const initialize = createSerialPaymentInitializer();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const first = initialize(async () => {
      events.push("first:start");
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      events.push("first:end");
      return "first";
    });
    const second = initialize(async () => {
      events.push("second:start");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("completes only a succeeded PaymentIntent and treats processing as pending", () => {
    expect(stripeConfirmationForStatus("succeeded")).toEqual({ ok: true });
    expect(stripeConfirmationForStatus("processing")).toMatchObject({ ok: false, pending: true });
    expect(stripeConfirmationForStatus("requires_capture")).toMatchObject({ ok: false, pending: false });
    expect(stripeConfirmationForStatus(undefined)).toMatchObject({ ok: false, pending: false });
  });

  it("makes exactly one redirect completion request per fresh Turnstile response", async () => {
    let attempts = 0;
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        attempts += 1;
        response.setHeader("content-type", "application/json");
        response.end(
          '{"type":"cart","cart":{"id":"cart_example"},"error":{"message":"Payment is processing"}}',
        );
      });
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(
      completeStripeOrder(client(origin), "cart_example", "synthetic-return-token"),
    ).rejects.toThrow("Medusa did not place the order");
    expect(attempts).toBe(1);
  });
});
