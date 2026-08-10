/**
 * Resolves `content/`'s catalogue placeholders (`{price}`, `{priceLine}`,
 * `{productName}` — see `content/schema.ts`'s `PLACEHOLDERS`) against
 * `storefront/mock/catalogue.json`.
 *
 * ## The tax qualification is the operator's wording, 2026-08-10
 *
 * {@link ResolvedCatalogue.priceQualifiers} used to open with a flat *"VAT
 * included"*. That is untrue of an export, where no EU VAT is due, which is why
 * the second qualified read struck the same claim off `/legal/shipping`
 * (Minor 2) — leaving the product page asserting unqualified what the legal
 * page had just qualified. The operator supplied the replacement, and it is
 * used **here** rather than only on the legal page precisely so the two cannot
 * drift: the purchase panel, the product hero and the shipping FAQ all read
 * this one string, and `/legal/shipping` carries the same words as content.
 *
 * The same answer removed `taxNote`. It resolved to the bare "VAT included"
 * alone, nothing rendered it, and a live resolver for a string we have decided
 * is misleading is a hazard rather than an asset. Its declaration in
 * `content/schema.ts`, its resolver below and the set-equality pin in
 * `tests/catalogue.test.ts` were removed together, so no guard had to be
 * weakened to let one of the three go first.
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
 * Only the three **catalogue**-sourced placeholders are resolved here.
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
  /** Formatted with currency, e.g. "€25.00". A bare figure and nothing else: this is the headline slot. */
  readonly price: string;
  /**
   * Everything that qualifies the price without being the figure — the tax
   * qualification, the shipping note and the non-EU duties disclosure, in the
   * operator's own words.
   *
   * It exists because {@link priceLine} is a *sentence*. That is right where
   * prose quotes the price mid-paragraph, and wrong in a display-sized
   * headline slot, where it wrapped over five lines at 1280 and six at 320
   * and was then followed by a second line repeating the tax note on its
   * own. A price component renders {@link price} large and this small; prose
   * renders {@link priceLine}.
   */
  readonly priceQualifiers: string;
  /** The full line the checkout-facing copy quotes: the price and its qualifiers together. */
  readonly priceLine: string;
  readonly availability: CatalogueAvailability;
  /** True when {@link availability} is `"InStock"` — the only state this catalogue is ever seeded with today. */
  readonly inStock: boolean;
  /** The stock statement a buyer reads, derived from {@link availability} and never written as a literal. */
  readonly availabilityLabel: string;
  /** The player range as one phrase, e.g. "2–6 players". */
  readonly playerCount: string;
  /**
   * The age marking, e.g. "10+" — a **safety** marking for the product
   * rather than a difficulty rating. `FeatureSpecStrip.tsx` renders it and
   * words that distinction.
   */
  readonly ageRange: string;
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
  /*
   * "where applicable", not a flat assertion: the same figure is charged to a
   * buyer in the EU, where VAT is due and is inside it, and to a buyer outside
   * it, where no EU VAT is due at all. The operator supplied both halves —
   * this and the duties sentence — on 2026-08-10, and `/legal/shipping`'s VAT
   * section carries the identical words as content.
   */
  const taxQualifier = product.price.taxIncluded
    ? "VAT included where applicable"
    : "VAT calculated at checkout";
  const shippingNote =
    "Shipping calculated at checkout. Non-EU taxes and duties, if any, are not included.";
  const priceQualifiers = `${taxQualifier}. ${shippingNote}`;
  const priceLine = `${price}, ${priceQualifiers}`;
  const inStock = product.availability === "InStock";

  return {
    productName: product.name,
    price,
    priceQualifiers,
    priceLine,
    availability: product.availability,
    inStock,
    availabilityLabel: inStock ? "In stock" : "Out of stock",
    playerCount: `${product.players.min}–${product.players.max} players`,
    ageRange: product.ageRange,
  };
}

/**
 * Every `{token}` this function knows how to resolve, keyed exactly like
 * `content/schema.ts`'s `PLACEHOLDERS` — a subset of it, the catalogue-
 * sourced quarter. See this module's doc comment for why the configuration-
 * sourced remainder is deliberately left alone.
 *
 * `tests/catalogue.test.ts` asserts this table's keys are **exactly** the
 * placeholders `content/schema.ts` marks `source: "catalogue"`, in both
 * directions. That is what stopped `taxNote` being removed here and left
 * declared there, or the reverse.
 */
const CATALOGUE_PLACEHOLDER_RESOLVERS: Readonly<Record<string, (catalogue: ResolvedCatalogue) => string>> = {
  price: (catalogue) => catalogue.price,
  priceLine: (catalogue) => catalogue.priceLine,
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
