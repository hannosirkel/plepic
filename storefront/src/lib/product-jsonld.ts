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
 *
 * ## The published price is destination-**independent**, and the page's is not
 *
 * That is the one place this block deliberately parts company with the page it
 * sits on, and it is a change of 2026-08-18 rather than an oversight.
 *
 * Since the price became net, the figure a person reads depends on where they
 * are having the game sent: the gross figure for a delivery address in the EU,
 * the net one for any other. This block reads the same product object the page
 * renders, so left alone it would have followed — and that is two problems, not
 * one. A crawler **has** no destination, so there is no honest answer to give
 * it from a per-visitor axis. And varying a published `Offer.price` by the
 * requester is cloaking-adjacent: the same URL would advertise two prices to
 * two requesters with nothing in the markup saying so.
 *
 * So it publishes **one** figure — the gross EU price, the higher of the two —
 * and says in the markup that it includes VAT, via an `offers.priceSpecification`
 * of type `UnitPriceSpecification` carrying `valueAddedTaxIncluded: true`. The
 * higher one, because a published price a buyer is never asked to exceed is the
 * safe direction to be wrong in, and because it is the figure the EU consumer
 * protection this site is written to actually addresses.
 *
 * It stays bound to the catalogue. `tests/product-jsonld.test.ts` compares it
 * to `resolveCatalogue(product, <an EU destination>)` — the page's own
 * resolution, for the destination this block claims to speak for — so the two
 * still cannot drift; the pin moved from "the page's figure" to "the page's EU
 * figure" rather than being deleted.
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
  /*
   * One figure, the same for every requester: the price of the goods for a
   * delivery address in the European Union, with the VAT in it. See this
   * module's doc comment for why it is deliberately **not** the
   * destination-dependent figure the page beside it renders.
   */
  const price = (product.price.amountWithTax / 100).toFixed(2);

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
      price,
      /*
       * What makes the tax treatment of `price` explicit rather than inferred.
       * `Offer.price` alone states a number; `valueAddedTaxIncluded: true`
       * states which of this shop's two numbers it is — and under net pricing
       * an offer that does not say is exactly the ambiguity this whole change
       * exists to remove.
       */
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceCurrency: product.price.currency,
        price,
        valueAddedTaxIncluded: true,
      },
      availability: `${SCHEMA_AVAILABILITY_BASE}${product.availability}`,
    },
  };
}
