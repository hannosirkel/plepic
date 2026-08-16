import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { createMedusaStoreClient } from "../src/lib/medusa-client.js";
import {
  addGuestShippingMethod,
  currentAddressTotals,
  prepareGuestShipping,
  type GuestCheckoutAddress,
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
            '{"shipping_options":[{"id":"so_eu","name":"EU flat delivery","amount":7},{"id":"so_world","name":"Worldwide flat delivery","amount":12}]}',
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
        /*
         * `item_total`, not `subtotal`. Under the commerce configuration that
         * landed the advertised price is tax inclusive and the destination's tax
         * region is applied automatically, so Medusa's `subtotal` is
         * `item_subtotal + shipping_subtotal` **excluding** tax — 26.23 for this
         * cart into Estonia, which is neither the EUR 25.00 the product page
         * advertises nor consistent with the 32.00 total beside it. The figures
         * below are the ones Medusa actually returns for that cart.
         */
        response.end(
          '{"cart":{"id":"cart_example","currency_code":"eur","item_total":25,' +
            '"item_subtotal":20.491803278688526,"shipping_total":7,' +
            '"shipping_subtotal":5.737704918032787,"subtotal":26.229508196721312,' +
            '"tax_total":5.770491803278688,"total":32}}',
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
    expect(source).toContain("attemptInFlight.current ||");
    expect(source).toContain("addressRevision === null");
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

  it("reports a real payment failure even when optional item analytics metadata is unavailable", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../src/components/shop/CheckoutPageContent.tsx", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf("(stage) => {");
    const callback = source.slice(start, source.indexOf("},", start));

    expect(start, "payment failure callback was not found").toBeGreaterThan(0);
    expect(callback).toContain("if (totals.orderAmount === null) return;");
    expect(callback).not.toContain("analyticsItems");
    expect(callback).toContain("emitPaymentFailure({");
  });
});

/**
 * **The exact total presented before payment, for three real delivery addresses.**
 *
 * The row this closes says to test "an included country, an excluded one, and a
 * non-EU one, asserting the exact total presented before payment".
 *
 * **No country is excluded.** The operator's decision is worldwide delivery with
 * two flat rates and no exclusions, so the middle case is stated as an absence
 * rather than deleted: the nearest thing the model has to an excluded address is
 * one inside the European Union that is not in an EU *member state*, and it is
 * served at the rest-of-world rate rather than refused. The backend holds the
 * same three cases against Medusa's own totals arithmetic in
 * `backend/tests/commerce-medusa-semantics.test.ts`; this holds them against the
 * code path that actually produces the figures the Article 8(2) disclosure block
 * renders.
 *
 * The Medusa stub answers exactly what a correctly configured Medusa answers:
 * tax-inclusive line and shipping totals, a tax-exclusive `subtotal` that is
 * neither of them, and a `total` that is the two inclusive figures summed.
 */
describe("the exact total presented before payment", () => {
  const servers: Server[] = [];

  afterEach(async () => Promise.all(servers.map(close)));

  /** EUR 25.00 including VAT — `storefront/mock/catalogue.json`. */
  const GOODS_MAJOR = 25;
  const VAT_RATE = 0.22;

  interface AddressCase {
    readonly label: string;
    readonly address: GuestCheckoutAddress;
    readonly optionId: string;
    readonly shippingMajor: number;
    readonly expected: {
      readonly goodsAmount: number;
      readonly shippingAmount: number;
      readonly orderAmount: number;
    };
  }

  const cases: readonly AddressCase[] = [
    {
      // An included country: an EU member state.
      label: "Estonia, an EU member state",
      address: {
        fullName: "Example Buyer",
        streetAddress: "Narva maantee 5",
        postalCode: "10117",
        city: "Tallinn",
        country: "Estonia",
        email: "buyer@example.test",
      },
      optionId: "so_eu",
      shippingMajor: 7,
      expected: { goodsAmount: 2500, shippingAmount: 700, orderAmount: 3200 },
    },
    {
      // NOT an excluded country — none is. French Guiana is a delivery address
      // in the European Union that is not in an EU member state, so it is
      // served at the rest-of-world rate.
      label: "French Guiana, in the EU but not a member state",
      address: {
        fullName: "Example Buyer",
        streetAddress: "Avenue du General de Gaulle 12",
        postalCode: "97300",
        city: "Cayenne",
        country: "French Guiana",
        email: "buyer@example.test",
      },
      optionId: "so_world",
      shippingMajor: 12,
      expected: { goodsAmount: 2500, shippingAmount: 1200, orderAmount: 3700 },
    },
    {
      // A non-EU country.
      label: "the United States",
      address: {
        fullName: "Example Buyer",
        streetAddress: "500 Example Avenue",
        postalCode: "10018",
        city: "New York",
        country: "United States",
        email: "buyer@example.test",
      },
      optionId: "so_world",
      shippingMajor: 12,
      expected: { goodsAmount: 2500, shippingAmount: 1200, orderAmount: 3700 },
    },
  ];

  /** A Medusa that prices the cart the way the declared configuration makes it. */
  async function medusaPricing(shippingMajor: number): Promise<string> {
    const net = (inclusive: number) => inclusive / (1 + VAT_RATE);
    const body = JSON.stringify({
      cart: {
        id: "cart_example",
        currency_code: "eur",
        item_total: GOODS_MAJOR,
        item_subtotal: net(GOODS_MAJOR),
        shipping_total: shippingMajor,
        shipping_subtotal: net(shippingMajor),
        subtotal: net(GOODS_MAJOR) + net(shippingMajor),
        tax_total: GOODS_MAJOR + shippingMajor - net(GOODS_MAJOR) - net(shippingMajor),
        total: GOODS_MAJOR + shippingMajor,
      },
    });
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(body);
      });
    });
    servers.push(server);
    return listen(server);
  }

  it.each(cases)(
    "charges $label the frozen rate and states three figures that add up",
    async ({ optionId, shippingMajor, expected }) => {
      const origin = await medusaPricing(shippingMajor);
      const client = createMedusaStoreClient(
        { basePath: "/store-api", publishableKey: "pk_example_checkout" },
        origin,
      );

      const totals = await addGuestShippingMethod(client, "cart_example", optionId);

      expect(totals).toEqual({ currency: "EUR", ...expected });
      expect(expected.goodsAmount + expected.shippingAmount).toBe(expected.orderAmount);
    },
  );

  it("shows the same price of the goods the product page advertises, in every zone", async () => {
    for (const { shippingMajor } of cases) {
      const origin = await medusaPricing(shippingMajor);
      const client = createMedusaStoreClient(
        { basePath: "/store-api", publishableKey: "pk_example_checkout" },
        origin,
      );
      const totals = await addGuestShippingMethod(client, "cart_example", "so_any");
      // `content/legal/shipping.ts`: "the same figure for every visitor, in
      // every country, and it does not change according to where you are or
      // where you ask us to send the parcel".
      expect(totals.goodsAmount).toBe(2500);
    }
  });

  it("offers a zone for every one of the three addresses rather than refusing one", async () => {
    for (const { address, optionId, shippingMajor } of cases) {
      const seen: SeenRequest[] = [];
      const optionBody = JSON.stringify({
        shipping_options: [
          { id: optionId, name: "Standard delivery", amount: shippingMajor },
        ],
      });
      const server = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          seen.push({
            method: request.method ?? "",
            path: request.url ?? "",
            body: text === "" ? null : JSON.parse(text),
          });
          response.setHeader("content-type", "application/json");
          response.end(
            request.url?.startsWith("/store-api/store/shipping-options")
              ? optionBody
              : '{"cart":{"id":"cart_example"}}',
          );
        });
      });
      servers.push(server);
      const client = createMedusaStoreClient(
        { basePath: "/store-api", publishableKey: "pk_example_checkout" },
        await listen(server),
      );

      const options = await prepareGuestShipping(client, "cart_example", address);

      expect(options, address.country).toEqual([
        { id: optionId, name: "Standard delivery", amount: shippingMajor * 100 },
      ]);
      expect(seen[0]?.body, address.country).toMatchObject({
        shipping_address: { country_code: expect.any(String) },
      });
    }
  });

  /**
   * Three figures on one screen, immediately above the order button. A goods
   * figure and a shipping figure that do not sum to the total the buyer is asked
   * to accept is a false statement, and Article 8(2) CRD is a disclosure
   * obligation — so an inconsistent set is refused rather than rendered.
   */
  it("refuses totals that do not add up rather than putting them on the screen", async () => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(
          '{"cart":{"id":"cart_example","currency_code":"eur","item_total":25,' +
            '"shipping_total":7,"total":33}}',
        );
      });
    });
    servers.push(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      await listen(server),
    );

    await expect(addGuestShippingMethod(client, "cart_example", "so_eu")).rejects.toThrow(
      /do not add up/,
    );
  });
});
