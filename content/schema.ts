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

import type { AnchorId, ExternalTargetId, RouteId } from "./routes.js";

/* ------------------------------------------------------------------------
 * Sources
 * --------------------------------------------------------------------- */

/**
 * Identifiers of entries in the operator's ignored evidence manifest, plus the
 * two non-review sources the site is allowed to state facts from.
 *
 * `E1`–`E8` key one-to-one to that manifest. `official-wording`,
 * `rulebook-victory-conditions`, `components` and `rulebook` key to its
 * verbatim sections. `task1-commercial-model` keys to the commercial model
 * frozen in Task 1 — price, dispatch and delivery estimates, packaged size and
 * weight — which is a commercial fact, not review evidence, and is labelled
 * as such so the two are never confused in a proof strip.
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
  | "official-wording"
  | "rulebook-victory-conditions"
  | "components"
  | "rulebook"
  | "task1-commercial-model";

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
   * True when the value does not exist yet. A legal page that still depends on
   * one of these may not be marked `operator-approved`.
   */
  readonly unresolved?: boolean;
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
      "Advertised price with currency, rendered from the catalogue entry.",
  },
  priceLine: {
    source: "catalogue",
    description:
      "Full price line including the tax note and the shipping note, rendered from the catalogue entry.",
  },
  taxNote: {
    source: "catalogue",
    description: "Tax presentation note that accompanies the advertised price.",
  },
  productName: {
    source: "catalogue",
    description: "Product name as the catalogue holds it.",
  },
  merchantLegalName: {
    source: "configuration",
    description: "Registered legal name of the merchant.",
    unresolved: true,
  },
  merchantRegisteredAddress: {
    source: "configuration",
    description: "Registered address of the merchant, as filed.",
    unresolved: true,
  },
  merchantRegistrationNumber: {
    source: "configuration",
    description: "Company registration number.",
    unresolved: true,
  },
  merchantVatNumber: {
    source: "configuration",
    description: "VAT identification number, or the absence of one.",
    unresolved: true,
  },
  merchantContactAddress: {
    source: "configuration",
    description: "Contact email address for customers.",
    unresolved: true,
  },
  returnAddress: {
    source: "configuration",
    description: "Postal address returns are sent to.",
    unresolved: true,
  },
  siteName: {
    source: "configuration",
    description: "Public name of the site, for use in legal prose.",
  },
} as const satisfies Record<string, Placeholder>;

export type PlaceholderToken = keyof typeof PLACEHOLDERS;

/**
 * A widened view of {@link PLACEHOLDERS}. The declaration above is kept narrow
 * so that {@link PlaceholderToken} is a union of the literal keys; this view
 * exists so the values can actually be read as {@link Placeholder}s.
 */
const placeholderTable: Readonly<Record<PlaceholderToken, Placeholder>> = PLACEHOLDERS;

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
    .filter((token) => placeholderTable[token].unresolved === true);
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

export interface Section {
  readonly anchor: AnchorId;
  readonly heading: string;
  readonly body: Prose;
  readonly source?: SourceId;
  readonly links?: readonly Link[];
}

export interface ListItem {
  readonly term: string;
  readonly detail: string;
  readonly source?: SourceId;
}

export interface FaqEntry {
  readonly question: string;
  readonly answer: Prose;
  readonly source?: SourceId;
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
  readonly source: SourceId;
  /** The short claim a visitor reads first. */
  readonly headline: string;
  /** One line of substance under it. */
  readonly detail: string;
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
 * The elements EU distance selling obliges the legal pages to carry. The list
 * is closed, and a test asserts the legal pages between them cover all of it —
 * so a missing obligation fails the build instead of being noticed at launch.
 */
export const LEGAL_ELEMENTS = [
  "merchant-identity",
  "registered-address",
  "withdrawal-process",
  "withdrawal-deadline",
  "return-postage-liability",
  "return-address",
  "delivery-terms",
  "dispatch-estimate",
  "vat-presentation",
  "checkout-acknowledgement",
] as const;

export type LegalElement = (typeof LEGAL_ELEMENTS)[number];

export type LegalReviewStatus =
  | "draft-pending-operator-input"
  | "operator-approved";

export interface LegalPage extends Page {
  readonly covers: readonly LegalElement[];
  readonly reviewStatus: LegalReviewStatus;
  readonly body: readonly Section[];
}
