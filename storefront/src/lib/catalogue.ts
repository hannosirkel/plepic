/**
 * Resolves `content/`'s catalogue placeholders (`{price}`, `{priceNet}`,
 * `{priceGross}`, `{priceVat}`, `{vatRate}`, `{priceTaxQualifier}`,
 * `{priceLine}`, `{productName}` — see `content/schema.ts`'s `PLACEHOLDERS`)
 * against `storefront/mock/catalogue.json`, **for a destination**.
 *
 * ## The axis is the destination, not a boolean — 2026-08-18
 *
 * This module used to branch on `product.price.taxIncluded`: *"VAT included
 * where applicable"* when it was true, *"VAT calculated at checkout"* when it
 * was false. The commercial model the operator settled makes both wrong, and
 * makes the boolean the wrong axis to have branched on.
 *
 * EUR 25.00 is the **net** price. Estonian VAT at the rate
 * `backend/src/commerce/tax-model.ts` declares is added for a delivery address
 * in the EU, and is not added anywhere else. So there is no figure that is
 * simply "the price": there is EUR 31.00 for an EU destination and EUR 25.00
 * for every other one, and `taxIncluded` — which is Medusa's
 * `is_calculated_price_tax_inclusive`, a statement about how the *stored* price
 * is expressed — cannot tell those two apart. {@link resolveCatalogue}
 * therefore takes a {@link Destination}, and every string it composes carries
 * that destination in it.
 *
 * ## Nothing here computes VAT
 *
 * **There is no rate in this file and no arithmetic that applies one.** Medusa
 * returns both amounts — `calculated_amount_without_tax` and
 * `calculated_amount_with_tax` — and `src/lib/store-product.ts` carries both
 * out; this module *chooses* between them on the destination and formats the
 * one that applies. The only arithmetic is
 * {@link CatalogueProduct.price.amountWithTax} minus
 * {@link CatalogueProduct.price.amount}, which names the difference between two
 * authoritative figures rather than deriving either of them, and is what
 * `{priceVat}` resolves to.
 *
 * `vatRatePercent` is carried through the catalogue for the same reason: the
 * copy has to *quote* a rate and this workspace must not *know* one. It is data pinned to `ESTONIAN_STANDARD_VAT_PERCENT` from the backend
 * side in `backend/tests/commerce-product-seed.test.ts`, and
 * `tests/no-hardcoded-price.test.ts` refuses a rate literal anywhere in `src/`,
 * this file included.
 *
 * ## The figure never renders alone
 *
 * The destination selector defaults to the United States, so a visitor who
 * never touches it is quoted EUR 25.00 — including an EU visitor, who will be
 * charged EUR 31.00 once their delivery address is known. The operator made
 * that choice knowing the consequence, and **the mitigation that keeps it
 * honest is that the figure always carries its destination and its tax state
 * with it**: {@link ResolvedCatalogue.priceTaxQualifier} is *"No VAT added,
 * delivering to United States"*, not a decoration on the price but the other
 * half of what the price means. `src/lib/destination.ts` carries the rest of
 * that argument.
 *
 * ## The operator's *format* is part of the answer too — 2026-08-10
 *
 * The supplied wording is two lines, the first emphasised:
 *
 * > **{price} · {priceTaxQualifier}**
 * > Shipping is calculated at checkout, and VAT is added to it for delivery
 * > inside the European Union. Non-EU taxes and duties, if any, are not
 * > included.
 *
 * One string cannot express a line break that is also a change of emphasis, so
 * a component handed one string had no way to put the boundary where the
 * operator put it — and both product surfaces put it somewhere else, with the
 * tax qualification in the same small print as the shipping note.
 * {@link ResolvedCatalogue.priceHeadline},
 * {@link ResolvedCatalogue.priceTaxQualifier} and
 * {@link ResolvedCatalogue.priceShippingNote} are the operator's own three
 * parts, so the boundary is data rather than each component's reading of it.
 *
 * {@link ResolvedCatalogue.priceTaxBreakdown} is a **fourth** part rather than
 * an extension of the shipping note, and for exactly the reason above: what
 * the figure is made of — the price before tax, the tax on it, and the rate —
 * is a different claim from what is *not* in the figure, and a surface handed
 * the two joined cannot separate them again.
 *
 * `priceQualifiers` stays, unchanged in shape, for the surfaces that present no
 * headline price at all.
 *
 * ## What is resolved here, and what is not
 *
 * Only the **catalogue**-sourced placeholders. `content/schema.ts`'s
 * `PLACEHOLDERS` also declares several **configuration**-sourced ones
 * (`merchantContactAddress`, `merchantLegalName`, …);
 * `resolveCataloguePlaceholders` leaves any token it does not recognise exactly
 * as it found it — never resolved, never emptied, never thrown on — so calling
 * it on a string that mixes the two is always safe.
 *
 * `storefront/mock/catalogue.json` is a contract, not a fixture: it mirrors the
 * values the live catalogue is seeded with, so a page built against it composes
 * identically once a live read is underneath — see that file's own `$comment`,
 * `tests/catalogue.test.ts` and `backend/tests/commerce-product-seed.test.ts`.
 */

import catalogueSource from "../../mock/catalogue.json";
import { DEFAULT_LOCALE, type Locale } from "../../../content/routes.js";
import { defaultDestination, destinationNameIn, type Destination } from "./destination.js";

export type CatalogueAvailability = "InStock" | "OutOfStock" | "PreOrder" | "SoldOut";

export interface CatalogueProduct {
  readonly name: string;
  readonly price: {
    /**
     * Minor units, **net of tax** — Medusa's `calculated_amount_without_tax`.
     * The figure a buyer outside the EU pays for the goods.
     */
    readonly amount: number;
    /**
     * Minor units, **including EU VAT** — Medusa's
     * `calculated_amount_with_tax`. The figure a buyer with an EU delivery
     * address pays for the goods.
     *
     * Read from Medusa rather than derived: `src/lib/store-product.ts` refuses
     * a Store response that does not carry it, because falling back to the net
     * figure would advertise EUR 25.00 to a buyer who is charged EUR 31.00.
     */
    readonly amountWithTax: number;
    readonly currency: string;
    /**
     * Medusa's `is_calculated_price_tax_inclusive` — whether the *stored*
     * price contains the tax.
     *
     * It is **not** the axis anything is presented on; see this module's doc
     * comment. It is carried because it says which of the two amounts above is
     * the stored one, which is what `store-product.ts` checks the response's
     * own consistency against.
     */
    readonly taxIncluded: boolean;
    /**
     * The VAT rate this deployment charges an EU destination, as a whole
     * percentage — a figure to **state**, never to multiply by. See this
     * module's doc comment.
     */
    readonly vatRatePercent: number;
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
  /** The destination every figure below is quoted for — see {@link priceTaxQualifier}. */
  readonly destinationName: string;
  /** ISO 3166-1 alpha-2, so a control can select the current destination back. */
  readonly destinationCode: string;
  /** True when {@link destinationName} is an EU member state and VAT is therefore added. */
  readonly vatApplies: boolean;
  /**
   * The figure this destination is quoted, formatted with its currency — e.g.
   * "€31.00" for an EU destination and "€25.00" for any other. A bare figure
   * and nothing else.
   *
   * **It is never rendered on its own.** It is one destination's answer, not
   * "the price", and a surface that paints it without
   * {@link priceTaxQualifier} beside it has told a visitor something that is
   * true of somebody else.
   */
  readonly price: string;
  /** The net figure, formatted — the same everywhere. */
  readonly priceNet: string;
  /** The EU gross figure, formatted — {@link priceNet} plus {@link priceVat}. */
  readonly priceGross: string;
  /** The VAT an EU destination is charged on the goods, formatted. */
  readonly priceVat: string;
  /** The rate the copy quotes, e.g. "24%". Stated, never applied. */
  readonly vatRate: string;
  /**
   * The tax qualification alone, in the operator's words — the half of
   * {@link priceHeadline} that follows the figure, and the half that says
   * **which destination the figure belongs to**.
   *
   * It is a separate field from {@link priceShippingNote} because the
   * operator's format puts a line break and a change of emphasis between the
   * two, and a component cannot honour a boundary it is handed as one string.
   */
  readonly priceTaxQualifier: string;
  /**
   * The net/VAT split, as one sentence fragment: the gross figure, the figure
   * before tax it is built from, the tax between them and the rate, for an EU
   * destination — and for any other, the figure with a statement that nothing
   * was added to it.
   *
   * The **fourth** part, deliberately not folded into
   * {@link priceShippingNote}: what the figure is made of and what is *not* in
   * it are two claims, and a surface handed them joined cannot separate them
   * again. It is never empty — a destination with no VAT gets the sentence that
   * says so, on the same principle that makes `cart.ts` answer `null` rather
   * than a formatted zero.
   */
  readonly priceTaxBreakdown: string;
  /**
   * The shipping and duties sentence, in the operator's words — the
   * unemphasised second line of the operator's format.
   */
  readonly priceShippingNote: string;
  /**
   * The operator's emphasised line, whole:
   * `${price}${PRICE_HEADLINE_SEPARATOR}${priceTaxQualifier}` — e.g.
   * "€25.00 · No VAT added, delivering to United States".
   *
   * Composed here rather than in each component so the two product surfaces
   * cannot drift from each other or from the legal page:
   * `tests/catalogue.test.ts` pins this string against its parts, and
   * `tests/legal-pages.test.tsx` pins `content/legal/shipping.ts`'s resolved
   * callout lead against this exact value.
   *
   * **No component renders this string itself.** Both surfaces compose its two
   * halves as **two elements** — the figure at display size, the separator and
   * qualification at reading size, in one inline flow — because the wrap this
   * format would otherwise cause is a typographic problem and gets a
   * typographic answer. What the field is for is that the composed markup and
   * the pinned line cannot disagree:
   * `tests/price-presentation.test.tsx` reads the emphasised element's text
   * back and compares it to this value. See `purchase-panel.module.css`.
   */
  readonly priceHeadline: string;
  /**
   * Everything that qualifies the price without being the figure — the tax
   * qualification with its destination, the shipping note and the non-EU
   * duties disclosure, in the operator's own words, as one string.
   *
   * **This is the shape for a surface that presents no headline price**: the
   * basket and checkout summaries, where the qualifiers are a note under a
   * `<dl>` of goods, shipping and total rather than something beside a display
   * figure. A surface that *does* present a headline price renders
   * {@link priceHeadline} and {@link priceShippingNote} instead, so the
   * operator's emphasis boundary survives; prose that quotes the price
   * mid-paragraph renders {@link priceLine}.
   */
  readonly priceQualifiers: string;
  /** The full line the checkout-facing copy quotes: the price and its qualifiers together. */
  readonly priceLine: string;
  /**
   * "VAT included", or `""` when {@link price} does not include VAT.
   *
   * **Derived from {@link vatApplies} — the same value that already decides
   * whether {@link price} is the gross or the net figure — and from nothing
   * else.** That is deliberate, not a convenience: `content/schema.ts`
   * records that a `taxNote` placeholder resolving to a bare "VAT included"
   * was removed on 2026-08-10 because it rendered regardless of destination,
   * which stated something false on an export. A separate flag a later edit
   * could set independently of `vatApplies` would be exactly that defect
   * again, one property away. Composed here, beside `price` itself, so it is
   * structurally impossible for the two to disagree — there is no path that
   * produces a net {@link price} and a non-empty {@link vatIncludedNote}
   * together, because both read the one boolean.
   *
   * The operator's instruction this answers is the opposite of the claim that
   * was removed: not "always say VAT is included", but "say so when it
   * genuinely is" — see `content/publisher.ts`'s `homepageCallsToAction`,
   * whose "Buy for {price}" entry is the one surface that renders this today.
   */
  readonly vatIncludedNote: string;
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
 * The tax vocabulary, per published edition.
 *
 * ## Why this is here at all, and why it is not one language
 *
 * The qualification is composed **once** so that no surface can drift from the
 * legal page — that is the reason this module composes it rather than each
 * component. The cost of composing it once is that it is composed in one
 * language, and until 2026-08-18 that language was English on every page,
 * including `/et/legal/shipping`, where the qualification is the emphasised
 * first line under the heading of an approved legal notice.
 *
 * That was recorded as a known limitation and it was the wrong call: an
 * English sentence on an Estonian legal page is not a rough edge, it is the
 * page failing to be the edition it claims to be. So the composition takes a
 * locale, and this table is what it composes from.
 *
 * ## What is localised, and what deliberately is not
 *
 * Only the strings a **localised page can render**. `LOCALIZED_ROUTE_VIEWS`
 * serves the legal set and nothing else, and the only catalogue tokens those
 * pages use are `{price}`, `{priceNet}`, `{priceGross}`, `{priceVat}` and
 * `{vatRate}` — all figures, formatted by `Intl` — plus
 * `{priceTaxQualifier}`, which is prose. The shipping note reaches the same
 * page through the pin against `callout.detail`. Both are here.
 *
 * {@link ResolvedCatalogue.availabilityLabel} and
 * {@link ResolvedCatalogue.playerCount} are **not**, and that is not an
 * oversight: they are rendered only by the product surfaces, which have no
 * localised route to be rendered on. `tests/legal-pages.test.tsx` asserts the
 * set of catalogue tokens a localised page uses is exactly the set this table
 * covers, so a translator who writes `{productName}` into an Estonian page
 * gets a red test rather than an English word.
 *
 * The figures are shared rather than duplicated per locale. `Intl` formats
 * "€25.00" and "24%" identically for both editions today, and a table entry
 * per language would be two places for one fact to be wrong in.
 */
interface TaxVocabulary {
  /** The qualification for a destination that attracts VAT. */
  readonly vatAdded: (destination: string) => string;
  /** The qualification for a destination that does not. */
  readonly noVatAdded: (destination: string) => string;
  /**
   * The secondary "VAT included" text under a price that includes it — see
   * {@link ResolvedCatalogue.vatIncludedNote}. Not composed from
   * {@link vatAdded}: that sentence names the destination ("VAT added,
   * delivering to Estonia") and belongs beside a headline price with room for
   * a full clause, where this is a short label beneath a button.
   */
  readonly vatIncludedNote: string;
  /**
   * The shipping and duties sentence — the operator's unemphasised second
   * line. The same words for every destination, because it describes a rule
   * rather than a figure: shipping is quoted before tax, VAT is added to it
   * inside the EU, and destination taxes outside the EU are somebody else's to
   * charge. `content/legal/shipping.ts`'s callout `detail` carries the English
   * one and `content/legal/et/shipping.ts` the Estonian, and
   * `tests/legal-pages.test.tsx` pins each edition's against this table.
   */
  readonly shippingNote: string;
  readonly breakdownWithVat: (
    gross: string,
    net: string,
    vat: string,
    rate: string,
  ) => string;
  readonly breakdownWithoutVat: (net: string) => string;
  /** How the qualification and the shipping note join into one string. */
  readonly qualifiers: (qualifier: string, note: string) => string;
  /** How a figure and its qualifiers join into a line quoted mid-paragraph. */
  readonly line: (price: string, qualifiers: string) => string;
}

const TAX_VOCABULARY: Readonly<Record<Locale, TaxVocabulary>> = {
  en: {
    vatAdded: (destination) => `VAT added, delivering to ${destination}`,
    noVatAdded: (destination) => `No VAT added, delivering to ${destination}`,
    vatIncludedNote: "VAT included",
    shippingNote:
      "Shipping is calculated at checkout, and VAT is added to it for delivery inside the " +
      "European Union. Non-EU taxes and duties, if any, are not included.",
    breakdownWithVat: (gross, net, vat, rate) => `${gross} is ${net} plus ${vat} VAT at ${rate}`,
    breakdownWithoutVat: (net) => `${net}, with no VAT added`,
    qualifiers: (qualifier, note) => `${qualifier}. ${note}`,
    line: (price, qualifiers) => `${price}, ${qualifiers}`,
  },
  et: {
    vatAdded: (destination) => `käibemaks lisatud, kättetoimetamisel sihtkohta ${destination}`,
    noVatAdded: (destination) =>
      `käibemaksu ei lisata, kättetoimetamisel sihtkohta ${destination}`,
    vatIncludedNote: "Käibemaks sisaldub",
    shippingNote:
      "Saatekulu arvutatakse tellimuse vormistamisel ja Euroopa Liidu sisese kättetoimetamise " +
      "puhul lisandub sellele käibemaks. Väljaspool Euroopa Liitu kohalduvad maksud ja lõivud, " +
      "kui neid on, hinnas ei sisaldu.",
    breakdownWithVat: (gross, net, vat, rate) =>
      `${gross} on ${net} pluss ${vat} käibemaksu määraga ${rate}`,
    breakdownWithoutVat: (net) => `${net}, käibemaksu ei lisata`,
    qualifiers: (qualifier, note) => `${qualifier}. ${note}`,
    line: (price, qualifiers) => `${price}, ${qualifiers}`,
  },
};

/**
 * Resolves the catalogue into the display strings `content/`'s placeholders
 * stand in for, **for one destination**.
 *
 * A pure function of the product and the destination, not a singleton, so a
 * test — or a server component that has just read the destination cookie — can
 * resolve a different pair without touching `process.env` or module state.
 *
 * The destination defaults to the operator's declared default rather than to
 * "no destination", because there is no such thing as a figure belonging to no
 * destination and a caller that omitted one would otherwise have to be handed a
 * fiction. What that default is, and why the resulting figure is always
 * qualified rather than bare, is in `src/lib/destination.ts`.
 *
 * The locale defaults to the default edition. It is a parameter because the
 * qualification is **prose**, it reaches `/et/legal/shipping`, and an approved
 * Estonian legal page may not carry an English sentence — see
 * {@link TAX_VOCABULARY}.
 */
export function resolveCatalogue(
  product: CatalogueProduct = mockCatalogue,
  destination: Destination = defaultDestination,
  locale: Locale = DEFAULT_LOCALE,
): ResolvedCatalogue {
  const currency = product.price.currency;
  const words = TAX_VOCABULARY[locale];
  const vatApplies = destination.euMember;
  /*
   * The choice, and the whole of it: two amounts Medusa computed, and a
   * destination that says which one this visitor is being quoted. No rate is
   * read and none is applied — see this module's doc comment.
   */
  const price = formatPrice(vatApplies ? product.price.amountWithTax : product.price.amount, currency);
  const priceNet = formatPrice(product.price.amount, currency);
  const priceGross = formatPrice(product.price.amountWithTax, currency);
  const priceVat = formatPrice(product.price.amountWithTax - product.price.amount, currency);
  const vatRate = `${String(product.price.vatRatePercent)}%`;
  const destinationName = destinationNameIn(destination, locale);

  /*
   * The destination is inside the qualification rather than beside it. A buyer
   * reading a bare figure has been told what one destination pays; a buyer
   * reading it with "No VAT added, delivering to United States" after it has
   * been told what they are looking at, and that it is a thing they can
   * change. That is the mitigation the operator's default depends on.
   */
  const taxQualifier = vatApplies
    ? words.vatAdded(destinationName)
    : words.noVatAdded(destinationName);
  const taxBreakdown = vatApplies
    ? words.breakdownWithVat(priceGross, priceNet, priceVat, vatRate)
    : words.breakdownWithoutVat(priceNet);

  const priceQualifiers = words.qualifiers(taxQualifier, words.shippingNote);
  const priceHeadline = `${price}${PRICE_HEADLINE_SEPARATOR}${taxQualifier}`;
  const priceLine = words.line(price, priceQualifiers);
  const inStock = product.availability === "InStock";
  /*
   * The one boolean, read once, for both `price` above and this note — see
   * {@link ResolvedCatalogue.vatIncludedNote}. `words.vatIncludedNote` is
   * per-locale for the same reason every other word in this table is.
   */
  const vatIncludedNote = vatApplies ? words.vatIncludedNote : "";

  return {
    productName: product.name,
    destinationName,
    destinationCode: destination.code,
    vatApplies,
    price,
    priceNet,
    priceGross,
    priceVat,
    vatRate,
    priceTaxQualifier: taxQualifier,
    priceTaxBreakdown: taxBreakdown,
    priceShippingNote: words.shippingNote,
    priceHeadline,
    priceQualifiers,
    priceLine,
    vatIncludedNote,
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
 * sourced part. See this module's doc comment for why the configuration-
 * sourced remainder is deliberately left alone.
 *
 * `tests/catalogue.test.ts` asserts this table's keys are **exactly** the
 * placeholders `content/schema.ts` marks `source: "catalogue"`, in both
 * directions. That is what stops a token being declared here and not there, or
 * the reverse — and it is why the five placeholders the operator's replacement
 * VAT copy needs (`{priceNet}`, `{priceGross}`, `{priceVat}`, `{vatRate}`,
 * `{priceTaxQualifier}`) had to be added to both tables in one change.
 */
const CATALOGUE_PLACEHOLDER_RESOLVERS: Readonly<Record<string, (catalogue: ResolvedCatalogue) => string>> = {
  price: (catalogue) => catalogue.price,
  priceGross: (catalogue) => catalogue.priceGross,
  priceLine: (catalogue) => catalogue.priceLine,
  priceNet: (catalogue) => catalogue.priceNet,
  priceTaxQualifier: (catalogue) => catalogue.priceTaxQualifier,
  priceVat: (catalogue) => catalogue.priceVat,
  productName: (catalogue) => catalogue.productName,
  vatRate: (catalogue) => catalogue.vatRate,
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
