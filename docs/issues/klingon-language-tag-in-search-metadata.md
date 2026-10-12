# The Klingon language tag in search metadata

Opened 2026-10-12, when the site-translation plan was retired. The plan's
review raised it. It is recorded so nobody files it as a defect later.

## What is open

`tlh` is a valid BCP 47 language tag, and the site emits it wherever it emits
a language tag. Two consumers document a narrower format.

| Item | Emitted | The consumer expects |
| --- | --- | --- |
| `hreflang` on alternates and in the sitemap | `tlh` | Search engines document ISO 639-1 codes. A three-letter code may be ignored or flagged |
| `og:locale` | `tlh` | Open Graph documents the form `language_TERRITORY` |

`<html lang="tlh">` is correct and not part of this.

Both values come from `languageTag` in `LOCALE_DEFINITIONS`
(`content/routes.ts`), through `alternateLinksFor` and `buildPageMetadata` in
`storefront/src/lib/seo.ts`.

The same `og:locale` form applies to `en`, `de` and `et`: each is emitted as a
bare language tag.

## What closing it takes

Nothing is broken, so nothing is required. If a search console reports the
tag, the choices are to leave `tlh` out of the `hreflang` sets, or to omit
`og:locale` for the Klingon edition. Either needs a field beside
`languageTag`, since the document language must stay `tlh`.
