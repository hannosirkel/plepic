import { ConfigError } from "../config/env.js";

import type { CatalogueProduct } from "./catalogue.js";

interface StoreProductResponse {
  readonly products?: readonly unknown[];
}

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

function amount(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ConfigError(`Medusa Store response has no usable ${label}`);
  }
  return value as number;
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
        amount: amount(calculated.calculated_amount, "calculated price amount"),
        currency,
        taxIncluded: presentation.price.taxIncluded,
      },
      availability: available ? "InStock" : "OutOfStock",
    };
  }
  throw new ConfigError("Medusa Store product has no purchasable EUR variant");
}

function purchasableVariantIdFromStore(response: StoreProductResponse): string | null {
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
      return available ? text(variant.id, "variant id") : null;
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
  url.searchParams.set("fields", "id,title,variants.*");
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
}): Promise<{ readonly catalogue: CatalogueProduct; readonly variantId: string | null }> {
  const { backendUrl, publishableKey, presentation } = input;
  if (backendUrl === null || publishableKey === null) {
    throw new ConfigError("MEDUSA_BACKEND_URL and MEDUSA_PUBLISHABLE_API_KEY are required for the Store catalogue");
  }
  const url = new URL("/store/products", backendUrl);
  url.searchParams.set("limit", "1");
  url.searchParams.set("fields", "id,title,variants.*");
  const response = await fetch(url, { cache: "no-store", headers: { "x-publishable-api-key": publishableKey } });
  if (!response.ok) throw new ConfigError(`Medusa Store catalogue request failed (${String(response.status)})`);
  const body = (await response.json()) as StoreProductResponse;
  return { catalogue: catalogueProductFromStore(body, presentation), variantId: purchasableVariantIdFromStore(body) };
}
