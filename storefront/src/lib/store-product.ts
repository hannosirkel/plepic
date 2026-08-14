import { ConfigError } from "../config/env.js";

import type { CatalogueProduct } from "./catalogue.js";
import { browserMediaUrls } from "./store-media.js";
import { medusaMajorToMinor } from "./store-money.js";

interface StoreProductResponse {
  readonly products?: readonly unknown[];
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
  const url = new URL("/store/products", backendUrl);
  url.searchParams.set("limit", "1");
  url.searchParams.set("fields", STORE_PRODUCT_FIELDS);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "x-publishable-api-key": publishableKey },
  });
  if (!response.ok) throw new ConfigError(`Medusa Store catalogue request failed (${String(response.status)})`);
  return catalogueProductFromStore((await response.json()) as StoreProductResponse, presentation);
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
  const url = new URL("/store/products", backendUrl);
  url.searchParams.set("limit", "1");
  url.searchParams.set("fields", STORE_PRODUCT_FIELDS);
  const response = await fetch(url, { cache: "no-store", headers: { "x-publishable-api-key": publishableKey } });
  if (!response.ok) throw new ConfigError(`Medusa Store catalogue request failed (${String(response.status)})`);
  const body = (await response.json()) as StoreProductResponse;
  const variant = variantIdentityFromStore(body);
  return {
    catalogue: catalogueProductFromStore(body, presentation),
    variantId: variant.available ? variant.id : null,
    analyticsVariantId: variant.id,
    imageUrls: productImageUrlsFromStore(body),
  };
}
