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
| A price | There is no amount field, no currency field and no numeric price anywhere. Copy that must state a price writes `{price}`, `{priceLine}` or `{taxNote}`, all declared as resolving from the **catalogue**. The scan fails on a currency symbol, a currency code, the word *euro*, or a decimal money amount. |
| An unkeyed proof claim | `Quotation` and `ProofItem` both require a `SourceId`, and `SourceId` is a closed union of ids that exist in the evidence manifest. A claim with no source does not compile. |
| Our own commitments passed off as proof | The dispatch window, delivery estimates and return terms are `CommercialTermId`s, a **separate union**. `ProofItem` and `Quotation` take a `SourceId`, so "dispatched within 3 business days" cannot enter the proof strip at all. |
| An award | `SourcePresentation` has no `"award"` member. The one review mention the site carries is a pick in a video, and the model gives nobody a way to promote it. |
| More than three proof items | `ProofStripItems` is a tuple type: exactly two or exactly three. A fourth is a compile error, not a review comment. |
| Campaign-state language | `CAMPAIGN_STATE_PHRASES` in `evidence.ts` is checked against every content file. |
| A claim the manifest excludes | `NOT_PUBLISHABLE` in `evidence.ts`, same mechanism. |
| A legal obligation quietly dropped | `LEGAL_ELEMENTS` is a closed list of ten — eight from EU distance selling, two from the plan's consent constraint — and a test asserts the five legal pages cover all of it, exactly once each. |
| Publishing a legal page with placeholder identity | A test refuses `operator-approved` on any page whose prose still contains an unresolved placeholder. |

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

The guards are exercised, not assumed. Dropping the reviewer's own probes into a
clean checkout — `content/promo.json`, `content/blocks/Hero.tsx`,
`content/blocks/Sneak.ts` with concatenated and character-code literals, and a
`.yaml` nobody planned for — produces **26 failures** across the value scan, the
source scan and the file-coverage guard.

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
