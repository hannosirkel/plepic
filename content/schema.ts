/**
 * The content model.
 *
 * Content on this site is typed TypeScript rather than MDX, for one reason:
 * the plan's prohibitions have to be structural. MDX is a document format —
 * it will happily accept an absolute URL, a hostname or a hard-coded price and
 * only a linter would notice. Here, the type system simply offers no slot for
 * any of them:
 *
 *   - **No absolute URL is expressible.** There is no `href`, `url` or `link`
 *     field of type `string` anywhere in this file. A link is a
 *     {@link LinkTarget}: either an internal {@link RouteId} or a named
 *     {@link ExternalTargetId} that runtime configuration resolves.
 *   - **No hostname is expressible.** Nothing takes a host. The canonical host,
 *     the base URL and every external URL live in configuration.
 *   - **No price is expressible.** There is no amount, no currency and no
 *     numeric price field. Copy that must state a price uses a
 *     {@link PlaceholderToken} such as `{price}`, resolved from the catalogue
 *     at render time.
 *   - **No unkeyed proof claim is expressible.** Every quotation and every
 *     proof item requires a {@link SourceId}, and every id must exist in the
 *     registry in `evidence.ts`.
 *   - **No award is expressible.** {@link SourcePresentation} has no `"award"`
 *     member and never will; the one review mention the site carries is a pick
 *     in a video, not a laurel.
 *
 * What the type system cannot catch is a raw literal sitting inside a prose
 * string. `content.test.ts` catches that: it reads every content source file as
 * text and fails the build on a URL scheme, a hostname, an email address, a
 * currency symbol or amount, or a placeholder that is not in the registry
 * below. Between the two, an absolute URL, a hostname or a hard-coded price in
 * a content file is either impossible or a red build.
 */

import type { AnchorId, ExternalTargetId, RetiredRouteId, RouteId } from "./routes.js";
import { RETIRED_ROUTES } from "./routes.js";
import { LOCALES, type Locale } from "./routes.js";

/* ------------------------------------------------------------------------
 * The locale dimension
 * --------------------------------------------------------------------- */

/**
 * Content published per locale.
 *
 * The whole mechanism is that this is a **total** `Record<Locale, T>` rather
 * than a partial map or an array of `{ locale, value }` pairs. A partial map
 * makes an unregistered locale a runtime `undefined` nobody notices until a
 * page renders blank; a total record makes it a compile error at the one
 * place the omission actually is. Adding a member to `LOCALES` therefore
 * produces a list of exactly the registries that still need filling, from the
 * type checker, on the first build — which is what "adding a locale is a
 * registration" is supposed to mean.
 *
 * **A locale need not carry every page.** {@link LocalizedContent} is
 * per-registry, so an edition may publish the legal set and not the marketing
 * set; what it may not do is publish a page whose renderer would silently
 * serve another locale's words. `storefront/tests/locale-routing.test.ts`
 * holds that line, because renderers live there and not here.
 */
export type LocalizedContent<T> = Readonly<Record<Locale, T>>;

/** The content registered for `locale`. Total by construction — see {@link LocalizedContent}. */
export function contentFor<T>(registry: LocalizedContent<T>, locale: Locale): T {
  return registry[locale];
}

/** True when `value` is a declared locale. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------------
 * Sources
 * --------------------------------------------------------------------- */

/**
 * Identifiers of entries in the operator's ignored evidence manifest.
 *
 * `E1`–`E16` key one-to-one to numbered entries there. `official-wording`,
 * `rulebook-victory-conditions`, `components` and `rulebook` key to its
 * verbatim sections. **Every member of this union has an entry behind it.** An
 * id with nothing behind it falsifies the model's entire guarantee, which is
 * how the first revision attributed "about 30 minutes" and "about a minute" to
 * `official-wording` while the manifest carried no such figures. They are E10
 * and E11 now.
 */
export type SourceId =
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "E5"
  | "E6"
  | "E7"
  | "E8"
  | "E9"
  | "E10"
  | "E11"
  | "E12"
  | "E13"
  | "E14"
  | "E15"
  | "E16"
  | "official-wording"
  | "rulebook-victory-conditions"
  | "components"
  | "rulebook";

/**
 * The merchant's own binding commitments: the dispatch window, the delivery
 * estimates, who bears duties and return postage, how stock is treated, how
 * price is presented.
 *
 * These are **not evidence.** Nobody verified them; we are undertaking to make
 * them true. They get their own union rather than a member of {@link SourceId}
 * exactly so a commitment cannot be dressed up as third-party proof:
 * {@link ProofItem} and {@link Quotation} accept a `SourceId` and nothing else,
 * so putting "dispatched within 3 business days" in the proof strip is a type
 * error rather than a matter of taste.
 */
export type CommercialTermId =
  | "price-presentation"
  | "checkout-contract"
  | "stock-policy"
  | "dispatch-window"
  | "delivery-estimates"
  | "shipping-charge"
  | "duties-outside-eu"
  | "withdrawal-terms"
  | "return-postage";

/** What body copy may cite: evidence, or a commitment we are making. */
export type Attribution = SourceId | CommercialTermId;

export type SourceKind =
  | "review"
  | "commercial-fact"
  | "publisher-record"
  | "official-wording"
  | "rulebook";

/**
 * How a source may appear on the page.
 *
 * There is no `"award"` and no `"laurel"`. The Watch It Played entry is a pick
 * in a top-10 video; presenting it as an award would be a fabricated award,
 * which the plan forbids outright. Making the value unrepresentable is cheaper
 * than remembering.
 */
export type SourcePresentation = "quotation" | "figure" | "mention" | "statement";

export interface Source {
  readonly id: SourceId;
  readonly kind: SourceKind;
  /** One line, as recorded in the operator's ignored evidence manifest. */
  readonly summary: string;
  /** The presentations this source may legitimately take on the site. */
  readonly presentation: readonly SourcePresentation[];
  /** Named human or outlet, where the source is attributable. */
  readonly attribution?: string;
  /**
   * True when a visitor cannot check the claim for themselves because no
   * public link exists. Such a source may still be used, but never as a
   * headline figure — it stands on the operator's word alone.
   */
  readonly unverifiableByVisitor?: boolean;
  /**
   * Where a visitor can check the claim. When a proof item cites a source that
   * carries this, the item must link there — a checkable claim that is not
   * linked has thrown away the only thing that makes it better than an
   * assertion.
   */
  readonly checkableAt?: ExternalTargetId;
  /**
   * True when the source may support a claim but never head one. Enforced: no
   * `ProofItem.source` may name a supporting-only source, so the restriction
   * survives whoever edits the strip next.
   */
  readonly supportingOnly?: boolean;
  /** Anything a writer must not do with this source. */
  readonly caution?: string;
}

/* ------------------------------------------------------------------------
 * Links
 * --------------------------------------------------------------------- */

export type LinkTarget =
  | { readonly kind: "route"; readonly to: RouteId; readonly anchor?: AnchorId }
  | { readonly kind: "anchor"; readonly to: AnchorId }
  | { readonly kind: "external"; readonly to: ExternalTargetId };

export interface Link {
  readonly label: string;
  readonly target: LinkTarget;
  /** Overrides the label for assistive technology where the label is terse. */
  readonly accessibleLabel?: string;
}

export type CallToActionEmphasis = "primary" | "secondary" | "quiet";

export interface CallToAction extends Link {
  readonly emphasis: CallToActionEmphasis;
}

/* ------------------------------------------------------------------------
 * Placeholders — the only way a value from outside content enters copy
 * --------------------------------------------------------------------- */

export type PlaceholderSource = "catalogue" | "configuration";

export interface Placeholder {
  readonly source: PlaceholderSource;
  readonly description: string;
  /**
   * True when no deployment has supplied the value yet. A legal page that
   * still depends on one of these may not be marked `operator-approved`.
   *
   * **No placeholder carries this flag today, and that is a fact rather than a
   * tidy-up.** The operator supplied the merchant identity set on 2026-08-09,
   * but the values are deployment configuration and reach a page through
   * `MERCHANT_*` environment variables — see
   * `storefront/src/config/runtime-env.ts` — so the operator having the answer
   * was never enough. All seven now reach both environments from
   * `hannosirkel/deploys`, `plepic/base/storefront.yaml`, with no overlay
   * override: the four the backend also reads, and the register code, VAT
   * number and telephone number that no manifest declared at all until then.
   * That deployment change is what makes clearing this flag true, and it is
   * deliberately the same flag that blocks approval, because approving a legal
   * page is approving the page **as served**, not the template.
   *
   * The flag stays in the model. A future placeholder for a value no
   * deployment supplies is exactly what it is for, and deleting it would mean
   * the next such placeholder ships approved by default.
   */
  readonly unresolved?: boolean;
  /**
   * True when the value is itself a legally required disclosure — the trader's
   * name, registered address, register number, VAT number, contact address,
   * telephone number, or the address returns go to.
   *
   * This flag is what separates the merchant identity from optional prose, and
   * it exists because the two need opposite failure modes. Dropping the copy
   * that quotes an unconfigured value is right on the Support page (a visitor
   * loses one alternative contact route they could not have used anyway); on
   * an imprint it is a compliance defect wearing the costume of graceful
   * degradation, because the page then looks complete and is not.
   * `storefront/src/lib/configuration-placeholders.ts` renders a named,
   * visible gap for these instead.
   *
   * **What enforces that, precisely.** `storefront/tests/legal-pages.test.tsx`
   * proves the component's two states against a hand-written fixture, which is
   * worth having but cannot see a placeholder nothing supplies a value for —
   * the fixture supplies them all. The check that actually catches that is
   * `storefront/tests/runtime-config.test.ts`, which asserts `RUNTIME_ENV_VARS`
   * is exactly the set of variables `src/` reads, and
   * `storefront/tests/build-and-serve.test.ts`, which renders all five routes
   * against a real configured environment and fails on any gap marker or
   * incompleteness notice. A mutation to the resolver was caught by the former,
   * not by the fixture test.
   */
  readonly legallyRequired?: boolean;
}

/**
 * Every substitution copy is allowed to make. `content.test.ts` rejects any
 * placeholder in a content file that is not a key here.
 *
 * Prices are here rather than in copy because the plan requires the price in a
 * call to action to be content bound to the catalogue, not a literal — so the
 * literal is not available to write.
 */
export const PLACEHOLDERS = {
  price: {
    source: "catalogue",
    description:
      "Advertised price with currency, rendered from the catalogue entry, **for the destination currently set** — the gross figure for a delivery address in the EU and the net one for any other.",
  },
  /*
   * The five tokens the net-pricing copy needs, added together with their
   * resolvers in `storefront/src/lib/catalogue.ts` because
   * `storefront/tests/catalogue.test.ts` pins the two tables set-equal in both
   * directions.
   *
   * They exist because `content/` forbids a currency symbol or a money amount
   * in prose — `content.test.ts` enforces it — and the operator's replacement
   * VAT wording states four money-or-rate facts in one section: the price
   * before tax, the price with it, the tax between them, and the rate.
   * `{price}` alone cannot carry them, and `{price}` is now
   * **destination-dependent** where these four are not: `{priceNet}`,
   * `{priceGross}`, `{priceVat}` and `{vatRate}` say the same thing wherever
   * the reader is, which is exactly why the copy uses them to explain what
   * `{price}` means. `{priceTaxQualifier}` is the one that does move, and it
   * moves because it names the destination.
   */
  priceNet: {
    source: "catalogue",
    description:
      "Price of the goods before tax, with currency. The same figure for every destination.",
  },
  priceGross: {
    source: "catalogue",
    description:
      "Price of the goods for a delivery address in the EU, with currency — the price before tax plus VAT.",
  },
  priceVat: {
    source: "catalogue",
    description: "The VAT added to the goods for a delivery address in the EU, with currency.",
  },
  vatRate: {
    source: "catalogue",
    description:
      "The VAT rate charged on an EU destination, as a percentage — quoted, never applied. The rate itself is declared in backend/src/commerce/tax-model.ts.",
  },
  priceTaxQualifier: {
    source: "catalogue",
    description:
      "The tax state and the destination the price is quoted for, in the operator's words — the half of the price headline that follows the figure.",
  },
  priceLine: {
    source: "catalogue",
    description:
      "Full price line including the tax note and the shipping note, rendered from the catalogue entry.",
  },
  /*
   * **`taxNote` used to sit here, and it is deliberately gone.** It resolved
   * to the bare "VAT included" — the unqualified claim Minor 2 of the second
   * qualified read removed from `/legal/shipping`, because no EU VAT is due
   * on an export — and no copy used it. A live resolver for a string we have
   * decided is misleading in a legal context is a loaded gun, so the operator
   * answer of 2026-08-10 closed it: the declaration here, the resolver in
   * `storefront/src/lib/catalogue.ts`, and the set-equality pin in
   * `storefront/tests/catalogue.test.ts` went in the same change, so no guard
   * was weakened to let one of the three go first. The tax presentation the
   * catalogue does still carry is `priceQualifiers`, which is qualified.
   *
   * **This is not that claim, reinstated — read the distinction before
   * re-litigating it from this comment alone.** `ResolvedCatalogue.vatIncludedNote`
   * (2026-08-29) is the secondary "VAT included" text under the homepage's
   * "Buy for {price}" call to action, and it is not `taxNote` wearing a new
   * name: `taxNote` rendered **regardless of destination**, which is exactly
   * what made it false on an export. `vatIncludedNote` is derived from
   * `vatApplies` — the same boolean that already chooses whether `price` is
   * the gross or the net figure — so it is structurally tied to the figure it
   * sits beside rather than a second, independently-settable flag: it cannot
   * render "VAT included" beside a net figure, because the one thing that
   * makes the figure net (`vatApplies` false) is the same thing that makes
   * the note resolve to `""`. It is not a placeholder — nothing composes it
   * into prose — so it is not declared in {@link PLACEHOLDERS} here; it lives
   * on `ResolvedCatalogue` beside `price` itself. See
   * `storefront/src/lib/catalogue.ts`.
   */
  productName: {
    source: "catalogue",
    description: "Product name as the catalogue holds it.",
  },
  merchantLegalName: {
    source: "configuration",
    description: "Registered legal name of the merchant.",
    legallyRequired: true,
  },
  merchantRegisteredAddress: {
    source: "configuration",
    description: "Registered address of the merchant, as filed.",
    legallyRequired: true,
  },
  merchantRegistrationNumber: {
    source: "configuration",
    description: "Company registration number.",
    legallyRequired: true,
  },
  merchantVatNumber: {
    source: "configuration",
    description: "VAT identification number, or the absence of one.",
    legallyRequired: true,
  },
  merchantContactAddress: {
    source: "configuration",
    description: "Contact email address for customers.",
    legallyRequired: true,
  },
  /**
   * Added for M1 of the second qualified read. Article 6(1)(c) CRD as amended
   * by Directive (EU) 2019/2161 dropped the old "where available" qualifier,
   * so the trader's telephone number is mandatory — transposed into VÕS § 54¹.
   * A number that reaches voicemail satisfies it; no number does not.
   */
  merchantPhoneNumber: {
    source: "configuration",
    description: "Telephone number customers can reach the merchant on.",
    legallyRequired: true,
  },
  returnAddress: {
    source: "configuration",
    description: "Postal address returns are sent to.",
    legallyRequired: true,
  },
} as const satisfies Record<string, Placeholder>;

export type PlaceholderToken = keyof typeof PLACEHOLDERS;

/**
 * A widened view of {@link PLACEHOLDERS}. The declaration above is kept narrow
 * so that {@link PlaceholderToken} is a union of the literal keys; this view
 * exists so the values can actually be read as {@link Placeholder}s.
 */
export const PLACEHOLDER_TABLE: Readonly<Record<PlaceholderToken, Placeholder>> = PLACEHOLDERS;

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** Every brace-delimited placeholder occurring in `text`, in order. */
export function placeholderTokensIn(text: string): readonly string[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1] ?? "");
}

/** True when `token` is a declared placeholder. */
export function isPlaceholderToken(token: string): token is PlaceholderToken {
  return Object.hasOwn(PLACEHOLDERS, token);
}

/** Placeholders whose value does not exist yet. */
export function unresolvedPlaceholdersIn(
  text: string,
): readonly PlaceholderToken[] {
  return placeholderTokensIn(text)
    .filter(isPlaceholderToken)
    .filter((token) => PLACEHOLDER_TABLE[token].unresolved === true);
}

/**
 * Placeholders in `text` that are themselves legally required disclosures.
 *
 * The renderer uses this to decide between the two failure modes: drop the
 * copy (optional prose) or render a named, visible gap and say so (anything on
 * this list). See {@link Placeholder.legallyRequired}.
 */
export function legallyRequiredPlaceholdersIn(
  text: string,
): readonly PlaceholderToken[] {
  return placeholderTokensIn(text)
    .filter(isPlaceholderToken)
    .filter((token) => PLACEHOLDER_TABLE[token].legallyRequired === true);
}

/* ------------------------------------------------------------------------
 * Prose
 * --------------------------------------------------------------------- */

/**
 * A run of body copy. Plain strings, because a human edits this file and an
 * array of inline nodes would make good writing hard to read. The guarantees
 * that matter are enforced by `content.test.ts` rather than by the type.
 */
export type Prose = readonly string[];

export interface Statement {
  readonly text: string;
  readonly source: SourceId;
}

export interface ListItem {
  readonly term: string;
  readonly detail: string;
  readonly source?: Attribution;
}

/**
 * One emphasised line with one plain line under it, rendered ahead of a
 * section's prose.
 *
 * It exists for exactly one kind of content: a disclosure whose **formatting
 * is part of the operator's answer**, not the renderer's taste. The price
 * presentation on `/legal/shipping` is the case that produced it — the
 * operator supplied it as two lines, the first emphasised and the second not,
 * and `Prose` is a flat array of equal paragraphs with nowhere to record that.
 *
 * Writing it as a one-entry `items` list would have needed no model change and
 * would have been a lie: `<dl>` says the second line defines the first, and it
 * does not.
 */
export interface Callout {
  /** The emphasised line. May carry placeholders like any other copy. */
  readonly lead: string;
  /** The plain line beneath it. */
  readonly detail: string;
}

/**
 * A genuine table: more than two columns, so {@link ListItem}'s term-and-detail
 * pair cannot hold it.
 *
 * The cookie disclosure is why this exists. The operator supplied it as four
 * columns — cookie, provider, purpose, duration — and every previous tabular
 * disclosure on these pages fitted `items` because it had two. Folding a
 * fourth column into a parenthetical inside `detail` is how a duration stops
 * being scannable and starts being prose nobody reads, so the model grew a
 * shape that holds the data instead.
 *
 * Every row must have exactly as many cells as there are columns;
 * `content.test.ts` asserts it, because a short row renders as a table with a
 * hole in it rather than as an error.
 */
export interface SectionTable {
  /** Rendered as the table's `<caption>`: its name, for a reader and for assistive technology. */
  readonly caption: string;
  /** Column headings, in order. The first column is the row's own header. */
  readonly columns: readonly string[];
  /** Rows, each one cell per column, in the same order. */
  readonly rows: readonly (readonly string[])[];
  /**
   * Prose that belongs **under** the table rather than before it — for the
   * cookie table, the operator's two sentences about which of these need
   * consent, which only make sense once the rows have been read.
   */
  readonly notes?: Prose;
}

export interface Section {
  readonly anchor: AnchorId;
  readonly heading: string;
  readonly body: Prose;
  /**
   * An emphasised statement ahead of the prose. See {@link Callout}; today the
   * one user is the price presentation the operator supplied as two lines.
   */
  readonly callout?: Callout;
  /**
   * A term-and-detail list under the prose, for the handful of disclosures
   * that are genuinely tabular in **two** columns — the toy-safety test
   * results. Anything wider is a {@link SectionTable}.
   */
  readonly items?: readonly ListItem[];
  /** A table under the prose, for a disclosure `items` is too narrow to hold. */
  readonly table?: SectionTable;
  readonly source?: Attribution;
  readonly links?: readonly Link[];
}

export interface FaqEntry {
  readonly question: string;
  readonly answer: Prose;
  readonly source?: Attribution;
}

/* ------------------------------------------------------------------------
 * Proof
 * --------------------------------------------------------------------- */

export interface Quotation {
  /** Required. A quotation with no manifest entry cannot be written down. */
  readonly source: SourceId;
  readonly attribution: string;
  /** Verbatim. Never edited for length without an ellipsis. */
  readonly text: string;
  /** How the quotation came about, where that matters for honesty. */
  readonly context?: string;
}

export interface ProofItem {
  /** The evidence behind the headline. Never a supporting-only source. */
  readonly source: SourceId;
  /** The short claim a visitor reads first. */
  readonly headline: string;
  /** One line of substance under it. */
  readonly detail: string;
  /**
   * Evidence used inside `detail` and never in the headline. This is how a
   * figure supports a claim without leading it.
   */
  readonly supporting?: readonly SourceId[];
  /** Where the visitor goes to check it. Required when a cited source is checkable. */
  readonly link?: Link;
}

export interface RejectedProof {
  readonly source: SourceId;
  /** Why this verified item was left out. Editorial choices need reasons. */
  readonly reason: string;
}

/**
 * The proof strip carries two or three items. The tuple type is the whole
 * point: "show two or three, not every metric" is a compile error rather than
 * a note in a review.
 */
export type ProofStripItems =
  | readonly [ProofItem, ProofItem]
  | readonly [ProofItem, ProofItem, ProofItem];

export interface ProofStrip {
  readonly items: ProofStripItems;
  /** Verified items deliberately not shown, each with its reason. */
  readonly rejected: readonly RejectedProof[];
}

/* ------------------------------------------------------------------------
 * Pages
 * --------------------------------------------------------------------- */

export interface Page {
  readonly route: RouteId;
  /** Unique across the site. */
  readonly title: string;
  /** Unique across the site. */
  readonly description: string;
  readonly indexable: boolean;
  readonly sections: readonly AnchorId[];
}

/**
 * The elements the legal pages are obliged to carry: EU distance selling for
 * most of them, and this plan's own consent constraint for
 * `analytics-lawful-basis` and `third-party-processors`. The list is closed,
 * and `content.test.ts` asserts the legal pages between them cover all of it
 * exactly once, so deleting the processor section fails the build instead of
 * being noticed after launch.
 *
 * ## The five that were added, and why the guarantee was false without them
 *
 * The second qualified read's structural finding was that this list *"is
 * promising more than it checks"*: legally required disclosures had no element
 * here and no home on any page, so the closed list guaranteed nothing about
 * them. The additions are:
 *
 * | Element | Obligation |
 * |---|---|
 * | `legal-guarantee-of-conformity` | Article 6(1)(l) CRD wants a **positive statement** that the two-year legal guarantee exists, not a saving clause. Directive (EU) 2019/771; VÕS §§ 218–222, and the two-month notification duty of VÕS § 220(1) |
 * | `model-withdrawal-form` | Article 6(1)(h) CRD obliges the trader to **provide** the Annex I(B) form, not to mention that one exists |
 * | `dispute-resolution` | Article 6(1)(t) CRD, and one mechanism squarely applies: the Consumer Disputes Committee at the TTJA |
 * | `processing-lawful-bases` | Article 13(1)(c) GDPR wants purpose **and legal basis** per operation. Only measurement had one |
 * | `third-country-transfers` | Article 13(1)(f) GDPR wants the transfers and their safeguard. Four US processors, unmentioned |
 *
 * The read counted four, treating the two GDPR halves as one. They are split
 * because `LegalSection.covers` binds one element to exactly one section and
 * the two halves belong in different sections of the privacy page — the bases
 * beside what we hold, the transfers beside who handles it.
 *
 * ## What makes the guarantee true rather than aspirational
 *
 * Coverage is declared **per section** ({@link LegalSection.covers}) and the
 * page's own `covers` must equal the union of its sections'. So deleting a
 * section, or deleting the last section that carries an obligation, fails
 * `content.test.ts` from both ends: the page no longer covers what it claims,
 * and the site no longer covers the closed list. Before this, `covers` was a
 * page-level array that no section had to justify, and a page could keep
 * claiming an element whose prose had been deleted.
 */
export const LEGAL_ELEMENTS = [
  "merchant-identity",
  "registered-address",
  "withdrawal-process",
  "withdrawal-deadline",
  "model-withdrawal-form",
  "return-postage-liability",
  "return-address",
  "legal-guarantee-of-conformity",
  "delivery-terms",
  "dispatch-estimate",
  "vat-presentation",
  "checkout-acknowledgement",
  "dispute-resolution",
  "analytics-lawful-basis",
  "third-party-processors",
  "processing-lawful-bases",
  "third-country-transfers",
] as const;

export type LegalElement = (typeof LEGAL_ELEMENTS)[number];

export type LegalReviewStatus =
  | "draft-pending-operator-input"
  | "operator-approved";

/**
 * A section of a legal page, which additionally declares which obligations
 * **this section's own prose** discharges.
 *
 * `covers: []` is a legitimate and common answer — plenty of legal prose is
 * necessary without being one of the closed list's named elements. What is not
 * legitimate is a page claiming an element no section carries, and that is
 * what the equality check in `content.test.ts` prevents.
 */
export interface LegalSection extends Section {
  readonly covers: readonly LegalElement[];
}

export interface LegalPage extends Page {
  /** Must equal the union of `body[].covers`, as a set. Asserted. */
  readonly covers: readonly LegalElement[];
  readonly reviewStatus: LegalReviewStatus;
  readonly body: readonly LegalSection[];
}

/**
 * Whether `routeId` publishes no page and answers a redirect instead.
 *
 * The data is `content/routes.ts`'s {@link RETIRED_ROUTES}; the two helpers
 * live here because a content module exports data and this package's own test
 * enforces that — `schema.ts` is the model, and the model is where a helper
 * over the model belongs.
 */
export function isRetiredRoute(routeId: RouteId): routeId is RetiredRouteId {
  return Object.hasOwn(RETIRED_ROUTES, routeId);
}

/**
 * The route a request for `routeId` should actually be served, following
 * retirement at most one step.
 *
 * One step is the design, not a limitation. A retired route may not name
 * another — asserted in `content.test.ts` — so following further would mean a
 * chain exists, and a chain is the thing the plan forbids outright.
 */
export function finalRouteFor(routeId: RouteId): RouteId {
  return isRetiredRoute(routeId) ? RETIRED_ROUTES[routeId] : routeId;
}
