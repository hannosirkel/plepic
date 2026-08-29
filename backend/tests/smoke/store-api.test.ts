import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { REGION_NAME } from "../../src/commerce/configuration.js";
import { PRODUCT } from "../../src/commerce/product-model.js";
import {
  EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR,
  MANUAL_FULFILLMENT_PROVIDER_ID,
  OMNIVA_FULFILLMENT_PROVIDER_ID,
  PARCEL_MACHINE_OPTION_NAME,
  PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR,
  SHIPPING_CURRENCY,
  SHIPPING_OPTION_NAME,
} from "../../src/commerce/shipping-model.js";
import {
  ESTONIAN_STANDARD_VAT_PERCENT,
  TAX_PROVIDER_ID,
  VAT_COUNTRY_CODES,
  VAT_RATE_CODE,
  VAT_RATE_NAME,
  vatPercentForCountry,
} from "../../src/commerce/tax-model.js";

/**
 * One request against a **running** Medusa — the request the storefront makes,
 * answered by the database `npm run predeploy` just built.
 *
 * ## Why a suite that needs a server exists at all
 *
 * The shop's price model changed from tax-inclusive to net-plus-VAT, went
 * through three review passes and 2,967 unit tests, and merged with a defect
 * that answered **every catalogue request with HTTP 500**:
 *
 * ```
 * Unable to retrieve the tax provider with id: null
 *   TaxProviderService.retrieveProvider → getTaxLines → wrapProductsWithTaxPrices
 * ```
 *
 * `npm run configure:commerce` created twenty-seven tax regions with
 * `provider_id = NULL`, because Medusa's own backfill migration
 * (`migrate-tax-region-provider`) runs during the **first** `db:migrate` — before
 * any region exists — and is then recorded in `script_migrations` and never runs
 * again. Every unit test stayed green throughout, and could not have done
 * otherwise: they assert that the right workflow received the right input, and
 * the input was wrong in a way only Medusa's own runtime knows about.
 * `src/commerce/tax-model.ts` (`TAX_PROVIDER_ID`) sets out the whole mechanism.
 *
 * That is the shape of defect this file exists for, and the only way to catch it
 * is to ask a real Medusa. `scripts/store-smoke` stands one up — the pinned
 * PostgreSQL and Redis from `compose.yaml`, the built server from
 * `backend/.medusa/server`, the four predeploy commands in their real order —
 * and then runs this.
 *
 * ## Every expected figure is read from a declaration
 *
 * Nothing below is typed in. The net amount is `PRODUCT.amountMinor`, the gross
 * is `storefront/mock/catalogue.json`'s `amountWithTax` cross-checked against
 * `ESTONIAN_STANDARD_VAT_PERCENT`, the twenty-seven countries are
 * `VAT_COUNTRY_CODES`, and the provider is `TAX_PROVIDER_ID`. A check that
 * hard-coded `31` would stop being true the day the rate changed and would
 * become a second place to edit — which is the failure mode this whole
 * repository organises itself against.
 *
 * ## What it is not
 *
 * It is not a browser test and it is not a checkout. It asks the catalogue
 * question, in the terms `storefront/src/lib/store-product.ts` asks it, and
 * checks the answer. Everything else a live stack could be asked was left out
 * deliberately; see `scripts/store-smoke` for what was considered.
 */

/** Where `scripts/store-smoke` published the Medusa it started. */
const backendUrl = requiredEnvironmentValue("STORE_SMOKE_BACKEND_URL");

/**
 * The administrator `npm run seed:administrator` created, one step of the
 * predeploy chain earlier.
 *
 * Reading the same two variables the predeploy Job reads is not a convenience:
 * signing in with them is the only assertion in this repository that the seeded
 * administrator can actually authenticate. A Store API key has to be minted
 * through the Admin API to ask a Store question at all, so that proof is on the
 * way to everything else here rather than an errand of its own.
 */
const adminEmail = requiredEnvironmentValue("MEDUSA_ADMIN_EMAIL");
const adminPassword = requiredEnvironmentValue("MEDUSA_ADMIN_PASSWORD");

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(
      `${name} is not set; this suite needs a running Medusa and is run by scripts/store-smoke`,
    );
  }
  return value;
}

/**
 * The EU destination the catalogue is priced in, and a destination outside it.
 *
 * Neither is a free choice and neither is trusted to stay correct: the two
 * assertions immediately below hold them to the tax model, so an accession, a
 * withdrawal, or a change to the one-rate reasoning in
 * `src/commerce/tax-model.ts` fails here with a message about *this* pair rather
 * than as an unexplained arithmetic difference sixty lines later.
 *
 * `EE` is the storefront's `VAT_PRICING_COUNTRY_CODE` — the fixed reference
 * country every page's gross figure is quoted in. `US` is simply somewhere the
 * shop delivers to and charges no EU VAT in; the region covers every country
 * Medusa knows, so it is a real destination rather than an unroutable one.
 */
const EU_PRICING_COUNTRY = "EE";
const NON_EU_PRICING_COUNTRY = "US";

/**
 * The catalogue request's `fields`, as `storefront/src/lib/store-product.ts`
 * builds it.
 *
 * Copied rather than imported: this is a backend suite and reaching across the
 * workspace boundary for a private constant would drag Next.js's module graph
 * into it. The copy is held to the original by the agreement test below, which
 * is what makes it a copy rather than a second opinion — a smoke check that
 * asked for a *different* projection than the storefront asks for would prove
 * something about a request nobody makes.
 */
const STORE_PRODUCT_FIELDS = [
  "id",
  "title",
  "thumbnail",
  "images.url",
  "*variants",
  "+variants.calculated_price",
  "+variants.inventory_quantity",
];

/** The mock the storefront renders when it has no Medusa; a contract, not a fixture. */
const mockCatalogue = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "..", "storefront", "mock", "catalogue.json"),
    "utf8",
  ),
) as { product: { price: { amount: number; amountWithTax: number; currency: string } } };

/** Minor units, net of tax. */
const NET_MINOR = PRODUCT.amountMinor;

/** Minor units, gross, for a delivery address in the EU. */
const GROSS_MINOR = mockCatalogue.product.price.amountWithTax;

/**
 * Medusa answers in major units (`25`, `31`); everything declared in this
 * repository is in minor units. Dividing rather than multiplying keeps the
 * comparison exact for the amounts this shop has: `2500 / 100` and `3100 / 100`
 * are both representable, where `31 * 100` invites the reader to wonder.
 */
function major(minor: number): number {
  return minor / 100;
}

interface CalculatedPrice {
  readonly calculated_amount?: unknown;
  readonly calculated_amount_with_tax?: unknown;
  readonly calculated_amount_without_tax?: unknown;
  readonly is_calculated_price_tax_inclusive?: unknown;
  readonly currency_code?: unknown;
}

interface StoreVariant {
  readonly sku?: unknown;
  readonly calculated_price?: CalculatedPrice;
}

interface StoreProduct {
  readonly title?: unknown;
  readonly variants?: readonly StoreVariant[];
}

/** A publishable key, and the region every price is computed in. */
let publishableKey = "";
let regionId = "";

async function json(
  path: string,
  init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string },
): Promise<{ status: number; body: unknown; text: string }> {
  const response = await fetch(new URL(path, backendUrl), {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: init?.body,
  });
  const text = await response.text();
  // The body is kept as text as well as parsed, because the failure this file
  // exists to catch answers with a body that says nothing —
  // `{"code":"unknown_error"}` — and an assertion message carrying the raw text
  // is the difference between "expected 500 to be 200" and knowing what came
  // back. A 500 is also not always JSON.
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: response.status, body, text };
}

/** A Store request, carrying the publishable key every `/store/*` route requires. */
async function store(
  path: string,
  init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string },
): Promise<{ status: number; body: unknown; text: string }> {
  return await json(path, {
    ...init,
    headers: { "x-publishable-api-key": publishableKey, ...(init?.headers ?? {}) },
  });
}

/**
 * The catalogue URL, built the way `fetchStoreCatalogue` builds it.
 *
 * `region_id` is what lets Medusa compute a price at all; `country_code` is what
 * lets it compute the **tax** on that price — and it is the second of those that
 * takes the whole request through `wrapProductsWithTaxPrices` and into the tax
 * provider. Omit it and the defect this file exists for is invisible.
 */
function catalogueRequest(countryCode: string): string {
  const url = new URL("/store/products", backendUrl);
  url.searchParams.set("limit", "1");
  url.searchParams.set("fields", STORE_PRODUCT_FIELDS.join(","));
  url.searchParams.set("region_id", regionId);
  url.searchParams.set("country_code", countryCode.toLowerCase());
  return `${url.pathname}${url.search}`;
}

function record(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  return value as Record<string, unknown>;
}

function sequence(value: unknown, label: string): readonly unknown[] {
  expect(Array.isArray(value), label).toBe(true);
  return value as readonly unknown[];
}

/**
 * Signs in as the seeded administrator and mints a Store key scoped to the sales
 * channel the product was seeded into.
 *
 * Nothing in this repository creates a publishable key — the cluster's is made
 * by hand in the Admin and projected as `MEDUSA_PUBLISHABLE_API_KEY` — so the
 * suite makes its own. Linking it to every sales channel the store has is what
 * makes `GET /store/products` able to see the seeded product at all:
 * `ensurePublishableApiKeyMiddleware` puts the key's channels on the request and
 * the products route filters by them.
 */
beforeAll(async () => {
  const authenticated = await json("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  expect(
    authenticated.status,
    `the seeded administrator could not sign in: ${authenticated.text}`,
  ).toBe(200);
  const token = record(authenticated.body, "auth response")["token"];
  expect(token, "auth response carries no token").toBeTypeOf("string");
  const authorization = { authorization: `Bearer ${String(token)}` };

  const channels = await json("/admin/sales-channels?limit=100", { headers: authorization });
  expect(channels.status, channels.text).toBe(200);
  const channelIds = sequence(
    record(channels.body, "sales channels")["sales_channels"],
    "sales_channels",
  ).map((channel) => String(record(channel, "sales channel")["id"]));
  expect(channelIds.length, "the store has no sales channel to scope a Store key to")
    .toBeGreaterThan(0);

  const created = await json("/admin/api-keys", {
    method: "POST",
    headers: authorization,
    body: JSON.stringify({ title: "store-smoke", type: "publishable" }),
  });
  expect(created.status, created.text).toBe(200);
  const apiKey = record(record(created.body, "api key response")["api_key"], "api key");
  publishableKey = String(apiKey["token"]);

  const linked = await json(`/admin/api-keys/${String(apiKey["id"])}/sales-channels`, {
    method: "POST",
    headers: authorization,
    body: JSON.stringify({ add: channelIds }),
  });
  expect(linked.status, linked.text).toBe(200);

  // The pricing context every catalogue request carries, resolved the way the
  // storefront resolves it — and asserted in the same breath, because "exactly
  // one region" is a refusal `cart-store.tsx` and `store-product.ts` both make.
  const regions = await store("/store/regions?limit=2");
  expect(regions.status, regions.text).toBe(200);
  const listed = sequence(record(regions.body, "regions response")["regions"], "regions");
  expect(listed, "Medusa must expose exactly one region to price the catalogue in").toHaveLength(1);
  const region = record(listed[0], "region");
  expect(region["name"]).toBe(REGION_NAME);
  expect(region["currency_code"]).toBe(SHIPPING_CURRENCY.toLowerCase());
  regionId = String(region["id"]);
});

describe("the figures this suite expects", () => {
  /*
   * These are not tests of Medusa. They are the reason the numbers below may be
   * written as `NET_MINOR` and `GROSS_MINOR` at all: each one ties a constant
   * this file reads to the declaration that produces it, so a rate change moves
   * every expectation together or fails right here, naming the disagreement.
   */

  it("takes the gross figure from the rate rather than from a literal", () => {
    expect(GROSS_MINOR).toBe((NET_MINOR * (100 + ESTONIAN_STANDARD_VAT_PERCENT)) / 100);
  });

  it("prices in a country the tax model charges VAT in, and one it does not", () => {
    expect(vatPercentForCountry(EU_PRICING_COUNTRY)).toBe(ESTONIAN_STANDARD_VAT_PERCENT);
    expect(vatPercentForCountry(NON_EU_PRICING_COUNTRY)).toBeNull();
  });

  it("asks for the projection the storefront asks for", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "..", "storefront", "src", "lib", "store-product.ts"),
      "utf8",
    );
    for (const field of STORE_PRODUCT_FIELDS) {
      expect(source, `storefront/src/lib/store-product.ts no longer requests ${field}`).toContain(
        `"${field}"`,
      );
    }
  });
});

/**
 * The root cause, checked where it lives.
 *
 * The 500 below is the symptom; this is the row that caused it. Both are worth
 * having: a future defect could leave the provider set and still break pricing,
 * and a future Medusa could tolerate a null provider and still be wrong.
 */
describe("configure:commerce leaves every tax region able to compute a tax", () => {
  it(`gives all ${String(VAT_COUNTRY_CODES.length)} of them ${TAX_PROVIDER_ID}`, async () => {
    const response = await json(`/admin/tax-regions?limit=200&fields=country_code,provider_id,*tax_rates`, {
      headers: { authorization: `Bearer ${await adminToken()}` },
    });
    expect(response.status, response.text).toBe(200);
    const regions = sequence(
      record(response.body, "tax regions response")["tax_regions"],
      "tax_regions",
    ).map((region) => record(region, "tax region"));

    expect(regions.map((region) => String(region["country_code"]).toUpperCase()).toSorted()).toEqual(
      [...VAT_COUNTRY_CODES].toSorted(),
    );

    for (const region of regions) {
      expect(
        region["provider_id"],
        `tax region ${String(region["country_code"])} names no tax provider, so any price ` +
          "computed in it is an HTTP 500 rather than a price",
      ).toBe(TAX_PROVIDER_ID);

      const rates = sequence(region["tax_rates"], "tax_rates").map((rate) =>
        record(rate, "tax rate"),
      );
      expect(rates).toHaveLength(1);
      expect(rates[0]!["code"]).toBe(VAT_RATE_CODE);
      expect(rates[0]!["name"]).toBe(VAT_RATE_NAME);
      expect(rates[0]!["rate"]).toBe(ESTONIAN_STANDARD_VAT_PERCENT);
      expect(rates[0]!["is_default"]).toBe(true);
    }
  });
});

describe("the catalogue request the storefront makes", () => {
  it("answers 200 with the net and the gross figure for an EU destination", async () => {
    const response = await store(catalogueRequest(EU_PRICING_COUNTRY));
    expect(
      response.status,
      `GET /store/products for ${EU_PRICING_COUNTRY} answered ${String(response.status)}: ${response.text}`,
    ).toBe(200);

    const price = calculatedPrice(response.body);
    expect(price.calculated_amount_without_tax).toBe(major(NET_MINOR));
    expect(price.calculated_amount_with_tax).toBe(major(GROSS_MINOR));
    expect(price.calculated_amount).toBe(major(NET_MINOR));
    // The stored price is net and Medusa has to say so: a price preference that
    // had drifted back to tax-inclusive would return the same `25` here with the
    // shop keeping EUR 20.16 of it.
    expect(price.is_calculated_price_tax_inclusive).toBe(false);
    expect(price.currency_code).toBe(SHIPPING_CURRENCY.toLowerCase());
  });

  it("answers 200 with no VAT at all for a destination outside the EU", async () => {
    const response = await store(catalogueRequest(NON_EU_PRICING_COUNTRY));
    expect(
      response.status,
      `GET /store/products for ${NON_EU_PRICING_COUNTRY} answered ${String(response.status)}: ${response.text}`,
    ).toBe(200);

    const price = calculatedPrice(response.body);
    expect(price.calculated_amount_without_tax).toBe(major(NET_MINOR));
    // Not "zero-rated": no EU VAT arises at all, and Medusa expresses that as a
    // gross figure equal to the net one rather than as a tax line of zero.
    expect(price.calculated_amount_with_tax).toBe(major(NET_MINOR));
    expect(price.is_calculated_price_tax_inclusive).toBe(false);
  });

  it("returns the one product the seed declares", async () => {
    const response = await store(catalogueRequest(EU_PRICING_COUNTRY));
    expect(response.status, response.text).toBe(200);
    const products = sequence(
      record(response.body, "products response")["products"],
      "products",
    ) as readonly StoreProduct[];
    expect(products, "the Store catalogue must contain exactly one active product").toHaveLength(1);
    expect(products[0]!.title).toBe(PRODUCT.title);
    const variants = sequence(products[0]!.variants, "variants") as readonly StoreVariant[];
    expect(variants).toHaveLength(1);
    expect(variants[0]!.sku).toBe(PRODUCT.sku);
  });
});

/**
 * A cart with a completed shipping address, the way `cart-store.tsx` builds
 * one on the path to checkout: `POST /store/carts` with a `region_id` and a
 * `shipping_address` carrying nothing but a `country_code`, which is all
 * `listShippingOptionsForCartWorkflow` reads off it to resolve a service zone.
 */
async function cartWithShippingAddress(countryCode: string): Promise<Record<string, unknown>> {
  const created = await store("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId, shipping_address: { country_code: countryCode } }),
  });
  expect(
    created.status,
    `POST /store/carts for ${countryCode} answered ${String(created.status)}: ${created.text}`,
  ).toBe(200);
  return record(record(created.body, "cart response")["cart"], "cart");
}

/** `GET /store/shipping-options`, the request a completed address makes checkout ask. */
async function listShippingOptionsForCart(cartId: string): Promise<readonly Record<string, unknown>[]> {
  const response = await store(`/store/shipping-options?cart_id=${cartId}`);
  expect(response.status, response.text).toBe(200);
  return sequence(
    record(response.body, "shipping options response")["shipping_options"],
    "shipping_options",
  ).map((option) => record(option, "shipping option"));
}

/**
 * The proof Task 2 exists for: declaring an explicit fulfillment module with a
 * `providers` array, to register Omniva, does not unregister Medusa's default
 * `manual_manual`.
 *
 * `backend/tests/commerce-medusa-semantics.test.ts` reproduces Medusa's
 * `validateFulfillmentProvidersStep` check over a graph it builds by hand, and
 * that is a good test — but it never runs Medusa's own module loader, so it
 * cannot see a `providers` array that silently displaced the built-in manual
 * provider. The only place that loader runs is here: a real Medusa, built and
 * started by `scripts/store-smoke`, with `npm run configure:commerce` already
 * having created the three `Standard delivery` options against
 * `manual_manual` and the free `Omniva parcel machine` option against
 * `omniva_omniva`. If declaring the `providers` array in `medusa-config.ts`
 * had displaced the default, `configureCommerce` would have thrown
 * `Providers (manual_manual) are not enabled for the service location` while
 * `npm run predeploy` ran, long before this suite ever got a socket to ask —
 * so a green run here is standing proof of the negative, not an assumption of
 * it.
 */
describe("the shipping options a completed address is offered", () => {
  it("offers an Estonian cart both methods, and a German cart only Standard delivery", async () => {
    const estonian = await cartWithShippingAddress("ee");
    const estonianOptions = await listShippingOptionsForCart(String(estonian["id"]));
    expect((estonianOptions.map((option) => option["name"]) as string[]).sort()).toEqual(
      [PARCEL_MACHINE_OPTION_NAME, SHIPPING_OPTION_NAME].sort(),
    );

    const parcelMachine = estonianOptions.find((option) => option["name"] === PARCEL_MACHINE_OPTION_NAME);
    expect(parcelMachine?.["amount"]).toBe(major(PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR));
    expect(parcelMachine?.["provider_id"]).toBe(OMNIVA_FULFILLMENT_PROVIDER_ID);

    const standard = estonianOptions.find((option) => option["name"] === SHIPPING_OPTION_NAME);
    expect(standard?.["amount"]).toBe(major(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR));
    // manual_manual still serves the flat rate alongside the free Omniva
    // method. A `providers` array that had replaced Medusa's default manual
    // provider would have failed configureCommerce, and therefore
    // npm run predeploy, long before this line — this is the assertion Task 2
    // exists for, asserting the survivor rather than assuming it.
    expect(standard?.["provider_id"]).toBe(MANUAL_FULFILLMENT_PROVIDER_ID);

    const german = await cartWithShippingAddress("de");
    const germanOptions = await listShippingOptionsForCart(String(german["id"]));
    expect(germanOptions.map((option) => option["name"])).toEqual([SHIPPING_OPTION_NAME]);
    expect(germanOptions[0]?.["provider_id"]).toBe(MANUAL_FULFILLMENT_PROVIDER_ID);
  });
});

/**
 * The exact defect this describe block exists to catch by asking a real
 * Medusa, reproduced from inside the deployed test environment's pod as:
 *
 * ```
 * GET /store/omniva/parcel-machines?country=EE
 * 400 {"type":"not_allowed","message":"Publishable API key required in the
 * request header: x-publishable-api-key. …"}
 * ```
 *
 * `storefront/src/lib/omniva-locations.ts`'s `fetchParcelMachines` hand-rolled
 * its own `fetch()` call carrying only an `accept` header, while every other
 * Store call in the storefront went through `@medusajs/js-sdk`'s client
 * (`createMedusaStoreClient`), which attaches `x-publishable-api-key` itself —
 * so this one call alone was refused. No storefront unit test caught it,
 * because those tests stub `global.fetch`, which cannot fail on a header it
 * never inspects: 3,213 passing tests and a green `bash scripts/validate`
 * both missed a 400 on the one request this feature depends on. `store()`
 * below carries the same header every other assertion in this file does; this
 * is the one place in the repository that proves a **real** Medusa answers
 * this specific route with it, the way the tax-provider describe block above
 * is the one place that proves the catalogue route does.
 */
describe("the Omniva parcel machine list the checkout picker fetches", () => {
  it("answers 200 with a non-empty list for Estonia, with the publishable key", async () => {
    const response = await store(`/store/omniva/parcel-machines?country=${EU_PRICING_COUNTRY}`);
    expect(
      response.status,
      `GET /store/omniva/parcel-machines?country=${EU_PRICING_COUNTRY} answered ${String(response.status)}: ${response.text}`,
    ).toBe(200);
    const machines = sequence(
      record(response.body, "parcel machines response")["parcel_machines"],
      "parcel_machines",
    ).map((machine) => record(machine, "parcel machine"));
    expect(machines.length, "the Omniva parcel machine list must not be empty").toBeGreaterThan(0);
    for (const machine of machines) {
      expect(machine["zip"], "a parcel machine with no zip cannot be selected").toBeTypeOf("string");
      expect(machine["name"], "a parcel machine with no name cannot be shown").toBeTypeOf("string");
    }
  });

  /**
   * The exact refusal reproduced above, asked directly rather than inferred:
   * the same route, the same country, with no `x-publishable-api-key` header
   * at all — `json()` rather than `store()`, which is what makes this request
   * the unauthenticated one.
   */
  it("refuses the same request without the publishable key", async () => {
    const response = await json(`/store/omniva/parcel-machines?country=${EU_PRICING_COUNTRY}`);
    expect(
      response.status,
      `GET /store/omniva/parcel-machines?country=${EU_PRICING_COUNTRY} with no publishable key answered ${String(response.status)}: ${response.text}`,
    ).toBe(400);
    expect(
      record(response.body, "unauthenticated response")["message"],
    ).toContain("x-publishable-api-key");
  });
});

/** The one variant's computed price, refusing anything that is not one. */
function calculatedPrice(body: unknown): CalculatedPrice {
  const products = sequence(
    record(body, "products response")["products"],
    "products",
  ) as readonly StoreProduct[];
  expect(products, "the Store catalogue must contain exactly one active product").toHaveLength(1);
  const variants = sequence(products[0]!.variants, "variants") as readonly StoreVariant[];
  expect(variants).toHaveLength(1);
  const price = variants[0]!.calculated_price;
  expect(
    price,
    "the variant carries no calculated price; the request reached no pricing context",
  ).toBeTypeOf("object");
  return price!;
}

/** A fresh Admin token. Cheap, and it keeps the tax-region check independent of order. */
async function adminToken(): Promise<string> {
  const authenticated = await json("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  expect(authenticated.status, authenticated.text).toBe(200);
  return String(record(authenticated.body, "auth response")["token"]);
}
