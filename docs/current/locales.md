# Locales

The site is published in two editions. `en` is the default edition and
publishes every route that is not retired. `et` publishes the five legal pages
and nothing else. The URL path prefix selects the edition. Nothing negotiates
one.

A locale is an **edition** of the site, not a language. An edition has a
language tag and a URL path prefix, and the two are separate facts.

## Editions

| Locale | Language tag | Path prefix | Publishes |
| --- | --- | --- | --- |
| `en` | `en` | none | Eleven routes: every id in `ROUTE_PATHS` except the retired `about` |
| `et` | `et` | `/et` | The five legal pages: imprint, terms, shipping, returns, privacy |

`content/routes.ts` declares the editions: `LOCALES`, `DEFAULT_LOCALE` and
`LOCALE_DEFINITIONS`. `DEFAULT_LOCALE` is `en`.

`about` is a retired route. Its path answers with a redirect to `/`, and no
edition publishes a page for it (`RETIRED_ROUTES` in `content/routes.ts`).

The Estonian legal pages are translations of the English ones: same anchors,
same `covers`, same placeholders, Estonian prose. They live in
`content/legal/et/`.

## Registries

Every table keyed by locale is a total `Record<Locale, T>`. A new member of
`LOCALES` fails the type check at each table that does not have it.
`LocalizedContent<T>` in `content/schema.ts` is that type for content, and
`contentFor(registry, locale)` reads one entry.

| Registry | File | Holds | Read by |
| --- | --- | --- | --- |
| `LOCALE_DEFINITIONS` | `content/routes.ts` | `languageTag` and `pathPrefix` of each edition | `<html lang>`, `hreflang`, `og:locale`, list collation, `storefront/src/lib/urls.ts` |
| `pagesByLocale` | `content/index.ts` | The pages each edition publishes | Canonical, `hreflang`, sitemap, the router, link targets |
| `legalPagesByLocale` | `content/legal/index.ts` | The legal pages each edition carries | `LegalRoute` in `storefront/src/app/localized-routes.tsx` |
| `CHROME_STRINGS` | `storefront/src/lib/chrome-strings.ts` | Header and footer labels, the draft note, the incompleteness notice | `SiteHeader`, `SiteFooter`, `LegalPageContent` |
| `LANGUAGE_SWITCHER_LABELS` | `storefront/src/lib/chrome-strings.ts` | The switcher label of each target edition, in its own language | `SiteFooter` |
| `TAX_VOCABULARY` | `storefront/src/lib/catalogue.ts` | The VAT qualification phrases and the shipping note | `resolveCatalogue` |
| `LABELS` | `storefront/src/lib/configuration-placeholders.ts` | The reader-facing name of each merchant detail | The gap marker and the incompleteness notice on a legal page |
| `MARKER_WORDS` | `storefront/src/lib/configuration-placeholders.ts` | The framing word of the gap marker | The gap marker on a legal page |

`pagesByLocale.et` is `legalPagesByLocale.et`: the same objects, so the two
registries cannot disagree about what the Estonian edition contains.

One table is not keyed by locale, on purpose. `LOCALIZED_ROUTE_VIEWS` in
`storefront/src/app/localized-routes.tsx` is a
`Partial<Record<RouteId, renderer>>`. It lists the routes that have a renderer
that takes a locale. Today it lists the five legal routes.

Test files hold their own total tables of expected words per locale:
`content/content.test.ts`, `storefront/tests/legal-pages.test.tsx`,
`storefront/tests/browser-storage-disclosure.test.ts` and
`storefront/tests/locale-navigation.test.tsx`.

## How an edition is chosen

By the URL path prefix, and by nothing else. The decision is in
[0001](../decisions/0001-locale-chosen-by-url.md).

| Fact | Where |
| --- | --- |
| A path with no known prefix is the default edition's | `parseLocalizedPath` in `storefront/src/lib/urls.ts` |
| No source file reads `Accept-Language`, a client address or a location header | `storefront/src/proxy.ts` and the rest of `storefront/src` |
| No language cookie exists | The delivery-destination cookie selects a price presentation, not a language (`storefront/src/lib/destination-request.ts`) |
| No redirect selects an edition | See [Redirects](#redirects) |
| `/` answers in English for every visitor | `storefront/src/app/(site)/page.tsx` |

No test guards the absence of negotiation yet.

## URLs

The default edition holds the unprefixed paths. Every other edition is served
under its prefix. Paths are not translated: `ROUTE_PATHS` in
`content/routes.ts` is the one place a path is written.

`/en/...` is not a URL of this site. The default edition's prefix is empty, so
a page has one canonical URL, not two.

`storefront/src/lib/urls.ts` is the one place a URL is concatenated.

| Function | Answer |
| --- | --- |
| `localizedPath(locale, path)` | The path as served in that edition |
| `parseLocalizedPath(pathname)` | The edition and the bare path of a served pathname. The inverse of `localizedPath` |
| `localeForPathSegment(segment)` | The edition served under that first segment. Never the default edition |
| `routeIdForPath(path)` | The route whose bare path is exactly `path` |
| `canonicalUrl(baseUrl, locale, routeId)` | The one canonical URL of a route in an edition |

## Routing

The directory `storefront/src/app/(site)/` serves the default edition, one
`page.tsx` per route. One optional catch-all route serves every prefixed
edition: `storefront/src/app/[locale]/[[...segments]]/page.tsx`. There is no
second route tree per locale.

`resolveLocalizedRoute` in `storefront/src/app/localized-routes.tsx` decides
what the catch-all serves. It answers a route only when all four rows hold.
Anything else is a 404.

| Condition | Checked with |
| --- | --- |
| The first segment is the prefix of a non-default edition | `localeForPathSegment` |
| The rest of the path is a route | `routeIdForPath` |
| The edition publishes that route | `lookupPage`, over `pagesByLocale` |
| The route has a locale-aware renderer | `LOCALIZED_ROUTE_VIEWS` |

The catch-all does not pass `searchParams` to a renderer. No route with a
locale-aware renderer reads one.

The five legal `page.tsx` files of the default edition and the catch-all both
render `LegalRoute`. There is one projection of the legal content, not two.

## The served document

There are two root layouts, because only a root layout can render `<html>`.
Only a root layout under a dynamic segment can know the edition of the request.

| Layout | Serves | `<html lang>` |
| --- | --- | --- |
| `storefront/src/app/(site)/layout.tsx` | The default edition | The default edition's language tag |
| `storefront/src/app/[locale]/layout.tsx` | Every prefixed edition | The language tag of the edition the first segment names |

Both wrap `SiteDocument` in `storefront/src/app/site-document.tsx`, which is
the document itself. It takes `lang` from `LOCALE_DEFINITIONS`.

An unknown first segment also matches the `[locale]` layout. The layout does
not answer 404. It falls back to the default edition's language, and the
catch-all page answers 404.

## The 404 page

Two root layouts have a cost, and the 404 page carries it.

| Fact | Detail |
| --- | --- |
| Status | `404` |
| Document | The framework's own `<html id="__next_error__">`. The body of `not-found.tsx` is in the flight payload, not in the server-rendered HTML |
| With JavaScript | The full page: heading, sentence, link, site styles |
| Without JavaScript | No body content at all. The `<title>` is server-rendered, so the browser tab reads "Page not found" |
| Language | English in every edition. The document element has no `lang`, so the content root declares the default edition's tag |
| Metadata | A title. No canonical and no alternates. A path that reaches the catch-all also gets `noindex` |

`storefront/src/app/not-found-content.tsx` holds the shared body. Its comment
records what was measured and which six configurations do not change the
document. A rewrite in `storefront/src/proxy.ts` that maps the unprefixed
paths onto one dynamic root segment would remove the second root layout.

`storefront/tests/build-and-serve.test.ts` asserts that a 404 carries no
canonical, against the payload the hydration reads.

## Links inside an edition

`localizedLinkFor(locale, routeId)` in `storefront/src/lib/seo.ts` builds
every link in the header and the footer.

| Case | Link |
| --- | --- |
| The edition publishes the route | The edition's own URL |
| The edition does not publish the route | The default edition's URL, with `hreflang` set to the default edition's language tag |

In the Estonian edition the five legal links stay under `/et`. The links to
the home page, Lunar Base, About, Support and the basket cross to English and
say so with `hreflang="en"`.

Only `LegalPageContent` passes a locale to `SiteHeader` and `SiteFooter`.
Every other page renders them for the default edition.

## Canonical, `hreflang` and the sitemap

All three are computed from `pagesByLocale`. No second list of routes or
locales exists.

| Item | Function | Rule |
| --- | --- | --- |
| Canonical | `canonicalUrl` in `storefront/src/lib/urls.ts` | One per page per edition, self-referencing, on the configured base URL |
| `hreflang` | `alternateLinksFor` in `storefront/src/lib/seo.ts` | One entry per edition that publishes the route, keyed by its language tag, plus `x-default` |
| `x-default` | `alternateLinksFor` | The default edition's URL |
| `og:locale` | `buildPageMetadata` in `storefront/src/lib/seo.ts` | The edition's language tag |
| Sitemap | `buildSitemapEntries` in `storefront/src/lib/sitemap-contract.ts` | Each indexable route once per edition that publishes it, with the same alternates the page emits |

A legal route has two `hreflang` entries, `en` and `et`, and `x-default`.
Every other route has one entry, `en`, and `x-default`. A set of one is still
emitted: it is a valid set, and it keeps the mechanism in use on every page.

An edition that does not publish a route is never named as an alternate for
it. `/cart` and `/checkout` are never in the sitemap.

## The footer language switcher

`SiteFooter` renders a language switcher when it is given the route of its
page and another edition publishes that route.

| Property | Behaviour |
| --- | --- |
| Entries | One link per other edition that publishes the route. The current edition is not listed |
| Target | The same route in the target edition |
| Label | From `LANGUAGE_SWITCHER_LABELS`, in the target's own language: "In English", "Eesti keeles" |
| Attributes | `lang` and `hreflang`, both the target's language tag |
| Form | Plain links in a `<nav>`. No script and no cookie |

Only `LegalPageContent` passes the route. The switcher is therefore on the ten
legal pages and on no other page. The header has no switcher.

## Redirects

A redirect carries no locale. An entry in
`storefront/src/config/redirect-map.ts` is a path and a route id, and it
resolves to the default edition's bare path. An inbound link from an alternate
host says nothing about the language its visitor reads.
`storefront/tests/redirect-map.test.ts` rejects a `locale` field on an entry.

## What is not locale-aware

| Item | State |
| --- | --- |
| Home, Lunar Base, support, rulebook page, basket, checkout | The components import the English content modules directly: `content/publisher.ts`, `content/lunar-base.ts`, `content/support.ts`, `content/shop.ts`. They have no locale-aware renderer |
| Strings inside components | Reader-facing strings are written in components, not in `content/`. Examples: `LunarBaseMockup.tsx`, `StripePaymentReturn.tsx`, `ConsentManager.tsx` |
| Publisher tagline in the footer | English in every edition, from `content/publisher.ts` |
| Price format | The fixed tag `en-IE`, in `storefront/src/lib/catalogue.ts` and `storefront/src/lib/cart.ts` |
| Country names | `storefront/mock/countries.json` holds English names. `destinationNameIn` in `storefront/src/lib/destination.ts` asks ICU for the edition's name inside a price qualification. It answers in English when ICU has no data for the edition |
| `robots.txt` | Disallows `/cart`, `/checkout` and `/store-api`. It names no prefixed path, because no edition serves one for the basket or the checkout |
| Rulebook | One English PDF, `storefront/public/documents/lunar-base-rulebook.pdf` |

An edition that registered one of the routes in the first row would fail
`storefront/tests/locale-routing.test.ts`. It would not serve English words
under a prefixed URL.

The decision on how a translated rulebook PDF is produced is in
[0002](../decisions/0002-translated-rulebook-pdf.md).

## Tests

All of these run in `bash scripts/validate`.

| Test | Holds |
| --- | --- |
| `content/content.test.ts` | Exactly one edition has the unprefixed paths. Prefixes and language tags are distinct. The default edition publishes every unretired route. A non-default edition carries all five legal pages and mirrors the English structure |
| `storefront/tests/locale-routing.test.ts` | `localizedPath` and `parseLocalizedPath` are inverses. `/en/...` resolves to nothing. Every route a non-default edition publishes has a locale-aware renderer. `<html>` is rendered in one file, and no language tag is hard-coded |
| `storefront/tests/locale-navigation.test.tsx` | `localizedLinkFor` over every pair of locale and route. Every rendered link resolves to a route its target edition can serve. The switcher labels |
| `storefront/tests/seo.test.ts` | Canonicals are unique. `hreflang` names every publishing edition and `x-default`, and no edition that does not publish the page |
| `storefront/tests/sitemap-contract.test.ts` | Each indexable route is listed once per publishing edition, with the alternates the page emits |
| `storefront/tests/redirect-map.test.ts` | Redirects carry no locale |
| `storefront/tests/destination.test.ts` | Country names per edition |
| `storefront/tests/legal-pages.test.tsx` | The legal pages of each edition render in that edition's words |
