/**
 * The seam between `npm run seed:product` and the reader that consumes it.
 *
 * `backend/src/commerce/seed-product.ts` writes exactly one product to Medusa
 * and `src/lib/store-product.ts` reads exactly one back. Nothing joined them:
 * the backend suite proves the records reach the right workflows, this suite
 * proves the reader copes with a Store response, and neither could see a seed
 * whose *shape* the reader refuses — which is not a hypothetical refusal but a
 * `ConfigError` on every page that reads the catalogue.
 *
 * **It lives in the storefront suite because it cannot live in the backend
 * one.** `backend/tsconfig.json` sets `rootDir` to `backend/`, so importing
 * `storefront/src/lib/store-product.ts` there is
 * `error TS6059: File '…/storefront/src/lib/store-product.ts' is not under
 * 'rootDir'` — measured, not assumed, and true of a dynamic `import()` as well
 * as a static one. The storefront's program has no `rootDir`, so the dependency
 * runs the other way: this file imports the backend's declaration. The same
 * asymmetry `backend/tests/deployment-contract.test.ts` documents for
 * `scripts/`.
 *
 * The other half of the agreement — that `mock/catalogue.json` says what the
 * declaration says — is asserted in
 * `backend/tests/commerce-product-seed.test.ts`, which reads the JSON as data.
 * Between the two, the mock, the seed and the reader are one statement.
 */
import { describe, expect, it } from "vitest";

import { PRODUCT } from "../../backend/src/commerce/product-model.js";
import { ESTONIAN_STANDARD_VAT_PERCENT } from "../../backend/src/commerce/tax-model.js";
import { productSeedRecords } from "../../backend/src/commerce/seed-product.js";
import { mockCatalogue } from "../src/lib/catalogue.js";
import { catalogueProductFromStore } from "../src/lib/store-product.js";

/**
 * The Store API response Medusa returns for the seeded product.
 *
 * Every field is derived from the seed records rather than written here, which
 * is the whole point: a declaration that changed and a reader that then refused
 * it would turn this red, and a literal would not.
 */
function seededStoreResponse(): { products: unknown[] } {
  const price = productSeedRecords().find((record) => record.kind === "variant-price");
  const stock = productSeedRecords().find((record) => record.kind === "variant-stock");
  const product = productSeedRecords().find((record) => record.kind === "product");
  if (price?.kind !== "variant-price") throw new Error("no price record");
  if (stock?.kind !== "variant-stock") throw new Error("no stock record");
  if (product?.kind !== "product") throw new Error("no product record");

  return {
    products: [
      {
        id: "prod_01",
        title: product.title,
        // No thumbnail and no images: the seed declares none, and the product
        // page renders assets committed to `public/` instead.
        variants: [
          {
            id: "variant_01",
            sku: product.sku,
            manage_inventory: stock.manageInventory,
            calculated_price: {
              // `updateProductVariantsWorkflow` is given a decimal amount and
              // Medusa hands one back, which is why `medusaMajorToMinor` exists.
              calculated_amount: price.amountMinor / 100,
              // The declared price is net, so the stored amount and the
              // without-tax amount are the same figure, and the with-tax one is
              // what `wrapProductsWithTaxPrices` adds once the request names a
              // VAT country. Derived from the seeded amount and the declared
              // rate rather than written down, so a seed that changed and a
              // reader that then refused it turns this red.
              calculated_amount_without_tax: price.amountMinor / 100,
              calculated_amount_with_tax:
                Math.round(price.amountMinor * (1 + ESTONIAN_STANDARD_VAT_PERCENT / 100)) / 100,
              is_calculated_price_tax_inclusive: false,
              currency_code: price.currency.toLowerCase(),
            },
          },
        ],
      },
    ],
  };
}

describe("the seeded product, read by the storefront's own reader", () => {
  it("is exactly one product the reader accepts", () => {
    expect(seededStoreResponse().products).toHaveLength(1);
    expect(() => catalogueProductFromStore(seededStoreResponse(), mockCatalogue)).not.toThrow();
  });

  /**
   * The amount is checked against the **mock** as well as the declaration, and
   * that is not redundant. Medusa hands back a decimal and the reader converts
   * it, so `PRODUCT.amountMinor` on both sides of the comparison would still
   * catch a broken conversion — but only the mock comparison catches the seed
   * and the advertised figure parting company, and the mock is pinned to the
   * declaration from the other side in
   * `backend/tests/commerce-product-seed.test.ts`.
   */
  it("resolves to the declared name, price and currency", () => {
    const resolved = catalogueProductFromStore(seededStoreResponse(), mockCatalogue);

    expect(resolved.name).toBe(PRODUCT.title);
    expect(resolved.name).toBe(mockCatalogue.name);
    expect(resolved.price.amount).toBe(PRODUCT.amountMinor);
    expect(resolved.price.amount).toBe(mockCatalogue.price.amount);
    expect(resolved.price.currency).toBe(PRODUCT.currency);
  });

  /**
   * `manage_inventory: false` is the operator's model — one physical copy,
   * fulfilled by hand — and the reader turns it into `InStock` unconditionally,
   * with no inventory level anywhere. A seed that ever managed inventory would
   * therefore need a stocked level too, or the shop would advertise a product it
   * refuses to sell.
   */
  it("is in stock because inventory is unmanaged, not because a count was seeded", () => {
    const response = seededStoreResponse();
    const [product] = response.products as { variants: { inventory_quantity?: number }[] }[];
    expect(product!.variants[0]).not.toHaveProperty("inventory_quantity");

    expect(catalogueProductFromStore(response, mockCatalogue).availability).toBe("InStock");
  });

  /**
   * The reader takes `taxIncluded` from **Medusa** now, not from the
   * presentation, so this asserts the response and the two price preferences in
   * `backend/src/commerce/configuration.ts` are one decision rather than two.
   * Both say the price is net.
   *
   * The gross figure is checked against the declared rate, which is the join
   * this file exists to make: the seed writes a net amount, the tax model
   * declares the rate, and the storefront displays whichever of the two figures
   * the destination calls for without ever multiplying by anything.
   */
  it("presents the price as net and carries the EU gross figure the tax model implies", () => {
    const resolved = catalogueProductFromStore(seededStoreResponse(), mockCatalogue);

    expect(resolved.price.taxIncluded).toBe(false);
    expect(resolved.price.amount).toBe(PRODUCT.amountMinor);
    expect(resolved.price.amountWithTax).toBe(
      Math.round(PRODUCT.amountMinor * (1 + ESTONIAN_STANDARD_VAT_PERCENT / 100)),
    );
    expect(resolved.price.amountWithTax).toBe(mockCatalogue.price.amountWithTax);
  });
});
