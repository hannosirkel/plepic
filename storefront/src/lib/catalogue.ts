/**
 * Resolves `content/`'s catalogue placeholders (`{price}`, `{priceLine}`,
 * `{taxNote}`, `{productName}` — see `content/schema.ts`'s `PLACEHOLDERS`)
 * against `storefront/mock/catalogue.json`.
 *
 * Two previous reviewers correctly declined to resolve these: `content/` was
 * not theirs, so the mockups render the literal placeholder text. Resolving
 * them is this unit's job, and the checkbox says how — "render every price
 * and availability string from data, never hardcoded. The €25 in the
 * homepage CTA is content bound to the catalogue, not a literal." This module
 * is that binding.
 *
 * `storefront/mock/catalogue.json` is a contract, not a fixture: it mirrors
 * the values Task 5's live catalogue will be seeded with, so a page built
 * against it composes identically once Task 5 swaps the data layer
 * underneath — see that file's own `$comment` and `tests/catalogue.test.ts`.
 *
 * Only the four **catalogue**-sourced placeholders are resolved here.
 * `content/schema.ts`'s `PLACEHOLDERS` also declares several
 * **configuration**-sourced ones (`merchantContactAddress`,
 * `merchantLegalName`, …) that belong to the legal pages this unit does not
 * touch; `resolveCataloguePlaceholders` leaves any token it does not
 * recognise exactly as it found it; rather than resolving it, replacing it
 * with an empty string, or throwing, so a legal-page string that also
 * happens to run through this function is unaffected.
 */

import catalogueSource from "../../mock/catalogue.json";

export type CatalogueAvailability = "InStock" | "OutOfStock" | "PreOrder" | "SoldOut";

export interface CatalogueProduct {
  readonly name: string;
  readonly price: {
    readonly amount: number;
    readonly currency: string;
    readonly taxIncluded: boolean;
  };
  readonly availability: CatalogueAvailability;
  readonly players: { readonly min: number; readonly max: number };
  readonly playtimeMinutes: number;
  readonly setupMinutes: number;
  readonly cardCount: number;
  readonly ageRange: string;
}

interface CatalogueFile {
  readonly product: CatalogueProduct;
}

/** The raw, parsed contents of `mock/catalogue.json`, typed. */
export const mockCatalogue: CatalogueProduct = (catalogueSource as CatalogueFile).product;

export interface ResolvedCatalogue {
  readonly productName: string;
  /** Formatted with currency, e.g. "€25.00". */
  readonly price: string;
  /** The full line the checkout-facing copy quotes: price, tax note and shipping note together. */
  readonly priceLine: string;
  /** The short tax presentation note that accompanies the price on its own. */
  readonly taxNote: string;
  readonly availability: CatalogueAvailability;
  /** True when {@link availability} is `"InStock"` — the only state this catalogue is ever seeded with today. */
  readonly inStock: boolean;
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount / 100);
}

/**
 * Resolves the mock catalogue into the display strings `content/`'s
 * placeholders stand in for. A pure function of the parsed catalogue, not a
 * singleton, so a test can resolve a different fixture without touching
 * `process.env` or module state — nothing here is per-environment
 * configuration; it is the same for every deployment until Task 5 replaces
 * it with a real Medusa lookup.
 */
export function resolveCatalogue(product: CatalogueProduct = mockCatalogue): ResolvedCatalogue {
  const price = formatPrice(product.price.amount, product.price.currency);
  const taxNote = product.price.taxIncluded ? "VAT included" : "VAT calculated at checkout";
  const priceLine = `${price}, ${taxNote}. Shipping calculated at checkout.`;

  return {
    productName: product.name,
    price,
    priceLine,
    taxNote,
    availability: product.availability,
    inStock: product.availability === "InStock",
  };
}

/**
 * Every `{token}` this function knows how to resolve, keyed exactly like
 * `content/schema.ts`'s `PLACEHOLDERS` — a subset of it, the catalogue-
 * sourced quarter. See this module's doc comment for why the configuration-
 * sourced remainder is deliberately left alone.
 */
const CATALOGUE_PLACEHOLDER_RESOLVERS: Readonly<Record<string, (catalogue: ResolvedCatalogue) => string>> = {
  price: (catalogue) => catalogue.price,
  priceLine: (catalogue) => catalogue.priceLine,
  taxNote: (catalogue) => catalogue.taxNote,
  productName: (catalogue) => catalogue.productName,
};

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/**
 * Substitutes every catalogue-sourced `{token}` in `text` for its resolved
 * value. A token this module does not recognise (a configuration-sourced
 * one, or plain text that happens to contain braces) is left exactly as
 * written — never dropped, never replaced with an empty string — so calling
 * this on a string that mixes catalogue and configuration placeholders is
 * always safe.
 */
export function resolveCataloguePlaceholders(text: string, catalogue: ResolvedCatalogue): string {
  return text.replaceAll(PLACEHOLDER_PATTERN, (whole, token: string) => {
    const resolve = CATALOGUE_PLACEHOLDER_RESOLVERS[token];
    return resolve ? resolve(catalogue) : whole;
  });
}
