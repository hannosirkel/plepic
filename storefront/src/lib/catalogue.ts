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
 * resolved **here** rather than only on the legal page precisely so the two
 * cannot drift: every surface that qualifies the price reads those words out
 * of this one function — the purchase panel and the product hero through
 * {@link ResolvedCatalogue.priceTaxQualifier}, the basket and checkout
 * summaries through {@link ResolvedCatalogue.priceQualifiers}, the shipping
 * FAQ through {@link ResolvedCatalogue.priceLine} — and `/legal/shipping`
 * carries the same words as content.
 *
 * The same answer removed `taxNote`. It resolved to the bare "VAT included"
 * alone, nothing rendered it, and a live resolver for a string we have decided
 * is misleading is a hazard rather than an asset. Its declaration in
 * `content/schema.ts`, its resolver below and the set-equality pin in
 * `tests/catalogue.test.ts` were removed together, so no guard had to be
 * weakened to let one of the three go first.
 *
 * ## The operator's *format* is part of the answer too — 2026-08-10
 *
 * Carrying the operator's **words** into `priceQualifiers` was only half of
 * it. The supplied wording is two lines, the first emphasised:
 *
 * > **{price} · VAT included where applicable**
 * > Shipping calculated at checkout. Non-EU taxes and duties, if any, are not
 * > included.
 *
 * One string cannot express a line break that is also a change of emphasis,
 * so a component handed `priceQualifiers` and a price had no way to put the
 * boundary where the operator put it — and both product surfaces put it
 * somewhere else, with the tax qualification in the same small print as the
 * shipping note. {@link ResolvedCatalogue.priceHeadline},
 * {@link ResolvedCatalogue.priceTaxQualifier} and
 * {@link ResolvedCatalogue.priceShippingNote} are the operator's own three
 * parts, so the boundary is data rather than each component's reading of it.
 * `priceQualifiers` stays, unchanged, for the surfaces that present no
 * headline price at all.
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
  /** Formatted with currency, e.g. "€25.00". A bare figure and nothing else. */
  readonly price: string;
  /**
   * The tax qualification alone, in the operator's words — the half of
   * {@link priceHeadline} that follows the figure.
   *
   * It is a **separate field from {@link priceShippingNote} because the
   * operator's format puts a line break and a change of emphasis between the
   * two**, and a component cannot honour a boundary it is handed as one
   * string. See {@link priceHeadline}.
   */
  readonly priceTaxQualifier: string;
  /**
   * The shipping and duties sentence, in the operator's words — the
   * unemphasised second line of the operator's format.
   */
  readonly priceShippingNote: string;
  /**
   * The operator's emphasised line, whole:
   * `${price}${PRICE_HEADLINE_SEPARATOR}${priceTaxQualifier}` — e.g.
   * "€25.00 · VAT included where applicable".
   *
   * **This is the operator's boundary, and it is not the one the page used to
   * draw.** The supplied wording of 2026-08-10 is two lines, the first
   * emphasised: the figure *and* the tax qualification above, the shipping
   * and duties sentence below. `/legal/shipping` rendered that correctly from
   * the first revision (its `callout` carries `lead` and `detail`
   * separately); the purchase panel and the product hero did not — they put
   * the figure in the emphasised slot and {@link priceQualifiers}, tax note
   * and all, in the small print. So "VAT included where applicable" was
   * small print on the two most prominent surfaces on the site and an
   * emphasised line on the least prominent one.
   *
   * Composed here rather than in each component so the two surfaces cannot
   * drift from each other or from the legal page:
   * `tests/catalogue.test.ts` pins this string against its three parts, and
   * `tests/legal-pages.test.tsx` pins `content/legal/shipping.ts`'s resolved
   * callout lead against this exact value.
   *
   * **No component renders this string itself.** Both surfaces compose its
   * two halves as **two elements** — the figure at display size, the
   * separator and qualification at reading size, in one inline flow — because
   * the wrap this format would otherwise cause is a typographic problem and
   * gets a typographic answer. What the field is for is that the composed
   * markup and the pinned line cannot disagree:
   * `tests/price-presentation.test.tsx` reads the emphasised element's text
   * back and compares it to this value. See `purchase-panel.module.css`.
   */
  readonly priceHeadline: string;
  /**
   * Everything that qualifies the price without being the figure — the tax
   * qualification, the shipping note and the non-EU duties disclosure, in the
   * operator's own words, as one string.
   *
   * **This is the shape for a surface that presents no headline price**, and
   * after the price-presentation unification that is exactly the two it is
   * still used on: the basket and checkout summaries, where the qualifiers
   * are a note under a `<dl>` of goods, shipping and total rather than
   * something beside a display figure. A surface that *does* present a
   * headline price renders {@link priceHeadline} and
   * {@link priceShippingNote} instead, so the operator's emphasis boundary
   * survives; prose that quotes the price mid-paragraph renders
   * {@link priceLine}.
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
 * What sits between the figure and the tax qualification on the operator's
 * emphasised line — a spaced middle dot, exactly as the operator wrote it and
 * exactly as `content/legal/shipping.ts`'s callout `lead` carries it.
 *
 * Exported because a component that renders the figure at display size and
 * the qualification at reading size needs the two halves as separate nodes,
 * and the separator therefore has to be written somewhere other than inside
 * either half. `tests/catalogue.test.ts` pins
 * {@link ResolvedCatalogue.priceHeadline} against
 * `price + PRICE_HEADLINE_SEPARATOR + priceTaxQualifier`, so a component that
 * splits the line and this constant cannot disagree about what the whole line
 * says.
 */
export const PRICE_HEADLINE_SEPARATOR = " · ";

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
  const priceHeadline = `${price}${PRICE_HEADLINE_SEPARATOR}${taxQualifier}`;
  const priceLine = `${price}, ${priceQualifiers}`;
  const inStock = product.availability === "InStock";

  return {
    productName: product.name,
    price,
    priceTaxQualifier: taxQualifier,
    priceShippingNote: shippingNote,
    priceHeadline,
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
