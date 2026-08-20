import { ConfigError } from "../config/env.js";

import type { CatalogueProduct } from "./catalogue.js";
import { assertBrowserMediaOnly, browserMediaUrls } from "./store-media.js";
import { medusaMajorToMinor } from "./store-money.js";

interface StoreProductResponse {
  readonly products?: readonly unknown[];
}

interface StoreRegionResponse {
  readonly regions?: readonly unknown[];
}

const STORE_PRODUCT_FIELDS = [
  "id",
  "title",
  "thumbnail",
  "images.url",
  "*variants",
  "+variants.calculated_price",
  "+variants.inventory_quantity",
].join(",");

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError(`Medusa Store response has no ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new ConfigError(`Medusa Store response has no ${label}`);
  return value;
}

/**
 * Converts the one Store API product response into the long-lived presentational
 * catalogue shape. Product facts come from Medusa; game specification facts
 * remain editorial facts owned by the page composition.
 */
export function catalogueProductFromStore(
  response: StoreProductResponse,
  presentation: CatalogueProduct,
): CatalogueProduct {
  if (!Array.isArray(response.products) || response.products.length !== 1) {
    throw new ConfigError("Medusa Store response must contain exactly one active product");
  }
  const product = record(response.products[0], "product");
  if (!Array.isArray(product.variants)) throw new ConfigError("Medusa Store product has no variants");

  for (const rawVariant of product.variants) {
    const variant = record(rawVariant, "variant");
    const calculated = record(variant.calculated_price, "calculated price");
    const currency = text(calculated.currency_code, "calculated price currency").toUpperCase();
    if (currency !== "EUR") continue;
    const manageInventory = variant.manage_inventory === true;
    const canBackorder = variant.allow_backorder === true;
    const stock = variant.inventory_quantity;
    const available = !manageInventory || canBackorder || (Number.isInteger(stock) && (stock as number) > 0);
    return {
      ...presentation,
      name: text(product.title, "product title"),
      price: {
        amount: medusaMajorToMinor(calculated.calculated_amount, currency),
        currency,
        taxIncluded: presentation.price.taxIncluded,
      },
      availability: available ? "InStock" : "OutOfStock",
    };
  }
  throw new ConfigError("Medusa Store product has no purchasable EUR variant");
}

/**
 * The product's media, in the one form the browser is allowed to receive:
 * `/store-api/static/<file>` on the current origin. The seeded backend records
 * `/static/<file>`; anything else — an absolute origin, a traversal, an
 * encoding — is dropped rather than forwarded. See `store-media.ts`.
 */
export function productImageUrlsFromStore(response: StoreProductResponse): readonly string[] {
  const product = record(response.products?.[0], "product");
  const images = Array.isArray(product.images) ? product.images : [];
  return browserMediaUrls([
    product.thumbnail,
    ...images.map((image) => (typeof image === "object" && image !== null ? (image as Record<string, unknown>).url : null)),
  ]);
}

function variantIdentityFromStore(response: StoreProductResponse): { readonly id: string; readonly available: boolean } {
  const product = record(response.products?.[0], "product");
  if (!Array.isArray(product.variants)) throw new ConfigError("Medusa Store product has no variants");
  for (const rawVariant of product.variants) {
    const variant = record(rawVariant, "variant");
    const calculated = record(variant.calculated_price, "calculated price");
    if (text(calculated.currency_code, "calculated price currency").toUpperCase() === "EUR") {
      const available =
        variant.manage_inventory !== true ||
        variant.allow_backorder === true ||
        (Number.isInteger(variant.inventory_quantity) && (variant.inventory_quantity as number) > 0);
      return { id: text(variant.id, "variant id"), available };
    }
  }
  throw new ConfigError("Medusa Store product has no EUR variant");
}

/**
 * The store's one region, which is the pricing context every catalogue request
 * must carry.
 *
 * `+variants.calculated_price` asks Medusa v2 to *compute* a price, and a
 * computation needs to know whose price it is. Without a context the Store API
 * refuses the whole request — `400 {"type":"invalid_data","message":"Missing
 * required pricing context to calculate prices - region_id"}` — so a catalogue
 * load that omitted it did not return an unpriced product, it took the page
 * down. Medusa accepts `currency_code` instead, and it would cost no request at
 * all, but price lists and tax settings are **region**-scoped: a price computed
 * from a bare currency is not promised to be the price the region-scoped cart
 * then charges. `AddToCartButton` creates that cart with `region_id`, so this
 * asks in the same terms, and a shopper is quoted the price they are charged.
 *
 * Requiring exactly one region — the refusal `AddToCartButton` already makes
 * before creating a cart — is the whole of the region selection. A second
 * region is a store this storefront has no way to choose within, and guessing
 * would show one region's price and charge another's.
 */
async function storePricingRegionId(backendUrl: string, publishableKey: string): Promise<string> {
  const url = new URL("/store/regions", backendUrl);
  // Two is all it takes to tell "exactly one" from "more than one".
  url.searchParams.set("limit", "2");
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "x-publishable-api-key": publishableKey },
  });
  if (!response.ok) throw new ConfigError(`Medusa Store region request failed (${String(response.status)})`);
  const body = (await response.json()) as StoreRegionResponse;
  if (!Array.isArray(body.regions) || body.regions.length !== 1) {
    throw new ConfigError("Medusa Store must expose exactly one region to price the catalogue in");
  }
  return text(record(body.regions[0], "region").id, "region id");
}

/**
 * The one Store catalogue request, priced in the store's region.
 *
 * Both loaders go through here rather than each building the URL, so neither
 * can be given a pricing context the other lacks — which is exactly how the
 * two call sites came to be broken in identical ways.
 *
 * Neither the region nor the product is cached. `cache: "no-store"` on the
 * product read is deliberate and stated below; the region read is the same
 * request's pricing context and is given the same treatment. A region id is
 * stable enough to memoise for a process lifetime, and doing so was rejected:
 * it would hold a value across a store reconfiguration, and it would let a
 * store that grew a second region keep serving prices computed in the first
 * one instead of failing loudly. The cost is one extra request per catalogue
 * load, paid on the home page and the product page.
 */
async function fetchStoreCatalogue(backendUrl: string, publishableKey: string): Promise<StoreProductResponse> {
  const regionId = await storePricingRegionId(backendUrl, publishableKey);
  const url = new URL("/store/products", backendUrl);
  url.searchParams.set("limit", "1");
  url.searchParams.set("fields", STORE_PRODUCT_FIELDS);
  url.searchParams.set("region_id", regionId);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "x-publishable-api-key": publishableKey },
  });
  if (!response.ok) throw new ConfigError(`Medusa Store catalogue request failed (${String(response.status)})`);
  return (await response.json()) as StoreProductResponse;
}

/** Reads the Store product on each request. No build-time value or cache is used. */
export async function loadStoreCatalogueProduct({
  backendUrl,
  publishableKey,
  presentation,
}: {
  readonly backendUrl: string | null;
  readonly publishableKey: string | null;
  readonly presentation: CatalogueProduct;
}): Promise<CatalogueProduct> {
  if (backendUrl === null || publishableKey === null) {
    throw new ConfigError("MEDUSA_BACKEND_URL and MEDUSA_PUBLISHABLE_API_KEY are required for the Store catalogue");
  }
  return assertBrowserMediaOnly(
    catalogueProductFromStore(await fetchStoreCatalogue(backendUrl, publishableKey), presentation),
  );
}

export async function loadStoreProduct(input: {
  readonly backendUrl: string | null;
  readonly publishableKey: string | null;
  readonly presentation: CatalogueProduct;
}): Promise<{
  readonly catalogue: CatalogueProduct;
  readonly variantId: string | null;
  readonly analyticsVariantId: string;
  readonly imageUrls: readonly string[];
}> {
  const { backendUrl, publishableKey, presentation } = input;
  if (backendUrl === null || publishableKey === null) {
    throw new ConfigError("MEDUSA_BACKEND_URL and MEDUSA_PUBLISHABLE_API_KEY are required for the Store catalogue");
  }
  const body = await fetchStoreCatalogue(backendUrl, publishableKey);
  const variant = variantIdentityFromStore(body);
  // The raw Store response does not leave this function, and what does leave it
  // is checked: `assertBrowserMediaOnly` is what makes "every product image URL
  // the browser receives is the relative form" a property of the seam rather
  // than of the one page that happens to consume it today.
  return assertBrowserMediaOnly({
    catalogue: catalogueProductFromStore(body, presentation),
    variantId: variant.available ? variant.id : null,
    analyticsVariantId: variant.id,
    imageUrls: productImageUrlsFromStore(body),
  });
}
