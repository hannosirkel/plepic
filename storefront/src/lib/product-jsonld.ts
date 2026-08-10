/**
 * `Product` and `Offer` JSON-LD for the canonical product page.
 *
 * **One source, shared with the rendered page.** Name, price, currency and
 * availability come from `storefront/mock/catalogue.json` through
 * `./catalogue.ts` — the same module, and on the product route the same
 * resolved object, that paints the price a human reads. That is not a
 * convenience: this block is a machine-readable claim submitted to search
 * engines, and the previous arrangement read it from four environment
 * variables while the visible page read the mock catalogue, so one request to
 * one page could publish a different amount, a different currency and
 * `"availability":"OutOfStock"` to a crawler while showing a visitor the
 * catalogue's own price, in stock — nothing failing, nothing warning. Two
 * sources for one fact is the defect; a test that compares them is a patch
 * over it. There is now one.
 *
 * A price this deployment cannot stand behind is still never published — the
 * guarantee is just enforced somewhere better. `mock/catalogue.json` is
 * committed, reviewed source pinned by `tests/catalogue.test.ts` to the
 * frozen commercial facts, so there is no state in which this function has
 * nothing truthful to say and therefore no state in which `offers` should be
 * omitted. Task 5 replaces `catalogue.ts`'s reader with a Medusa lookup and
 * both this and the page follow it together.
 *
 * `availability` is already a schema.org token (`InStock`, `OutOfStock`, …);
 * {@link SCHEMA_AVAILABILITY_BASE} is the URI prefix schema.org expects it
 * prefixed with.
 */

import { mockCatalogue, type CatalogueProduct } from "./catalogue.js";

const SCHEMA_AVAILABILITY_BASE = "https://schema.org/";

export interface ProductJsonLdInput {
  /** Defaults to `mock/catalogue.json`'s own product — the same one the page renders. */
  readonly product?: CatalogueProduct;
  readonly url: string;
  readonly description: string;
}

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const product = input.product ?? mockCatalogue;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: input.description,
    url: input.url,
    offers: {
      "@type": "Offer",
      url: input.url,
      priceCurrency: product.price.currency,
      price: (product.price.amount / 100).toFixed(2),
      availability: `${SCHEMA_AVAILABILITY_BASE}${product.availability}`,
    },
  };
}
