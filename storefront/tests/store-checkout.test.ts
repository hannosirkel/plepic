import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { createMedusaStoreClient } from "../src/lib/medusa-client.js";
import {
  addGuestShippingMethod,
  currentAddressTotals,
  defaultShippingOptionId,
  PARCEL_MACHINE_OPTION_NAME,
  phoneRequiredForCountry,
  prepareGuestShipping,
  shippingOptionFigure,
  NET_SHIPPING_SUFFIX,
  type GuestCheckoutAddress,
  type GuestShippingOption,
} from "../src/lib/store-checkout.js";
import { formatAmount, zoneForCountryName, SHIPPING_ZONES } from "../src/lib/cart.js";
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { destinationForCountryName } from "../src/lib/destination.js";

/**
 * A shipping option as Medusa answers `GET /store/shipping-options` for a
 * flat-rate option under net pricing.
 *
 * `calculated_price` carries the tax-inclusivity flag and **no**
 * `calculated_amount_with_tax`: verified against the installed packages, the
 * only writers of that field are the Store *product* helpers, and
 * `listShippingOptionsForCartWorkflow` sets nothing equivalent for shipping.
 * The fixture says so, so the "+ VAT" branch under test is the branch that
 * actually runs in production.
 */
const option = (id: string, name: string, amountMajor: number) => ({
  id,
  name,
  amount: amountMajor,
  calculated_price: {
    calculated_amount: amountMajor,
    is_calculated_price_tax_inclusive: false,
  },
});

const parsedOption = (id: string, name: string, amountMinor: number): GuestShippingOption => ({
  id,
  name,
  amount: amountMinor,
  amountWithTax: null,
  taxInclusive: false,
});

/**
 * A Medusa stub for the one method `addGuestShippingMethod` calls on a
 * client — `store.cart.addShippingMethod` — that answers with exactly the
 * cart fixture given, wrapped the way a Store response is.
 *
 * No HTTP server: the case this exists for (a free method's totals, and the
 * shown-versus-charged guard over a zero) does not need the request itself
 * inspected, only the response `addGuestShippingMethod` is handed. The other
 * tests in this file, which do assert on the request, use a real server —
 * see `listen`/`close` above.
 */
function clientAddingShippingMethod(fixture: {
  readonly cart: Record<string, unknown>;
}): Parameters<typeof addGuestShippingMethod>[0] {
  return {
    store: { cart: { addShippingMethod: async () => fixture } },
  } as unknown as Parameters<typeof addGuestShippingMethod>[0];
}

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

const address: GuestCheckoutAddress = {
  fullName: "Example Buyer",
  streetAddress: "1 Example Street",
  postalCode: "00000",
  city: "Example Town",
  country: "Estonia",
  email: "buyer@example.test",
  // Estonia is one of the four OMX does not require a phone for — see
  // `phoneRequiredForCountry` below — so "" is a legitimate value here, not
  // an oversight.
  phone: "",
};

/** A destination OMX *does* require a phone number for. */
const GERMAN_ADDRESS: GuestCheckoutAddress = {
  fullName: "Example Buyer",
  streetAddress: "Unter den Linden 1",
  postalCode: "10117",
  city: "Berlin",
  country: "Germany",
  email: "buyer@example.test",
  phone: "",
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
            JSON.stringify({
              shipping_options: [
                option("so_eu", "EU flat delivery", 7),
                option("so_world", "Worldwide flat delivery", 12),
              ],
            }),
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
      parsedOption("so_eu", "EU flat delivery", 700),
      parsedOption("so_world", "Worldwide flat delivery", 1200),
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
            phone: "",
          },
          billing_address: {
            first_name: "Example Buyer",
            address_1: "1 Example Street",
            postal_code: "00000",
            city: "Example Town",
            country_code: "ee",
            phone: "",
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

  /**
   * `phone` reaches **both** Medusa addresses, unconditionally, the same way
   * `prepareGuestShipping` already sends every other field to both — see
   * `addressPayload`'s doc comment for why *whether* the field was required
   * is not this function's decision.
   */
  it("sends the phone number to Medusa when one is given", async () => {
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
        if (request.url === "/store-api/store/carts/cart_1") {
          response.end('{"cart":{"id":"cart_1"}}');
        } else {
          response.end(
            JSON.stringify({ shipping_options: [option("so_eu", "Standard delivery", 7)] }),
          );
        }
      });
    });
    servers.push(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      await listen(server),
    );

    await prepareGuestShipping(client, "cart_1", { ...GERMAN_ADDRESS, phone: "+49 30 1234567" });

    const updateRequest = seen.find((request) => request.method === "POST");
    expect(updateRequest?.body).toMatchObject({
      shipping_address: { phone: "+49 30 1234567" },
      billing_address: { phone: "+49 30 1234567" },
    });
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
         * `item_total`, not `subtotal`. Prices are stored net and the
         * destination's tax region is applied automatically, so Medusa's
         * `subtotal` is `item_subtotal + shipping_subtotal` **excluding** tax —
         * 32.00 for this cart into Estonia, which is neither the figure the
         * product page quotes a European visitor nor consistent with the 39.68
         * total beside it. The figures below are the ones Medusa actually
         * returns for that cart.
         */
        response.end(
          '{"cart":{"id":"cart_example","currency_code":"eur","item_total":31,' +
            '"item_subtotal":25,"item_tax_total":6,"shipping_total":8.68,' +
            '"shipping_subtotal":7,"shipping_tax_total":1.68,"subtotal":32,' +
            '"tax_total":7.68,"total":39.68}}',
        );
      });
    });
    servers.push(server);
    const origin = await listen(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      origin,
    );

    const totals = await addGuestShippingMethod(
      client,
      "cart_example",
      { ...parsedOption("so_eu", "EU flat delivery", 700), amountWithTax: 868 },
      true,
    );

    expect(totals).toEqual({
      currency: "EUR",
      // Net since 2026-08-29 — see `assertedCartTotals`'s doc comment. Medusa
      // charged 31.00/8.68 (gross); this is 25.00/7.00, with the 7.68 of tax
      // now an addend rather than contained in the two above.
      goodsAmount: 2500,
      shippingAmount: 700,
      orderAmount: 3968,
      taxAmount: 768,
      shippingTaxAmount: 168,
      goodsTaxAmount: 600,
    });
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
            JSON.stringify({ shipping_options: [option("so_free", "Free delivery", 0)] }),
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
      parsedOption("so_free", "Free delivery", 0),
    ]);
  });

  /**
   * **A delivery option must say whether its price contains the tax.**
   *
   * Without the flag there is no way to tell the net rate from the gross one,
   * and rendering the wrong one is exactly the defect this read replaces: the
   * `<select>` showed the stored figure while the summary beside it showed the
   * grossed one. A missing flag is a malformed option, not a default.
   */
  it("refuses a shipping option that does not say whether its price contains tax", async () => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(
          request.url === "/store-api/store/carts/cart_example"
            ? '{"cart":{"id":"cart_example"}}'
            : '{"shipping_options":[{"id":"so_eu","name":"EU flat delivery","amount":7}]}',
        );
      });
    });
    servers.push(server);
    const client = createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      await listen(server),
    );

    await expect(prepareGuestShipping(client, "cart_example", address)).rejects.toThrow(
      /contains tax/,
    );
  });

  it("charges nothing for the free method, and still refuses a mismatch", async () => {
    const client = clientAddingShippingMethod({
      cart: {
        currency_code: "eur", item_total: 30.5, item_tax_total: 5.9,
        shipping_total: 0, shipping_tax_total: 0, tax_total: 5.9, total: 30.5,
      },
    });
    // A zip travels with the parcel machine method: `isParcelMachineOption`
    // matches this option by name, and `addGuestShippingMethod` refuses one
    // with none — see the "refuses to add the parcel machine method with no
    // machine chosen" case below for that guard on its own.
    const totals = await addGuestShippingMethod(
      client, "cart_1",
      { id: "so_free", name: "Omniva parcel machine", amount: 0, amountWithTax: null, taxInclusive: false },
      true,
      "10111",
    );
    expect(totals.shippingAmount).toBe(0);
  });

  it("refuses to add the parcel machine method with no machine chosen", async () => {
    const client = clientAddingShippingMethod({
      cart: {
        currency_code: "eur", item_total: 30.5, item_tax_total: 5.9,
        shipping_total: 0, shipping_tax_total: 0, tax_total: 5.9, total: 30.5,
      },
    });
    await expect(
      addGuestShippingMethod(
        client, "cart_1",
        { id: "so_free", name: "Omniva parcel machine", amount: 0, amountWithTax: null, taxInclusive: false },
        true,
      ),
    ).rejects.toThrow(/Choose an Omniva parcel machine/);
  });
});

/**
 * OMX makes a receiver phone mandatory whenever the destination is not
 * Estonia, Latvia, Lithuania or Finland. Inside those four the buyer's email
 * satisfies it, so the field is not asked for — a required field nobody's
 * carrier needs is friction that costs orders.
 */
describe("where OMX requires a phone number", () => {
  it("requires a phone number only where Omniva requires one", () => {
    for (const code of ["EE", "LV", "LT", "FI"]) {
      expect(phoneRequiredForCountry(code), code).toBe(false);
    }
    for (const code of ["DE", "US", "AU", "GB"]) {
      expect(phoneRequiredForCountry(code), code).toBe(true);
    }
  });

  it("is case-insensitive and trims, because a code may arrive either way", () => {
    expect(phoneRequiredForCountry("ee")).toBe(false);
    expect(phoneRequiredForCountry(" ee ")).toBe(false);
    expect(phoneRequiredForCountry("de")).toBe(true);
  });

  it("never excuses an unrecognised or empty code from the phone number", () => {
    expect(phoneRequiredForCountry("")).toBe(true);
    expect(phoneRequiredForCountry("ZZ")).toBe(true);
  });
});

/**
 * What a delivery option may be **shown** as.
 *
 * The finding this encodes: a flat-rate option carries no with-tax amount
 * before the method is added, so the middle branch is the one that runs. A bare
 * net rate is never acceptable inside the EU, and a marked one is never
 * acceptable outside it — marking it would promise a tax that is never added.
 */
describe("the figure a delivery option is shown as", () => {
  const net = parsedOption("so_eu", "Standard delivery", 700);

  it("marks a net rate explicitly when VAT will be added to it", () => {
    const figure = shippingOptionFigure(net, true);
    expect(figure.label).toBe("€7.00 + VAT");
    expect(figure.final).toBe(false);
    expect(figure.amount).toBe(700);
  });

  it("shows a net rate bare when no VAT is due, because then it is the whole charge", () => {
    const figure = shippingOptionFigure(net, false);
    expect(figure.label).toBe("€7.00");
    expect(figure.final).toBe(true);
  });

  it("prefers Medusa's with-tax amount whenever Medusa supplies one", () => {
    const figure = shippingOptionFigure({ ...net, amountWithTax: 868 }, true);
    expect(figure.label).toBe("€8.68");
    expect(figure.final).toBe(true);
    expect(figure.amount).toBe(868);
  });

  it("never renders a bare figure for a net rate inside the EU", () => {
    expect(shippingOptionFigure(net, true).label).not.toBe("€7.00");
  });

  it("renders a free method as Free, never as a net rate awaiting VAT", () => {
    const free = {
      id: "so_free", name: "Omniva parcel machine",
      amount: 0, amountWithTax: null, taxInclusive: false,
    } as const;

    // Inside the EU, where every other net figure gains a "+ VAT" marker.
    const shown = shippingOptionFigure(free, true);
    expect(shown.label).toBe("Free");
    expect(shown.amount).toBe(0);
    expect(shown.final).toBe(true);
    expect(shown.label).not.toContain(NET_SHIPPING_SUFFIX);

    // And outside it, where the marker never applied anyway.
    expect(shippingOptionFigure(free, false).label).toBe("Free");
  });

  /**
   * The VAT hazard this design exists beside: EE, LV and LT buy delivery from
   * their own service zone and are still EU member states for tax. If
   * `ShippingZone` ever gained a third member, this goes red.
   */
  it("still treats an Estonian address as EU for VAT", () => {
    expect(zoneForCountryName("Estonia")).toBe("europeanUnion");
    expect(zoneForCountryName("Latvia")).toBe("europeanUnion");
    expect(zoneForCountryName("Lithuania")).toBe("europeanUnion");
    expect(SHIPPING_ZONES).toEqual(["europeanUnion", "restOfWorld"]);
  });
});

describe("checkout shipping option address binding", () => {
  it("withholds authoritative totals once the completed address changes", () => {
    const totals = {
      currency: "EUR",
      goodsAmount: 3100,
      shippingAmount: 868,
      orderAmount: 3968,
      taxAmount: 768,
      shippingTaxAmount: 168,
      goodsTaxAmount: 600,
    };
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
 * served at the rest-of-world rate — and, since the tax model charges VAT to the
 * 27 member states and nothing wider, at no VAT either. The backend holds the
 * same three cases against Medusa's own totals arithmetic in
 * `backend/tests/commerce-medusa-semantics.test.ts`; this holds them against the
 * code path that actually produces the figures the Article 8(2) disclosure block
 * renders.
 *
 * The Medusa stub answers exactly what a correctly configured Medusa answers for
 * a **net**-priced catalogue: tax-inclusive line and shipping totals, a
 * tax-exclusive `subtotal` that is neither of them, the three tax fields, and a
 * `total` that is the two inclusive figures summed.
 */
describe("the exact total presented before payment", () => {
  const servers: Server[] = [];

  afterEach(async () => Promise.all(servers.map(close)));

  interface AddressCase {
    readonly label: string;
    readonly address: GuestCheckoutAddress;
    readonly optionId: string;
    /** The declared rate, before tax. */
    readonly shippingNetMajor: number;
    /** True when the destination is an EU member state. */
    readonly vatApplies: boolean;
    readonly expected: {
      readonly goodsAmount: number;
      readonly shippingAmount: number;
      readonly orderAmount: number;
      readonly taxAmount: number;
      readonly shippingTaxAmount: number;
      readonly goodsTaxAmount: number;
    };
  }

  const cases: readonly AddressCase[] = [
    {
      // An included country: an EU member state. VAT is added to the goods and
      // to the delivery alike.
      label: "Estonia, an EU member state",
      address: {
        fullName: "Example Buyer",
        streetAddress: "Narva maantee 5",
        postalCode: "10117",
        city: "Tallinn",
        country: "Estonia",
        email: "buyer@example.test",
        // One of the four OMX does not require a phone for.
        phone: "",
      },
      optionId: "so_eu",
      shippingNetMajor: 7,
      vatApplies: true,
      // Net since 2026-08-29 (25.00/7.00, was 31.00/8.68 gross) — the two
      // non-EU cases below are unaffected, because net equals gross wherever
      // no VAT applies.
      expected: {
        goodsAmount: 2500,
        shippingAmount: 700,
        orderAmount: 3968,
        taxAmount: 768,
        shippingTaxAmount: 168,
        goodsTaxAmount: 600,
      },
    },
    {
      // NOT an excluded country — none is. French Guiana is a delivery address
      // in the European Union that is not in an EU member state, so it is
      // served at the rest-of-world rate and charged no EU VAT.
      label: "French Guiana, in the EU but not a member state",
      address: {
        fullName: "Example Buyer",
        streetAddress: "Avenue du General de Gaulle 12",
        postalCode: "97300",
        city: "Cayenne",
        country: "French Guiana",
        email: "buyer@example.test",
        // Not one of the four: OMX requires a phone number here.
        phone: "+594 594 00 00 00",
      },
      optionId: "so_world",
      shippingNetMajor: 12,
      vatApplies: false,
      expected: {
        goodsAmount: 2500,
        shippingAmount: 1200,
        orderAmount: 3700,
        taxAmount: 0,
        shippingTaxAmount: 0,
        goodsTaxAmount: 0,
      },
    },
    {
      // A non-EU country, and the operator's default destination.
      label: "the United States",
      address: {
        fullName: "Example Buyer",
        streetAddress: "500 Example Avenue",
        postalCode: "10018",
        city: "New York",
        country: "United States",
        email: "buyer@example.test",
        // Not one of the four: OMX requires a phone number here.
        phone: "+1 212 555 0100",
      },
      optionId: "so_world",
      shippingNetMajor: 12,
      vatApplies: false,
      expected: {
        goodsAmount: 2500,
        shippingAmount: 1200,
        orderAmount: 3700,
        taxAmount: 0,
        shippingTaxAmount: 0,
        goodsTaxAmount: 0,
      },
    },
  ];

  /**
   * A Medusa that prices the cart the way the declared configuration makes
   * it.
   *
   * **Medusa's wire response is always gross** — `item_total`,
   * `shipping_total` — regardless of what `assertedCartTotals` then does with
   * it, so this reconstructs the gross figures from `one.expected`'s net
   * ones by adding each one's own tax back, rather than assuming the two
   * agree. `item_tax_total`/`shipping_tax_total`/`subtotal` need no such
   * reconstruction: they were never `goodsAmount`/`shippingAmount`
   * themselves, so the 2026-08-29 change to what those two fields mean does
   * not touch the arithmetic that produces them here.
   */
  async function medusaPricing(one: AddressCase): Promise<string> {
    const minor = (value: number) => value / 100;
    const goodsTax = one.expected.taxAmount - one.expected.shippingTaxAmount;
    const grossGoods = one.expected.goodsAmount + goodsTax;
    const grossShipping = one.expected.shippingAmount + one.expected.shippingTaxAmount;
    const body = JSON.stringify({
      cart: {
        id: "cart_example",
        currency_code: "eur",
        item_total: minor(grossGoods),
        item_subtotal: minor(one.expected.goodsAmount),
        item_tax_total: minor(goodsTax),
        shipping_total: minor(grossShipping),
        shipping_subtotal: one.shippingNetMajor,
        shipping_tax_total: minor(one.expected.shippingTaxAmount),
        subtotal:
          minor(one.expected.orderAmount - one.expected.taxAmount),
        tax_total: minor(one.expected.taxAmount),
        total: minor(one.expected.orderAmount),
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

  function clientFor(origin: string) {
    return createMedusaStoreClient(
      { basePath: "/store-api", publishableKey: "pk_example_checkout" },
      origin,
    );
  }

  it.each(cases)(
    "charges $label the frozen rate and states figures that add up",
    async (one) => {
      const client = clientFor(await medusaPricing(one));
      // `amountWithTax` is Medusa's own field on a shipping option — the
      // gross figure — and is unaffected by what `CartTotals.shippingAmount`
      // now means; reconstruct it from the net `expected.shippingAmount` and
      // its own tax rather than assume the two agree.
      const grossShipping = one.expected.shippingAmount + one.expected.shippingTaxAmount;

      const totals = await addGuestShippingMethod(
        client,
        "cart_example",
        { ...parsedOption(one.optionId, "Standard delivery", one.shippingNetMajor * 100), amountWithTax: grossShipping },
        one.vatApplies,
      );

      expect(totals).toEqual({ currency: "EUR", ...one.expected });
      // THE INVARIANT, over the fixture's own declared figures rather than
      // only over the code's output: net goods plus net shipping plus VAT is
      // the total — replacing the pre-2026-08-29 `goodsAmount +
      // shippingAmount === orderAmount`, which held over the *grossed* pair
      // and is false by construction now that both are net.
      expect(one.expected.goodsAmount + one.expected.shippingAmount + one.expected.taxAmount).toBe(
        one.expected.orderAmount,
      );
    },
  );

  /**
   * **The invariant that used to read `goodsAmount === 2500` for every
   * destination — now the opposite claim, and still made per-destination.**
   *
   * Before 2026-08-18 there was one advertised figure and the checkout stated
   * it regardless of destination; between 2026-08-18 and 2026-08-29 the
   * checkout stated whatever the *product page* would quote that destination
   * (gross for the EU, net elsewhere), so "the checkout shows what the
   * product page showed" was the claim to test. Since 2026-08-29 the checkout
   * states the **net** figure for every destination instead — the operator's
   * decomposition — so the claim this test makes is the newest one: the goods
   * figure Medusa charges a buyer in Tallinn, netted of its own tax and
   * formatted, is character-for-character `resolveCatalogue`'s destination-
   * **independent** `priceNet`, for all three cases including the EU one
   * where it now differs from the advertised `price`.
   *
   * The destination is looked up from the case's own country name through the
   * one list both halves of this site read, so a case cannot compare a
   * checkout for one country against a product page for another.
   */
  it("states the net price of the goods, the same figure the product page states for every destination", async () => {
    // The destination-independent baseline every case is checked against —
    // asserted once, so a mutation that let this equal `price` for a non-EU
    // destination (net === gross there) without also equalling it for Estonia
    // cannot pass by accident.
    const baselineNet = resolveCatalogue().priceNet;
    for (const one of cases) {
      const client = clientFor(await medusaPricing(one));
      const grossShipping = one.expected.shippingAmount + one.expected.shippingTaxAmount;
      const totals = await addGuestShippingMethod(
        client,
        "cart_example",
        { ...parsedOption(one.optionId, "Standard delivery", one.shippingNetMajor * 100), amountWithTax: grossShipping },
        one.vatApplies,
      );

      const destination = destinationForCountryName(one.address.country);
      expect(destination, one.address.country).not.toBeNull();
      expect(destination!.euMember, one.address.country).toBe(one.vatApplies);

      expect(totals.goodsAmount, one.address.country).not.toBeNull();
      expect(
        formatAmount(totals.goodsAmount!, totals.currency),
        `${one.address.country}: the checkout no longer states the invariant net price of the goods`,
      ).toBe(resolveCatalogue(mockCatalogue, destination!).priceNet);
      expect(
        formatAmount(totals.goodsAmount!, totals.currency),
        `${one.address.country}: the net goods figure moved with the destination`,
      ).toBe(baselineNet);
    }
  });

  it("offers a zone for every one of the three addresses rather than refusing one", async () => {
    for (const one of cases) {
      const seen: SeenRequest[] = [];
      const optionBody = JSON.stringify({
        shipping_options: [option(one.optionId, "Standard delivery", one.shippingNetMajor)],
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
      const client = clientFor(await listen(server));

      const options = await prepareGuestShipping(client, "cart_example", one.address);

      expect(options, one.address.country).toEqual([
        parsedOption(one.optionId, "Standard delivery", one.shippingNetMajor * 100),
      ]);
      expect(seen[0]?.body, one.address.country).toMatchObject({
        shipping_address: { country_code: expect.any(String) },
      });
    }
  });

  /**
   * Three refusals, all of the same species: a checkout that cannot compute an
   * honest set of figures must not render a dishonest one.
   *
   * The first is `goodsAmount(net) + shippingAmount(net) + taxAmount ===
   * orderAmount` — the replacement, since 2026-08-29, for the check that used
   * to compare the *grossed* goods and shipping figures to the total. The
   * second is what the VAT row makes necessary regardless of which pair is
   * net: a tax total that is not the tax on the goods plus the tax on the
   * delivery accounts for something nobody can see.
   *
   * The third refusal in `assertedCartTotals` — the two figures **with**
   * their tax added back are the total — has **no case here, and that is the
   * finding rather than an omission**: given the first two it is
   * algebraically implied, as the test below demonstrates. It is kept anyway,
   * and kept honest by being described as what it is: a restatement of the
   * invariant from the other direction, which survives somebody relaxing
   * either of the other two. It is, not coincidentally, the check the first
   * one displaced — see that test's own doc comment.
   */
  it.each([
    [
      "figures that do not add up",
      { item_total: 25, item_tax_total: 0, shipping_total: 7, shipping_tax_total: 0, tax_total: 0, total: 33 },
      /do not add up/,
    ],
    [
      // `total` is 37, not 39.68: with goods and shipping net (25 + 7), the
      // first check must already pass for this fixture to reach the second
      // one at all — 25 + 7 + 5 = 37, over the fixture's own stated
      // (wrong) tax_total of 5.
      "a tax total that is not the tax on the goods and the delivery",
      { item_total: 31, item_tax_total: 6, shipping_total: 8.68, shipping_tax_total: 1.68, tax_total: 5, total: 37 },
      /tax on the goods and the delivery/,
    ],
  ] as const)("refuses %s rather than putting it on the screen", async (_label, cart, message) => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ cart: { id: "cart_example", currency_code: "eur", ...cart } }));
      });
    });
    servers.push(server);
    const client = clientFor(await listen(server));

    await expect(
      addGuestShippingMethod(client, "cart_example", parsedOption("so_eu", "Standard delivery", 700), true),
    ).rejects.toThrow(message);
  });

  /**
   * The third refusal cannot fire on its own, and this is why.
   *
   * `(goodsNet + goodsTax) + (shippingNet + shippingTax)` reduces, under the
   * second refusal (`tax = goodsTax + shippingTax`), to `goodsNet +
   * shippingNet + tax` — which the first refusal has already required to
   * equal the total. So any cart that fails the third has already failed one
   * of the others and thrown a different message. Asserted rather than
   * reasoned about in a comment, over the same arithmetic the implementation
   * does, so a future edit that made the third check something genuinely
   * independent turns this red and asks for a case.
   *
   * This is the pre-2026-08-29 version of this test with its variables
   * relabelled net rather than gross and its two conclusions swapped — see
   * `assertedCartTotals`'s doc comment on the redundant check for why the
   * algebra is identical either way.
   */
  it("has no cart that fails only the redundant refusal, which is why it has no case above", () => {
    const random = (seed: number) => (seed * 9301 + 49297) % 2333;
    for (let seed = 1; seed < 400; seed += 1) {
      const goodsNet = random(seed);
      const goodsTax = random(seed + 1) % (goodsNet + 1);
      const shippingNet = random(seed + 2);
      const shippingTax = random(seed + 3) % (shippingNet + 1);
      const tax = random(seed + 4);
      const total = random(seed + 5);

      const addsUp = goodsNet + shippingNet + tax === total;
      const taxAccountedFor = tax === goodsTax + shippingTax;
      const grossedMatchesTotal = (goodsNet + goodsTax) + (shippingNet + shippingTax) === total;

      if (addsUp && taxAccountedFor) {
        expect(grossedMatchesTotal, `${String(seed)}: the first two hold and the third does not`).toBe(true);
      }
    }
  });

  /**
   * **The guard that must not be dropped in favour of just fixing the number.**
   *
   * The `<select>` and the summary are two Medusa reads and nothing compared
   * them, which is how a €7.00 option came to sit beside an €8.68 charge. So
   * after the method is added, the figure that was shown is checked against the
   * figure that was charged — with the comparison matching the kind of claim
   * the label made: a final figure must equal the charge, and a net figure
   * marked "+ VAT" must equal the charge net of its own tax.
   */
  it("refuses to render totals that disagree with the delivery figure it showed", async () => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        // A perfectly consistent cart — every refusal above passes — that
        // simply charges for a different delivery option than the one shown.
        response.end(
          '{"cart":{"id":"cart_example","currency_code":"eur","item_total":31,' +
            '"item_tax_total":6,"shipping_total":14.88,"shipping_tax_total":2.88,' +
            '"tax_total":8.88,"total":45.88}}',
        );
      });
    });
    servers.push(server);
    const client = clientFor(await listen(server));

    await expect(
      addGuestShippingMethod(client, "cart_example", parsedOption("so_eu", "Standard delivery", 700), true),
    ).rejects.toThrow(/not the delivery charge Medusa applied/);
  });

  it("accepts the delivery figure it showed when Medusa charges exactly that", async () => {
    const client = clientFor(await medusaPricing(cases[0]!));

    // The net figure, since 2026-08-29 — the option's own quoted 700 net,
    // matching a net-marked "+ VAT" shown figure exactly rather than needing
    // to be regrossed first.
    await expect(
      addGuestShippingMethod(client, "cart_example", parsedOption("so_eu", "Standard delivery", 700), true),
    ).resolves.toMatchObject({ shippingAmount: 700 });
  });
});

/**
 * Which delivery method a fresh option list starts selected as — the second
 * half of the operator's 2026-08-29 instruction, *"For EE/LV/LT, should be
 * standard and parcel machine (default), rest - the standard option only."*
 *
 * `defaultShippingOptionId` is the one call site `CheckoutPageContent.tsx`'s
 * shipping-options effect uses, and it decides purely from **what Medusa
 * returned** — never from a country code re-derived here — which is what
 * keeps this file from carrying a second copy of the EE/LV/LT set. That set
 * and the phone-optional set differ by exactly one member and are a
 * standing trap to conflate — see `PARCEL_MACHINE_COUNTRY_CODES` and
 * `PHONE_OPTIONAL_COUNTRY_CODES` in `backend/src/commerce/shipping-model.ts`,
 * whose doc comments spell out why neither is derived from the other.
 */
describe("defaultShippingOptionId — the EE/LV/LT preselection", () => {
  const standard = parsedOption("so_standard", "Standard delivery", 700);
  const parcelMachine = parsedOption("so_parcel_machine", PARCEL_MACHINE_OPTION_NAME, 0);

  it("prefers the Omniva parcel machine method when Medusa offered it", () => {
    expect(defaultShippingOptionId([standard, parcelMachine])).toBe(parcelMachine.id);
    // Order in the response must not matter either.
    expect(defaultShippingOptionId([parcelMachine, standard])).toBe(parcelMachine.id);
  });

  /**
   * "rest - the standard option only": nothing is preselected, exactly the
   * state a fresh option list has always started in. Medusa returns only the
   * Standard method outside Estonia, Latvia and Lithuania (see the
   * handover's "Established facts"), so this is the case that actually
   * occurs for every other delivery address.
   */
  it("selects nothing when the parcel machine method was not offered", () => {
    expect(defaultShippingOptionId([standard])).toBe("");
  });

  it("selects nothing for an empty option list", () => {
    expect(defaultShippingOptionId([])).toBe("");
  });
});
