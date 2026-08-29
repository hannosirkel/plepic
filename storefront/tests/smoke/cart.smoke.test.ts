/**
 * A basket, built by the storefront's own Store functions, against a running
 * Medusa.
 *
 * ## The defect this exists for
 *
 * Adding Lunar Base to the basket did not work in any environment. The product
 * page's button appeared to do nothing; `/cart` answered "That did not work.
 * Nothing has changed." Every Store call succeeded — a `curl` reproduction of
 * the same three requests returned 200 with correct figures — so nothing in the
 * server or the proxy was at fault.
 *
 * **Medusa v2 omits per-line computed totals unless the request asks for them.**
 * `POST /store/carts/:id/line-items` and `GET /store/carts/:id` both answer with
 * `items[].total` absent, while the cart-level `item_total` is computed and
 * correct. `cartLinesFromStore` reads each line's `total`, so it threw on every
 * add, restore, quantity change and removal.
 *
 * ## Why nothing caught it, and what that means for this file
 *
 * Every layer was tested against something that agreed with it: the mock cart
 * layer satisfies the parser, the backend's smoke suite asked the catalogue a
 * question but never built a cart, and the Playwright fixture hand-wrote
 * `total` on every line it returned. 2,994 unit tests and 47 browser tests
 * passed with the buy button broken in production.
 *
 * So these tests call `src/lib/store-cart.ts`'s **own exported functions**
 * rather than assembling requests. That distinction is the whole value: a test
 * that builds its own URL with `STORE_CART_FIELDS` in it passes whether or not
 * the shipped code sends them. Only calling the shipped function proves the
 * shipped function works — reverting the fix turns every assertion below red.
 */
import Medusa from "@medusajs/js-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import {
  STORE_CART_FIELDS,
  addStoreLine,
  applyDestinationToCart,
  cartLinesFromStore,
  createStoreCart,
  removeStoreLine,
  retrieveStoreCart,
  updateStoreLineQuantity,
} from "../../src/lib/store-cart.js";
import type { createMedusaStoreClient } from "../../src/lib/medusa-client.js";
import { mockCatalogue } from "../../src/lib/catalogue.js";

type StoreClient = ReturnType<typeof createMedusaStoreClient>;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required; this suite is run by scripts/store-smoke`);
  }
  return value;
}

const backendUrl = requiredEnvironmentValue("STORE_SMOKE_BACKEND_URL");
const adminEmail = requiredEnvironmentValue("MEDUSA_ADMIN_EMAIL");
const adminPassword = requiredEnvironmentValue("MEDUSA_ADMIN_PASSWORD");

/**
 * Minor units, net — the catalogue's declared price before tax, and what a
 * real basket line's `unitAmount` states in every zone, since the
 * basket-lines fix that followed 2026-08-29.
 */
const NET_MINOR = mockCatalogue.price.amount;
/** Minor units, gross — what a delivery address inside the VAT union is
 *  actually charged; `NET_MINOR` plus the per-line `taxAmount` addend. */
const GROSS_MINOR = mockCatalogue.price.amountWithTax;

let sdk: StoreClient;
let publishableKey = "";
let regionId = "";
let variantId = "";

async function api(path: string, init?: RequestInit & { token?: string }): Promise<unknown> {
  const response = await fetch(new URL(path, backendUrl), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.token === undefined ? {} : { authorization: `Bearer ${init.token}` }),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  expect(response.status, `${path}: ${text}`).toBeLessThan(400);
  return JSON.parse(text);
}

/**
 * Signs in as the seeded administrator and mints a Store key scoped to every
 * sales channel, exactly as the backend's smoke suite does and for the same
 * reason: nothing in this repository creates a publishable key — the cluster's
 * is made by hand in the Admin — so the suite makes its own.
 */
beforeAll(async () => {
  const auth = (await api("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })) as { token: string };

  const { sales_channels: channels } = (await api("/admin/sales-channels", {
    token: auth.token,
  })) as { sales_channels: readonly { id: string }[] };

  const { api_key: key } = (await api("/admin/api-keys", {
    method: "POST",
    token: auth.token,
    body: JSON.stringify({ title: "storefront-cart-smoke", type: "publishable" }),
  })) as { api_key: { id: string; token: string } };

  for (const channel of channels) {
    await api(`/admin/api-keys/${key.id}/sales-channels`, {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ add: [channel.id] }),
    });
  }

  publishableKey = key.token;
  sdk = new Medusa({ baseUrl: backendUrl, publishableKey }) as unknown as StoreClient;

  const { regions } = await sdk.store.region.list({ limit: 2 });
  expect(regions, "the store must expose exactly one region").toHaveLength(1);
  regionId = regions[0]!.id;

  const { products } = await sdk.store.product.list({ limit: 1, fields: "id,variants.*" });
  variantId = String(products[0]?.variants?.[0]?.id);
  expect(variantId, "the catalogue has no variant to add").not.toBe("undefined");
});

/** A cart with the destination already written on, as `addStoreCatalogueLine` builds one. */
async function basketFor(countryCode: string): Promise<string> {
  const cartId = await createStoreCart(sdk, regionId);
  await applyDestinationToCart(sdk, cartId, countryCode);
  return cartId;
}

describe("the basket the storefront builds, on a live Medusa", () => {
  it("adds a line and prices it the way the buyer is charged", async () => {
    const lines = await addStoreLine(sdk, await basketFor("ee"), variantId);

    expect(lines, "the basket must hold the one line that was added").toHaveLength(1);
    expect(lines[0]!.quantity).toBe(1);
    /*
     * Estonia is inside the VAT union, so `unitAmount` is the net figure and
     * `taxAmount` is the VAT that gets added to it — since the basket-lines
     * fix that followed 2026-08-29, `unitAmount` reads Medusa's `subtotal`
     * rather than `total`, so `cartTotals`' summary and this line's own
     * columns are the same figure on the basket rather than two that could
     * silently disagree. A parser reading the stored `unit_price` would also
     * report the net price, for the wrong reason: it never asks Medusa's tax
     * engine anything, so it would not move with a discount or a future
     * per-region price the way `subtotal` does — which is the reason the
     * parser reads line totals in the first place, and therefore the reason
     * it needs them to be present.
     */
    expect(lines[0]!.unitAmount).toBe(NET_MINOR);
    expect(lines[0]!.taxAmount).toBe(GROSS_MINOR - NET_MINOR);
    expect(
      lines[0]!.variantId,
      "no variant reached the line, so availability is being guessed and the analytics event cannot match",
    ).toBe(variantId);
  });

  it("restores a basket — the path the product page's button lands on", async () => {
    const cartId = await basketFor("ee");
    await addStoreLine(sdk, cartId, variantId);

    expect(cartLinesFromStore(await retrieveStoreCart(sdk, cartId))).toHaveLength(1);
  });

  it("changes a line's quantity and reprices it", async () => {
    const cartId = await basketFor("ee");
    const [line] = await addStoreLine(sdk, cartId, variantId);

    const updated = await updateStoreLineQuantity(sdk, cartId, line!.id, 3);

    expect(updated).toHaveLength(1);
    expect(updated[0]!.quantity).toBe(3);
    expect(updated[0]!.unitAmount, "three of them must cost the same each").toBe(NET_MINOR);
  });

  it("removes a line and leaves an empty basket", async () => {
    const cartId = await basketFor("ee");
    const [line] = await addStoreLine(sdk, cartId, variantId);

    expect(await removeStoreLine(sdk, cartId, line!.id)).toEqual([]);
  });

  it("prices a destination outside the VAT union without tax", async () => {
    const lines = await addStoreLine(sdk, await basketFor("us"), variantId);

    expect(lines[0]!.unitAmount).toBe(NET_MINOR);
    expect(lines[0]!.taxAmount).toBe(0);
  });

  /*
   * The upstream fact the fix rests on, asserted so that the day Medusa starts
   * returning per-line totals by default, this says so plainly rather than
   * leaving STORE_CART_FIELDS looking like superstition.
   */
  it("still omits per-line totals from a request that does not ask for them", async () => {
    const cartId = await basketFor("ee");
    const response = await fetch(new URL(`/store/carts/${cartId}/line-items`, backendUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    });
    const body = (await response.json()) as { cart: { items: readonly Record<string, unknown>[] } };

    expect(response.status).toBe(200);
    expect(
      body.cart.items[0]!["total"],
      `Medusa now returns per-line totals by default; "${STORE_CART_FIELDS}" and this test can be simplified`,
    ).toBeUndefined();
  });
});
