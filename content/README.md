# Content

The site's copy, as typed TypeScript. Start with
[`content-document.md`](./content-document.md) — that is the editorial record
and it opens with the three lines of positioning every page assumes. This file
explains the model that carries it.

## Why TypeScript and not MDX

The plan forbids three things in content files: absolute URLs, hostnames, and
prices. It also requires every proof claim to key to an entry in the operator's
evidence manifest. MDX would accept all four violations happily and leave a
linter to notice. Typed content makes most of them **unrepresentable**, and a
test makes the rest **loud**.

| Prohibition | How it is prevented |
|---|---|
| An absolute URL | There is no `href`, `url` or `link` field of type `string` anywhere in `schema.ts`. A link is a `LinkTarget`: an internal `RouteId`, an `AnchorId`, or a named `ExternalTargetId` that runtime configuration resolves to a URL. There is no slot to put a URL in. |
| A hostname | Nothing accepts a host. The canonical host, the base URL and every external URL come from configuration. `content.test.ts` additionally fails on any hostname-shaped string a content module *exports*, and on one in its source text. |
| A price | There is no amount field, no currency field and no numeric price anywhere. Copy that must state a price writes `{price}` or `{priceLine}`, both declared as resolving from the **catalogue**. The scan fails on a currency symbol, a currency code, the word *euro*, or a decimal money amount. (A third such placeholder, `taxNote`, was declared until 2026-08-10; resolving to the unqualified "VAT included" the second legal read removed from `/legal/shipping`. nothing used it, and on the operator's answer the declaration, its resolver in `storefront/src/lib/catalogue.ts` and the set-equality pin in `storefront/tests/catalogue.test.ts` were removed together, so no guard was weakened to let one of the three go first.) |
| An unkeyed proof claim | `Quotation` and `ProofItem` both require a `SourceId`, and `SourceId` is a closed union of ids that exist in the evidence manifest. A claim with no source does not compile. |
| Our own commitments passed off as proof | The dispatch window, delivery estimates and return terms are `CommercialTermId`s, a **separate union**. `ProofItem` and `Quotation` take a `SourceId`, so "dispatched within 3 business days" cannot enter the proof strip at all. A test also fails on a commercial term nothing cites — an uncited promise is one the site does not actually make. |
| A weakly-provenanced figure leading the page | A `Source` may be marked `supportingOnly`. `ProofItem.source` may not name one, so it can appear in a detail line and nowhere else. |
| A checkable claim shipped without the link | A `Source` may carry `checkableAt`. Any proof item citing one must link there, and the test checks the link points at that target. |
| A string hidden from the scan | The value walk uses `Reflect.ownKeys` and handles `Map` and `Set`, and content modules may export **no functions at all** — the one place a computed string could hide. `schema.ts` is the sole exception and holds no copy. |
| An award | `SourcePresentation` has no `"award"` member. The one review mention the site carries is a pick in a video, and the model gives nobody a way to promote it. |
| More than three proof items | `ProofStripItems` is a tuple type: exactly two or exactly three. A fourth is a compile error, not a review comment. |
| Campaign-state language | `CAMPAIGN_STATE_PHRASES` in `evidence.ts` is checked against every content file. |
| A claim the manifest excludes | `NOT_PUBLISHABLE` in `evidence.ts`, same mechanism. |
| A legal obligation quietly dropped | `LEGAL_ELEMENTS` is a closed list, and coverage is declared **per section**: a page's `covers` must equal the union of its sections' `covers`, and every element must have exactly one section carrying it. Deleting a section fails because the page claims what nothing carries; tidying the claim away too fails because the site no longer covers the closed list. |
| Publishing a legal page with placeholder identity | A test refuses `operator-approved` on any page whose prose still contains an unresolved placeholder. |
| A legally required disclosure silently disappearing at render | Every configuration-sourced placeholder is marked `legallyRequired`. `storefront/src/lib/configuration-placeholders.ts` renders a named, visible gap for an unconfigured one and the page carries a notice, rather than dropping the sentence the way optional prose is dropped. `storefront/tests/build-and-serve.test.ts` builds, serves all five routes from a real configured environment and fails on any gap marker or notice appearing there, and `storefront/tests/runtime-config.test.ts` fails on a placeholder with no runtime variable behind it. (`storefront/tests/legal-pages.test.tsx` proves the two render states, but against a fixture that supplies every value, so it is not the check that catches an unsupplied one.) |
| An optional link making a complete page announce itself incomplete | A `LinkTarget` names an `ExternalTargetId`; the URL is deployment configuration, and an unconfigured one is simply not rendered. **Every** external destination is in that class, `consumer-disputes-committee` included: the operator, with the qualified reviewer's manual verification on 2026-08-10, confirmed that naming the Consumer Disputes Committee in prose satisfies Article 6(1)(t) CRD without an access method, so the address is an enhancement. The row above is the opposite case and keeps the opposite treatment: there the missing **value** *is* the disclosure. `storefront/src/components/mockups/link-target.ts` states where the line falls and why nothing is on the other side of it today. |

### The scan reads values, not source text

`content.test.ts` **imports every content module and walks the strings it
exports.** That is the load-bearing check, and it is deliberately not a grep.

A source-text scan restricted to `.ts` was the first revision's mistake. It let
a `.tsx` or a `.json` under `content/` through untouched — and `.tsx` is exactly
what the next unit adds — and it let `["plepicgames", "com"].join(".")` and
`String.fromCharCode(8364) + "25.00"` past, because those literals only exist
after evaluation. Walking resolved values closes both: whatever produced the
string, the string is what gets checked.

`EXTENSIONS` in that file is a closed list checked against the directory, so a
file type nobody anticipated fails the build instead of skipping the scan
silently. A source-text pass is kept as a second line, because a hostname in a
comment still leaks and comments are not values.

The walk itself is written not to be dodged: `Reflect.ownKeys` rather than
`Object.values`, so symbol-keyed and non-enumerable properties are seen; `Map`
and `Set` walked explicitly, since neither exposes its contents as own
properties; a throwing getter skipped rather than allowed to abort the walk; and
functions collected rather than called, because **a content package exports
none**, which is a better rule than trying to invoke them safely.

The guards are exercised, not assumed. A `.json`, a `.tsx`, a `.yaml` nobody
planned for, and a module hiding a character-code-built URL behind a function, a
`Map`, a `Set`, a symbol key, a non-enumerable property and a getter that throws
all fail the build — the last of those on six tests at once, one of which is
simply that it exported a function.

### The one gap, stated honestly

A bare number with no currency marker next to it — writing `25` and hoping a
reader supplies the euro sign — is not detectable by pattern. What stops it is
that no field wants a price, so there is nowhere natural to put one, and the
call to action is `Buy for {price}`. Review still matters; it just no longer
carries the load alone.

## Files

| File | Holds |
|---|---|
| `content-document.md` | The editorial record: positioning, every piece of copy, the proof choice and its rejections, the campaign-language removals, and the open operator inputs |
| `routes.ts` | Every route, anchor and named external target. The single source of truth for paths |
| `schema.ts` | The content model and the placeholder registry |
| `evidence.ts` | The evidence registry, the commercial-commitment registry, and the two blocklists. **Not re-exported from `index.ts`** — the blocklists contain the strings the site must never show, and they have no business in a bundle |
| `schema.ts` | The model. The only content module permitted to export a function, and it holds no copy |
| `publisher.ts` | Publisher sentence, story, timeline, team, newsletter |
| `lunar-base.ts` | The one canonical set of product copy |
| `proof.ts` | The proof strip, its rejections, and the quotations |
| `support.ts` | Rules FAQ, rulebook link, contact |
| `legal/` | The five legal pages |
| `pages.ts` | Title, description, indexability and sections per route |
| `index.ts` | The barrel a renderer imports. Deliberately narrower than the directory |
| `content.test.ts` | Everything above, enforced |

## Adding or changing copy

1. If it states a fact, find its entry in the operator's evidence manifest
   first. If there is no entry, **the fact does not go on the site.** Adding an
   id to `evidence.ts` without a manifest entry is a fabrication with extra
   steps.
2. Write it in the relevant content file. Never write a URL, a host, an email
   address or a price — use a `LinkTarget` or a placeholder.
3. Run `bash scripts/validate`.
4. If the copy changes what a page claims, update `content-document.md` in the
   same commit. That document is what the editorial gate reads.

## Routes and the router

`ROUTE_PATHS` is the only place a path is written. The router, the navigation,
the sitemap and the redirect targets are all derived from it — which is what
makes the sitemap contract in a later unit checkable rather than aspirational.

Two anchor names are deliberately ugly: `aboutgame` and `video_trailer`. Old
backlinks carry those fragments, and a fragment never reaches the server, so no
redirect can repair them. They are load-bearing. Do not tidy them.

## The legal pages, and the two failure modes

The five legal pages are not hand-written React. `storefront/src/components/
pages/LegalPageContent.tsx` projects `legal/*` section for section, so a
section deleted here disappears from the page rather than lingering as markup
nobody updated. Before that existed, every `/legal/*` route rendered a heading
and a meta description and **none** of this directory reached a visitor.

Two of `PLACEHOLDERS`' sources have opposite failure modes, and the difference
is deliberate:

- **`source: "catalogue"`** — resolved from `storefront/mock/catalogue.json`.
- **`source: "configuration"`** — the merchant identity, all seven fields, and
  every one of them `legallyRequired`. On optional prose (the Support page's
  "You can also reach us at …") an unconfigured value drops the sentence. On a
  legal page or the product page's GPSR block it renders as
  `[not configured: company registration number]` with a notice at the top of
  the page, because an imprint that quietly loses a disclosure looks complete
  and is not.
