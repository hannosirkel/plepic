import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { createMedusaStoreClient } from "../src/lib/medusa-client.js";
import {
  addGuestShippingMethod,
  currentAddressTotals,
  prepareGuestShipping,
} from "../src/lib/store-checkout.js";

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
        reject(new Error("checkout test server exposed no TCP port"));
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

const address = {
  fullName: "Example Buyer",
  streetAddress: "1 Example Street",
  postalCode: "00000",
  city: "Example Town",
  country: "Estonia",
  email: "buyer@example.test",
};

describe("guest checkout Store operations", () => {
  const servers: Server[] = [];

  afterEach(async () => Promise.all(servers.map(close)));

  it("sends the approved guest fields only to the cart and returns literal available options", async () => {
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
          response.end('{"cart":{"id":"cart_example"}}');
        } else if (request.url === "/store-api/store/shipping-options?cart_id=cart_example") {
          response.end(
            '{"shipping_options":[{"id":"so_eu","name":"EU flat delivery","amount":700},{"id":"so_world","name":"Worldwide flat delivery","amount":1200}]}',
          );
        } else {
          response.writeHead(404).end('{}');
        }
      });
    });
    servers.push(server);
    const origin = await listen(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      origin,
    );

    const options = await prepareGuestShipping(client, "cart_example", address);

    expect(options).toEqual([
      { id: "so_eu", name: "EU flat delivery", amount: 700 },
      { id: "so_world", name: "Worldwide flat delivery", amount: 1200 },
    ]);
    expect(seen).toEqual([
      {
        method: "POST",
        path: "/store-api/store/carts/cart_example",
        body: {
          email: "buyer@example.test",
          shipping_address: {
            first_name: "Example Buyer",
            address_1: "1 Example Street",
            postal_code: "00000",
            city: "Example Town",
            country_code: "ee",
          },
          billing_address: {
            first_name: "Example Buyer",
            address_1: "1 Example Street",
            postal_code: "00000",
            city: "Example Town",
            country_code: "ee",
          },
        },
      },
      {
        method: "GET",
        path: "/store-api/store/shipping-options?cart_id=cart_example",
        body: null,
      },
    ]);
  });

  it("adds only the chosen option and returns Medusa-calculated totals", async () => {
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
        response.end(
          '{"cart":{"id":"cart_example","currency_code":"eur","subtotal":2500,"shipping_total":700,"total":3200}}',
        );
      });
    });
    servers.push(server);
    const origin = await listen(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      origin,
    );

    const totals = await addGuestShippingMethod(client, "cart_example", "so_eu");

    expect(totals).toEqual({ currency: "EUR", goodsAmount: 2500, shippingAmount: 700, orderAmount: 3200 });
    expect(seen).toEqual([
      {
        method: "POST",
        path: "/store-api/store/carts/cart_example/shipping-methods",
        body: { option_id: "so_eu" },
      },
    ]);
  });

  it("accepts a literal zero-priced free shipping option", async () => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        if (request.url === "/store-api/store/carts/cart_example") {
          response.end('{"cart":{"id":"cart_example"}}');
        } else {
          response.end(
            '{"shipping_options":[{"id":"so_free","name":"Free delivery","amount":0}]}',
          );
        }
      });
    });
    servers.push(server);
    const origin = await listen(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      origin,
    );

    await expect(prepareGuestShipping(client, "cart_example", address)).resolves.toEqual([
      { id: "so_free", name: "Free delivery", amount: 0 },
    ]);
  });
});

describe("checkout shipping option address binding", () => {
  it("withholds authoritative totals once the completed address changes", () => {
    const totals = { currency: "EUR", goodsAmount: 2500, shippingAmount: 700, orderAmount: 3200 };
    expect(currentAddressTotals({ addressRevision: "address-a", totals }, "address-a")).toEqual(totals);
    expect(currentAddressTotals({ addressRevision: "address-a", totals }, "address-b")).toBeNull();
  });
  it("refuses the stale-option window when a complete address revision begins", () => {
    // This is a source-level contract because the storefront unit suite is
    // Node-only. It pins both defences: render-time disabling for the effect
    // gap and handler refusal for a queued stale change event.
    const source = readFileSync(
      fileURLToPath(new URL("../src/components/shop/CheckoutPageContent.tsx", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("shippingOptionsAddress !== addressRevision");
    expect(source).toContain(
      "if (shippingOptionsAddress !== addressRevision || addressRevision === null) return;",
    );
    expect(source).toContain("setShippingOptions([]);");
    expect(source).toContain("setSelectedShippingOption(\"\");");
  });

  it("invalidates displayed shipping state before checking whether the cart id still exists", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../src/components/shop/CheckoutPageContent.tsx", import.meta.url)),
      "utf8",
    );
    const effect = source.slice(source.indexOf("useEffect(() =>"), source.indexOf("function selectShippingOption"));

    expect(effect.indexOf("setShippingOptions([]);")).toBeLessThan(
      effect.indexOf("const cartId = storedMedusaCartId();"),
    );
    expect(effect.indexOf("++shippingRequest.current")).toBeLessThan(
      effect.indexOf("const cartId = storedMedusaCartId();"),
    );
  });
});
