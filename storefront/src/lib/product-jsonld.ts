/**
 * `Product` and `Offer` JSON-LD for the canonical product page.
 *
 * Price, currency and availability are not literal here — they come from
 * `catalogueMock.offer` in runtime configuration, which is exactly the mock
 * this checkbox's own text calls for: "establish this now, while the values
 * are still mock, because Task 5 adds the ones that make it expensive to
 * retrofit." Task 2 has no catalogue; Medusa lands in Task 5. When it does,
 * only `getRuntimeConfig`'s `catalogueMock` loader changes — this function's
 * shape does not.
 *
 * **`offers` is omitted entirely when no offer is configured.** This block is
 * machine-readable data submitted to search engines, so publishing a
 * defaulted price would be publishing a claim this deployment cannot stand
 * behind. A `Product` with no `Offer` makes no price claim at all, which is
 * the honest thing to say when nobody has configured one. See
 * `src/config/runtime-config.ts` for why the configuration side refuses to
 * default it.
 *
 * `availability` is already a schema.org token (`InStock`, `OutOfStock`, …);
 * {@link SCHEMA_AVAILABILITY_BASE} is the URI prefix schema.org expects it
 * prefixed with.
 */

import type { CatalogueMock } from "../config/runtime-config.js";

const SCHEMA_AVAILABILITY_BASE = "https://schema.org/";

export interface ProductJsonLdInput {
  readonly catalogue: CatalogueMock;
  readonly url: string;
  readonly description: string;
}

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.catalogue.productName,
    description: input.description,
    url: input.url,
  };

  const { offer } = input.catalogue;
  if (offer === null) return product;

  product.offers = {
    "@type": "Offer",
    url: input.url,
    priceCurrency: offer.priceCurrency,
    price: (offer.priceAmount / 100).toFixed(2),
    availability: `${SCHEMA_AVAILABILITY_BASE}${offer.availability}`,
  };

  return product;
}
