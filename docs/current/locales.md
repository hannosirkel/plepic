# Locales

The site is published in four editions: English, German, Estonian and Klingon.
Each publishes every route that is not retired, and each has its own rulebook
PDF. `en` is the default edition. The URL path prefix selects the edition.
Nothing negotiates one.

A locale is an **edition** of the site, not a language. An edition has a
language tag and a URL path prefix, and the two are separate facts.

## Editions

| Locale | Language | Language tag | Path prefix | Selector label | Price format |
| --- | --- | --- | --- | --- | --- |
| `en` | English | `en` | none | English | `en-IE` |
| `de` | German | `de` | `/de` | Deutsch | `de-DE` |
| `et` | Estonian | `et` | `/et` | Eesti | `et-EE` |
| `tlh` | Klingon | `tlh` | `/tlh` | tlhIngan Hol | `en-IE` |

`content/routes.ts` declares the editions: `LOCALES`, `DEFAULT_LOCALE` and
`LOCALE_DEFINITIONS`. `DEFAULT_LOCALE` is `en`.

Every edition publishes the same eleven routes: every id in `ROUTE_PATHS`
except the retired `about`. `about` answers with a redirect to `/`, and no
edition publishes a page for it (`RETIRED_ROUTES` in `content/routes.ts`).

`tlh` is the ISO 639-2 code for Klingon and a valid BCP 47 tag. ICU has no
data for it, so `LOCALE_DEFINITIONS` declares what a runtime default would
otherwise decide: prices use the `en-IE` format, and country names stay as the
shop names them in English.

An edition is complete or it does not exist. An edition without full site
copy does not compile, and one without a committed rulebook PDF fails
`content/rulebook-documents.test.ts`.

## How an edition is chosen

By the URL path prefix, and by nothing else. The decision is in
[0001](../decisions/0001-locale-chosen-by-url.md).

| Rule | Detail | Where |
| --- | --- | --- |
| The path prefix is the choice | `/de/...` is German, `/et/...` is Estonian, `/tlh/...` is Klingon, no prefix is English | `parseLocalizedPath` in `storefront/src/lib/urls.ts` |
| Nothing negotiates a locale | No source file reads `Accept-Language`, a client address or a location header | `storefront/src/proxy.ts` and the rest of `storefront/src` |
| No redirect selects an edition | `/` answers in English, for every visitor | See [Redirects](#redirects) |
| The choice is not stored | No language cookie exists. Links inside an edition keep its prefix, so the choice lasts while the visitor browses | `localizedLinkFor` in `storefront/src/lib/seo.ts` |
| Language and delivery country are separate | The delivery-destination cookie selects a price presentation, not a language. A German destination does not switch the site to German | `storefront/src/lib/destination-request.ts` |

`storefront/tests/locale-selection.test.ts` guards this. It fails when a file
under `storefront/src` reads `accept-language`, a forwarded-address header or
a location header. It also fails when a file outside four named ones turns a
request value into a `Locale`. `storefront/tests/build-and-serve.test.ts`
requests `/` with `Accept-Language: de`, a German destination cookie and a
forwarded address, and expects `<html lang="en">` and English copy.

## The language selector

`LanguageSelector` in `storefront/src/components/LanguageSelector.tsx` is how
a reader moves between editions. `SiteHeader` and `SiteFooter` each render it,
and so does the 404 page.

| Property | Behaviour |
| --- | --- |
| Form | A `<nav>` of plain links, labelled by `languageNavLabel` in `CHROME_STRINGS`. No script, no form and no cookie |
| Entries | All four editions on every page. An edition that did not publish the route would not be listed |
| Current edition | Text marked `aria-current="true"`. It is not a link |
| Target | The same route in the target edition: `/games/lunar-base` leads to `/de/games/lunar-base` |
| Label | From `LANGUAGE_SWITCHER_LABELS`, in the edition's own language |
| Attributes | `lang` on every entry and `hreflang` on every link, both the entry's language tag |
| Narrow viewport | The header's selector is inside the navigation sheet |
| 404 page | No route is given, so each link leads to its edition's home page |

Every route view passes its route to the header and to the footer;
`storefront/tests/site-chrome.test.tsx` fails when one does not. The payment
return page passes `checkout`, the route it is served under, so its selector
leads to the checkout of the other edition and not to that edition's return
page.

The basket survives a change of edition. It is kept by cart id in the browser,
and the id is not tied to a locale.

## Where copy lives

Copy is typed TypeScript in `content/`. Each edition mirrors the English
modules file for file. [`content/README.md`](../../content/README.md)
describes the model.

| Copy | English | Each other edition |
| --- | --- | --- |
| Publisher, product, proof, support, shop | `content/publisher.ts`, `lunar-base.ts`, `proof.ts`, `support.ts`, `shop.ts` | `content/<locale>/`, same file names |
| Page titles and descriptions | `content/pages.ts` | `content/<locale>/pages.ts` |
| Interface strings: forms, basket, checkout, consent banner, 404, delivery method names | `content/interface.ts` | `content/<locale>/interface.ts` |
| Legal pages | `content/legal/*.ts` | `content/legal/<locale>/*.ts` |
| Header and footer labels, the name of each language | `CHROME_STRINGS` and `LANGUAGE_SWITCHER_LABELS` in `storefront/src/lib/chrome-strings.ts` | A key in the same table |
| VAT phrases and the shipping note | `TAX_VOCABULARY` in `storefront/src/lib/catalogue.ts` | A key in the same table |
| Names of merchant details, the gap marker's word | `LABELS` and `MARKER_WORDS` in `storefront/src/lib/configuration-placeholders.ts` | A key in the same table |
| Country names | `storefront/mock/countries.json`, in English | No file: `destinationNameIn` in `storefront/src/lib/destination.ts` asks ICU for the edition's name. `tlh` keeps the English name |
| Rulebook text | `rulebook/text/en.ts` | `rulebook/text/<locale>/` |
| Game and shop terms | `content/glossary/terms.ts` | `content/glossary/<locale>.ts` |

Two kinds of label reach a page from data, not from `content/`. Medusa returns
a delivery method's name in English, and the country list holds English names.
The page shows the edition's name for each. The forms still submit the English
value, and the storefront still recognises a method by the name Medusa
returns.

A component takes a `locale` and reads `siteCopyFor(locale)` from
`content/editions.ts`. No component imports an English content module.

The conventions of each language are in
[`translation/de.md`](./translation/de.md),
[`translation/et.md`](./translation/et.md) and
[`translation/klingon.md`](./translation/klingon.md). The rulebook PDF is
described in [`rulebook.md`](./rulebook.md).

## Registries

Every table keyed by locale is a total `Record<Locale, T>`. A new member of
`LOCALES` fails the type check at each table that does not have it.
`LocalizedContent<T>` in `content/schema.ts` is that type for content, and
`contentFor(registry, locale)` reads one entry.

| Registry | File | Holds | Read by |
| --- | --- | --- | --- |
| `LOCALE_DEFINITIONS` | `content/routes.ts` | `languageTag`, `numberFormatTag` and `pathPrefix` of each edition | `<html lang>`, `hreflang`, `og:locale`, list collation, price and number format, `storefront/src/lib/urls.ts` |
| `pagesByLocale` | `content/index.ts` | The pages each edition publishes: the edition's own `pages.ts` | Canonical, `hreflang`, sitemap, the router, link targets |
| `legalPagesByLocale` | `content/legal/index.ts` | The five legal pages of each edition | `LegalRoute` in `storefront/src/app/localized-routes.tsx`, the sentences the checkout quotes |
| `siteCopyByLocale` | `content/editions.ts` | The site copy of each edition. `SiteCopy` names the seven modules an edition must provide | Every page component, through `siteCopyFor`; the Server Functions that answer the public forms |
| `rulebookDocuments` | `content/rulebook-documents.ts` | File name, size and sheet count of each edition's rulebook PDF | `RulebookPageContent` |
| `CHROME_STRINGS` | `storefront/src/lib/chrome-strings.ts` | Header and footer labels, the draft note, the incompleteness notice | `SiteHeader`, `SiteFooter`, `LegalPageContent` |
| `LANGUAGE_SWITCHER_LABELS` | `storefront/src/lib/chrome-strings.ts` | The name of each edition's language, in that language | `LanguageSelector` |
| `TAX_VOCABULARY` | `storefront/src/lib/catalogue.ts` | The VAT qualification phrases and the shipping note | `resolveCatalogue` |
| `LABELS` | `storefront/src/lib/configuration-placeholders.ts` | The reader-facing name of each merchant detail | The gap marker and the incompleteness notice on a legal page |
| `MARKER_WORDS` | `storefront/src/lib/configuration-placeholders.ts` | The framing word of the gap marker | The gap marker on a legal page |

Each edition's `pages.ts` ends with its entry of `legalPagesByLocale`: the
same objects, so the two registries cannot disagree about an edition's legal
set.

One table is not keyed by locale, on purpose. `LOCALIZED_ROUTE_VIEWS` in
`storefront/src/app/localized-routes.tsx` is a
`Partial<Record<RouteId, renderer>>`. It lists the routes that have a renderer
that takes a locale: all eleven.

Test files hold their own total tables of expected words per locale, among
them `content/content.test.ts`, `storefront/tests/legal-pages.test.tsx`,
`storefront/tests/browser-storage-disclosure.test.ts` and
`storefront/tests/locale-navigation.test.tsx`. The type check names each one
when a locale is added.

## Adding a string

1. Write the English string in the module that owns it: a `content/` module,
   or one of the storefront tables under [Where copy lives](#where-copy-lives).
   An interface string goes in `content/interface.ts`. Never write a
   reader-facing string inside a component.
2. Add the same key to `content/de/`, `content/et/` and `content/tlh/`.
   `InterfaceCopy` and the storefront tables fail the type check until each
   edition has it. For the other modules `content/mirror.test.ts` fails: a
   translated module must equal the English one in export names, list
   lengths, anchors, source ids, link targets and placeholders.
3. Translate to the edition's conventions and the glossary. Follow
   [`translation/de.md`](./translation/de.md),
   [`translation/et.md`](./translation/et.md) or
   [`translation/klingon.md`](./translation/klingon.md).
4. Read it in the component through `siteCopyFor(locale)`.
5. Run `bash scripts/validate`. The glossary check, the English-leak check
   and the Klingon word check read the new string.

A string of the rulebook is not site copy. Changing one means building that
edition's PDF again: see [`rulebook.md`](./rulebook.md).

## Adding a language

A locale cannot be half registered. Its files are staged first and registered
last.

| Step | What lands | Reachable by a visitor |
| --- | --- | --- |
| Staged | Files under `content/<locale>/`, `content/legal/<locale>/` and `rulebook/text/<locale>/`. They compile, the content scans read them, and the mirror test compares them with English | No |
| Registered | The member of `LOCALES`, every registry entry and the committed rulebook PDF | Yes |

1. Write the conventions as `docs/current/translation/<language>.md`.
2. Add `content/glossary/<locale>.ts` and register it in
   `content/glossary/index.ts`. From then on `content/glossary.test.ts` reads
   every string of the language.
3. Stage the five legal pages in `content/legal/<locale>/` and the seven site
   modules in `content/<locale>/`.
4. Stage the rulebook text in `rulebook/text/<locale>/` and add the edition to
   `rulebook/editions.ts`. Build and check the PDF as
   [`rulebook.md`](./rulebook.md) says.
5. Add the locale to `LOCALES` and `LOCALE_DEFINITIONS` in
   `content/routes.ts`. The type check then names every table under
   [Registries](#registries) and every per-locale table in a test. Fill each.
6. Run `bash scripts/validate`.

Nothing else is needed for the URLs. The catch-all route, the canonical, the
`hreflang` set, the sitemap, the selector and the `robots.txt` rules for the
prefixed basket and checkout are all computed from the registries.

A language with a case-sensitive spelling needs a guard of its own, as Klingon
has in `storefront/src/styles/global.css`. A language ICU has no data for
needs its price format and its country names decided in `LOCALE_DEFINITIONS`
and `destinationNameIn`.

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

The default edition's `page.tsx` files and the catch-all render the same
route components, such as `LegalRoute` and `HomeRoute`. There is one renderer
per route, not one per edition. The catch-all passes `searchParams` on; the
basket and the checkout read them.

The payment return address is not a route id. `CHECKOUT_RETURN_PATH` is
declared beside `ROUTE_PATHS` in `content/routes.ts`. The catch-all serves it
with the `checkout` route's page and metadata, for an edition that publishes
`checkout`. Stripe returns a visitor to the address under the prefix of the
edition the visitor paid from.

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

Klingon spelling is case-sensitive. `storefront/src/styles/global.css` holds
`:lang(tlh) { text-transform: none !important; }`, so no stylesheet changes
the case of Klingon text, in the Klingon edition or in the selector entry of
another edition. `storefront/tests/klingon-case.test.ts` fails when the rule
is missing and on the two ways past it.

## The 404 page

Two root layouts have a cost, and the 404 page carries it.

| Fact | Detail |
| --- | --- |
| Status | `404` |
| Document | The framework's own `<html id="__next_error__">`. The body of `not-found.tsx` is in the flight payload, not in the server-rendered HTML |
| With JavaScript | The full page: heading, sentence, link, selector, site styles |
| Without JavaScript | No body content at all. The `<title>` is server-rendered, so the browser tab still names the page |
| Language | The edition's, when the path begins with a known prefix. The proxy forwards the pathname in a request header. An unknown prefix gets the default edition. The document element has no `lang`, so the content root declares the tag |
| Metadata | A title in the edition's language. No canonical and no alternates. A path that reaches the catch-all also gets `noindex` |

`storefront/src/app/not-found-content.tsx` holds the shared body. Its comment
records what was measured and which six configurations do not change the
document. A rewrite in `storefront/src/proxy.ts` that maps the unprefixed
paths onto one dynamic root segment would remove the second root layout.

`storefront/tests/build-and-serve.test.ts` asserts that a 404 carries no
canonical, against the payload the hydration reads.

## Links inside an edition

`localizedLinkFor(locale, routeId)` in `storefront/src/lib/seo.ts` builds
every link in the header and the footer. Calls to action follow the same rule
through `resolveLocalizedLink` in
`storefront/src/components/mockups/link-target.ts`, which keeps the target's
anchor.

| Case | Link |
| --- | --- |
| The edition publishes the route | The edition's own URL |
| The edition does not publish the route | The default edition's URL, with `hreflang` set to the default edition's language tag |

Every edition publishes every route, so the second row does not occur today.
The rule stays: it is what a link does if an edition ever lacks a route.

## Canonical, `hreflang` and the sitemap

All three are computed from `pagesByLocale`. No second list of routes or
locales exists.

| Item | Function | Rule |
| --- | --- | --- |
| Canonical | `canonicalUrl` in `storefront/src/lib/urls.ts` | One per page per edition, self-referencing, on the configured base URL |
| `hreflang` | `alternateLinksFor` in `storefront/src/lib/seo.ts` | One entry per edition that publishes the route, keyed by its language tag, plus `x-default` |
| `x-default` | `alternateLinksFor` | The default edition's URL |
| `og:locale` | `buildPageMetadata` in `storefront/src/lib/seo.ts` | The edition's language tag |
| Title, description, share card | `buildPageMetadata` | Title and description from the edition's `pages.ts`. The image is the same in every edition |
| Product structured data | `buildProductJsonLd` in `storefront/src/lib/product-jsonld.ts` | Description from the edition's page; URL under the edition's prefix |
| Sitemap | `buildSitemapEntries` in `storefront/src/lib/sitemap-contract.ts` | Each indexable route once per edition, with the same alternates the page emits |

Every route has four `hreflang` entries, `en`, `de`, `et` and `tlh`, and
`x-default`.

`/cart` and `/checkout` are never in the sitemap. `robots.txt` disallows them
unprefixed and under each prefix, and disallows `/store-api`
(`storefront/src/lib/robots-contract.ts`).

## Redirects

A redirect carries no locale. An entry in
`storefront/src/config/redirect-map.ts` is a path and a route id, and it
resolves to the default edition's bare path. An inbound link from an alternate
host says nothing about the language its visitor reads.
`storefront/tests/redirect-map.test.ts` rejects a `locale` field on an entry.

## What does not follow the edition

| Item | State |
| --- | --- |
| Order e-mails | English. The backend writes them, and nothing under `backend/` knows an edition. See [the issue](../issues/q03-order-emails-in-english.md) |
| Card form and verification widget | Stripe's Payment Element and the Turnstile widget are given no language, so each follows the browser. See [the issue](../issues/payment-and-verification-widgets-follow-the-browser.md) |
| Honeypot label | The hidden anti-spam field's label is English in every edition. No reader is meant to see it |
| Submitted form values | The checkout submits the English country name and recognises a delivery method by the name Medusa returns |
| Order handler | The checkout form posts to the unprefixed order handler from every edition |
| Country names in Klingon | English, as the shop names them. A carrier needs the real name |
| Paths | English path words under every prefix |
| Cards and card pictures | The cards are printed in English. Card titles and Station names stay as printed in every edition |
| Product data in Medusa | Not translated. The site's product copy comes from `content/` |
| Screenshot baselines | Only the Estonian imprint has one among the translated routes. See [the issue](../issues/screenshot-baselines-for-translated-routes.md) |

Public forms answer in their edition. A newsletter or contact form rendered
in a non-default edition posts its edition in a hidden `locale` field, and the
Server Function answers in that edition. Any other value, and no value, is
answered in the default edition
(`storefront/src/components/forms/form-locale.tsx`).

## Tests

All of these run in `bash scripts/validate`, except the last row.

| Test | Holds |
| --- | --- |
| `content/content.test.ts` | Exactly one edition has the unprefixed paths. Prefixes and language tags are distinct. Every edition publishes every unretired route and carries all five legal pages. No content file holds a hostname, an absolute URL or a price |
| `content/mirror.test.ts` | Every edition directory on disk, registered or not, equals the English modules in structure |
| `content/glossary.test.ts` | No translated string, of the site or the rulebook, uses a forbidden variant or lacks the agreed term |
| `content/rulebook-documents.test.ts` | Every edition has a committed rulebook PDF of the stated size and 25 sheets |
| `scripts/klingon-words.test.ts` | Every Klingon word is validly spelled and built from a root in the lexicon |
| `storefront/tests/locale-selection.test.ts` | Nothing reads a language, address or location header. Only four named files turn a request value into a `Locale` |
| `storefront/tests/locale-routing.test.ts` | `localizedPath` and `parseLocalizedPath` are inverses. `/en/...` resolves to nothing. Every route an edition publishes has a locale-aware renderer. `<html>` is rendered in one file, and no language tag is hard-coded |
| `storefront/tests/locale-navigation.test.tsx` | `localizedLinkFor` over every pair of locale and route. Every rendered link resolves to a route its target edition can serve. The selector labels |
| `storefront/tests/edition-leak.test.tsx` | No page of a non-default edition renders a sentence of the English edition, or an English country or delivery method name where the edition has its own. `english-leak-exemptions.ts` lists what may stay |
| `storefront/tests/klingon-case.test.ts` | The `:lang(tlh)` case guard exists, and no stylesheet rule can get past it |
| `storefront/tests/seo.test.ts` | Canonicals are unique. `hreflang` names every publishing edition and `x-default` |
| `storefront/tests/sitemap-contract.test.ts` | Each indexable route is listed once per edition, with the alternates the page emits |
| `storefront/tests/robots-contract.test.ts` | The basket and the checkout are disallowed under every prefix |
| `storefront/tests/redirect-map.test.ts` | Redirects carry no locale |
| `storefront/tests/destination.test.ts` | Country names per edition |
| `storefront/tests/legal-pages.test.tsx` | The legal pages of each edition render in that edition's words |
| `storefront/tests/home-edition.test.tsx`, `product-edition.test.tsx`, `support-edition.test.tsx`, `basket-edition.test.tsx`, `checkout-edition.test.tsx` | Each page group reads its words from the edition it is given |
| Browser suite, CI only | A translated route renders, the selector moves between editions, and Klingon text keeps its case |
