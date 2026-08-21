/**
 * The browser suite's fake Medusa, held to the storefront's own Store readers
 * and to the two contract files that describe what this shop sells.
 *
 * ## Why this test exists
 *
 * The net-pricing change updated every stub in this suite and missed
 * `tests/playwright/medusa-fixture.ts`, because nothing in the unit suite ever
 * looked at it. The consequence was not a red browser test, which would have
 * been a fair trade: `catalogueProductFromStore` refuses a product with no
 * with-tax amount, so **every render of `/` threw**, the Next server under
 * `playwright.config.ts` never became ready, and both the browser and the
 * screenshot suites died at `Timed out waiting 120000ms from
 * config.webServer` — a failure that names no fixture and no price.
 * `bash scripts/validate` stayed green throughout, because it does not run
 * Playwright.
 *
 * So the gap is closed where the gap was: in the gate that runs on every
 * change. Each case below drives a **real storefront reader** — not a
 * hand-written expectation of what the fixture ought to say — over the
 * fixture's real answer, so the two cannot drift apart again without this
 * going red.
 *
 * ## The figures are read from the contract files, never typed out
 *
 * `storefront/mock/catalogue.json` and `storefront/mock/shipping.json` are what
 * the live catalogue is seeded to and what every page composes from. A fake
 * that agreed with a literal in this file would prove only that two literals
 * match; agreeing with those two files is what makes a page rendered against
 * the fake the page a buyer is shown.
 */
import { describe, expect, it } from "vitest";

import { mockCatalogue } from "../src/lib/catalogue.js";
import { declaredShippingMethod } from "../src/lib/cart.js";
import { STORE_CART_FIELDS, cartLinesFromStore } from "../src/lib/store-cart.js";
import { loadStoreCatalogueProduct } from "../src/lib/store-product.js";
import { returnOrderDisclosure } from "../src/lib/store-payment.js";
import { fixtureResponse } from "./playwright/medusa-fixture.js";

const BACKEND_URL = "http://127.0.0.1:3199";

function ask(method: string, url: string, body = ""): unknown {
  const reply = fixtureResponse({ method, url, body });
  expect(reply.status).toBe(200);
  return JSON.parse(reply.body);
}

/** The query every cart request the storefront makes carries. */
const FIELDS = `?fields=${encodeURIComponent(STORE_CART_FIELDS)}`;

/**
 * The catalogue as the storefront loads it: its own request builder, its own
 * region read, its own refusals — over the fixture.
 *
 * The stub is the transport and nothing else. It is what makes this a test of
 * `loadStoreCatalogueProduct` against the fixture rather than a test of a URL
 * somebody wrote down here, which matters because the defect this guards
 * against is precisely a request and a response that disagree about the tax
 * context.
 */
async function loadCatalogueThroughFixture() {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const reply = fixtureResponse({ method: "GET", url: `${url.pathname}${url.search}`, body: "" });
    return Promise.resolve(
      new Response(reply.body, { status: reply.status, headers: { "content-type": reply.contentType } }),
    );
  }) as typeof globalThis.fetch;
  try {
    return await loadStoreCatalogueProduct({
      backendUrl: BACKEND_URL,
      publishableKey: "pk_playwright_fixture",
      presentation: mockCatalogue,
    });
  } finally {
    globalThis.fetch = original;
  }
}

describe("the browser suite's Medusa fixture", () => {
  it("serves a catalogue the storefront's own loader accepts, priced as the mock catalogue is", async () => {
    const product = await loadCatalogueThroughFixture();

    expect(product.price).toEqual({
      amount: mockCatalogue.price.amount,
      amountWithTax: mockCatalogue.price.amountWithTax,
      currency: mockCatalogue.price.currency,
      taxIncluded: mockCatalogue.price.taxIncluded,
      vatRatePercent: mockCatalogue.price.vatRatePercent,
    });
    expect(product.name).toBe(mockCatalogue.name);
    expect(product.availability).toBe("InStock");
  });

  /**
   * The fake reproduces Medusa's early return rather than serving the tax
   * fields unconditionally — see `wrapProductsWithTaxPrices`. Without this the
   * fixture could not tell a storefront that names its VAT country from one
   * that has stopped, which is the misconfiguration
   * `catalogueProductFromStore`'s refusal exists to catch.
   */
  it("omits both tax amounts when the request names no country, exactly as Medusa does", () => {
    const untaxed = ask("GET", "/store/products?limit=1&fields=id,variants.*") as {
      products: readonly { variants: readonly { calculated_price: Record<string, unknown> }[] }[];
    };
    const price = untaxed.products[0]!.variants[0]!.calculated_price;

    expect(price).not.toHaveProperty("calculated_amount_with_tax");
    expect(price).not.toHaveProperty("calculated_amount_without_tax");
    // The flag is an *input* to that calculation, so it is present either way.
    expect(price.is_calculated_price_tax_inclusive).toBe(false);
    expect(price.calculated_amount).toBe(mockCatalogue.price.amount / 100);
  });

  /**
   * A basket is quoted for the destination the storefront writes onto its cart,
   * and the browser suite exercises both sides of the border: the default
   * destination is outside the EU, while the Stripe return page's cart carries
   * a confirmed Estonian address. Both figures come from the catalogue
   * contract — the net one and the gross one — so a fake quoting a basket net
   * for Estonia would go red here rather than on a screenshot.
   */
  it("prices a basket for the country written onto its cart", () => {
    // The order `addStoreCatalogueLine` uses: the destination is written onto
    // the cart *before* the line, because the line's tax is computed against
    // whatever address the cart holds when it is added.
    ask("POST", `/store/carts${FIELDS}`, JSON.stringify({ region_id: "region_fixture" }));
    ask(
      "POST",
      `/store/carts/cart_add_fixture${FIELDS}`,
      JSON.stringify({ shipping_address: { country_code: "us" } }),
    );

    const line = ask("POST", `/store/carts/cart_add_fixture/line-items${FIELDS}`, "{}") as { cart: unknown };
    expect(cartLinesFromStore(line.cart)).toEqual([
      {
        id: "line_fixture",
        variantId: "variant_lunar_base",
        productName: mockCatalogue.name,
        unitAmount: mockCatalogue.price.amount,
        currency: mockCatalogue.price.currency,
        quantity: 1,
        availability: "InStock",
      },
    ]);

    const insideTheUnion = ask(
      "POST",
      `/store/carts/cart_add_fixture${FIELDS}`,
      JSON.stringify({ shipping_address: { country_code: "ee" } }),
    ) as { cart: unknown };
    expect(cartLinesFromStore(insideTheUnion.cart)[0]?.unitAmount).toBe(mockCatalogue.price.amountWithTax);
  });

  /**
   * The fidelity that matters most, and the one this fixture did not have.
   *
   * Medusa v2 omits `items[].total` unless `fields` asks for it. This fixture
   * used to return it unconditionally, so it was strictly more generous than
   * the server it stands in for — and that is why the browser suite stayed
   * green while adding to the basket failed in every real environment. A
   * fixture may be smaller than the real thing; it may not be *kinder*, because
   * then the suite proves nothing about the code that meets the real thing.
   */
  it("withholds per-line totals from a request that did not ask for them, as Medusa does", () => {
    ask("POST", `/store/carts${FIELDS}`, JSON.stringify({ region_id: "region_fixture" }));
    const line = ask("POST", "/store/carts/cart_add_fixture/line-items", "{}") as {
      cart: { items: readonly Record<string, unknown>[] };
    };

    expect(line.cart.items[0]).toBeDefined();
    expect(line.cart.items[0]!["total"]).toBeUndefined();
    expect(() => cartLinesFromStore(line.cart)).toThrow(/carries no total/);
  });

  /**
   * The Stripe return page's cart, through the reader that page uses — which
   * applies the checkout's three totals refusals, so a fake whose VAT row did
   * not account for the tax inside the two figures above it would fail here.
   *
   * The delivery figures are the shipping contract's own: `ratesWithTax` for
   * the European Union, and the VAT inside it is the difference between the two
   * declared rate tables. No rate is applied anywhere in this file.
   */
  it("serves a confirmed Estonian cart the return page's disclosure accepts", () => {
    const cartId = "cart_return_agreement";
    const { cart } = ask("GET", `/store/carts/${cartId}`) as { cart: unknown };
    const disclosure = returnOrderDisclosure({ cart }, cartId);

    const shippingWithTax = declaredShippingMethod.ratesWithTax.europeanUnion;
    const shippingVat = shippingWithTax - declaredShippingMethod.rates.europeanUnion;
    const goodsVat = mockCatalogue.price.amountWithTax - mockCatalogue.price.amount;

    expect(disclosure.goodsAmount).toBe(mockCatalogue.price.amountWithTax);
    expect(disclosure.shippingAmount).toBe(shippingWithTax);
    expect(disclosure.taxAmount).toBe(goodsVat + shippingVat);
    expect(disclosure.orderAmount).toBe(mockCatalogue.price.amountWithTax + shippingWithTax);
    expect(disclosure.countryCode).toBe("ee");
    expect(disclosure.currency).toBe(mockCatalogue.price.currency);
  });
});
