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
| A hostname | Nothing accepts a host. The canonical host, the base URL and every external URL come from configuration. `content.test.ts` additionally fails on any hostname-shaped string in any content file, including comments. |
| A price | There is no amount field, no currency field and no numeric price anywhere. Copy that must state a price writes `{price}`, `{priceLine}` or `{taxNote}`, all declared as resolving from the **catalogue**. `content.test.ts` fails on a currency symbol, a currency code, the word *euro*, or a decimal money amount. |
| An unkeyed proof claim | `Quotation` and `ProofItem` both require a `SourceId`, and `SourceId` is a closed union of ids that exist in the evidence manifest. A claim with no source does not compile. |
| An award | `SourcePresentation` has no `"award"` member. The one review mention the site carries is a pick in a video, and the model gives nobody a way to promote it. |
| More than three proof items | `ProofStripItems` is a tuple type: exactly two or exactly three. A fourth is a compile error, not a review comment. |
| Campaign-state language | `CAMPAIGN_STATE_PHRASES` in `evidence.ts` is checked against every content file. |
| A claim the manifest excludes | `NOT_PUBLISHABLE` in `evidence.ts`, same mechanism. |
| A legal obligation quietly dropped | `LEGAL_ELEMENTS` is a closed list and a test asserts the five legal pages cover all of it, exactly once each. |
| Publishing a legal page with placeholder identity | A test refuses `operator-approved` on any page whose prose still contains an unresolved placeholder. |

The two mechanisms are complementary. Types catch the *shape* of a violation;
the text scan catches a raw literal sitting inside a prose string, which no type
can see. Between them, an absolute URL, a hostname or a hard-coded price in a
content file is either impossible or a red build.

The guards are exercised, not assumed: injecting a URL, a hostname, an email
address, a currency symbol, a money amount, a campaign phrase, an excluded claim
and an undeclared placeholder into one content file produces eight distinct
failures.

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
| `evidence.ts` | The evidence registry, plus the two blocklists |
| `publisher.ts` | Publisher sentence, story, timeline, team, newsletter |
| `lunar-base.ts` | The one canonical set of product copy |
| `proof.ts` | The proof strip, its rejections, and the quotations |
| `support.ts` | Rules FAQ, rulebook link, contact |
| `legal/` | The five legal pages |
| `pages.ts` | Title, description, indexability and sections per route |
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
