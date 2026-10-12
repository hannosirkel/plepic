# Q1: what "never by address" means

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

The operator's brief of 2026-10-10 says no language is preselected "by
address". The phrase can mean the visitor's network address, or the address
in the browser's address bar.

## Reading in force

The network address and the location. The brief's own sentence names the IP
address and the location, so the URL is not what it forbids. The URL path
prefix is how the visitor's own choice is carried.

## Where it shows

| Fact | Where |
| --- | --- |
| The path prefix selects the edition, and nothing else does | [`docs/current/locales.md`](../current/locales.md), section How an edition is chosen |
| The decision, with the options that were rejected | [0001](../decisions/0001-locale-chosen-by-url.md) |
| A test fails when anything reads a language, address or location header | `storefront/tests/locale-selection.test.ts` |

## If the answer differs

If the brief meant the URL, an edition cannot be selected by a path prefix.
Decision 0001 falls, and with it the catch-all route, the canonical URLs, the
`hreflang` sets and the sitemap. No other reading of the brief leaves a way
for a visitor to keep a language without a stored choice, which
[Q2](./q02-remembering-a-language.md) rules out.
