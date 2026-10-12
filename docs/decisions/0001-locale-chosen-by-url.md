# 0001. Choose the locale by the URL prefix only

- **Date:** 2026-10-10
- **Status:** accepted

## Context and problem statement

The site has two editions, `en` and `et`, and the site-translation plan adds
`de` and `tlh` and completes `et`. The operator's brief of 2026-10-10 sets two
limits. No language is preselected from the visitor's IP address or location.
The default stays English. The site needs one rule that says which edition a
request gets, and the brief leaves three points open.

## Considered options

- A. The URL path prefix selects the edition, and nothing else does.
- B. The server negotiates from `Accept-Language` and redirects `/` to the
  matching edition.
- C. The server reads the client address or a location header and redirects.
- D. The site stores the visitor's choice in a cookie and redirects `/` on the
  next visit.
- E. The delivery country selects the language.

## Decision

Chose option A.

| Rule | Detail |
| --- | --- |
| The path prefix is the choice | `/de/...` is German, `/tlh/...` is Klingon, `/et/...` is Estonian, no prefix is English |
| The server never guesses | It does not read `Accept-Language`, an IP address, a location header, the delivery-destination cookie or the delivery country to select a language |
| No redirect selects a language | `/` answers in English, for every visitor |
| The choice is not stored | No language cookie. Links inside an edition keep its prefix, so the choice lasts while the visitor browses |
| Language and delivery country are separate | A German destination does not switch the site to German. The German edition does not change the destination |
| Paths are not translated | Each edition serves the English paths under its prefix: `/de/games/lunar-base` |
| `/en/...` is not a URL | The default edition has no prefix. `/en/...` answers 404 |

The editions and their prefixes:

| Locale | Language tag | Prefix | Selector label |
| --- | --- | --- | --- |
| `en` | `en` | none | English |
| `de` | `de` | `/de` | Deutsch |
| `et` | `et` | `/et` | Eesti |
| `tlh` | `tlh` | `/tlh` | tlhIngan Hol |

The brief was unclear on three points. The reading below is in force. The work
does not wait for an answer.

| # | Question | Reading chosen |
| --- | --- | --- |
| Q1 | "Never by address": the visitor's network address, or the URL? | The network address and location, as the brief's own sentence says. The URL prefix is how the visitor's choice is carried |
| Q2 | Does the site remember a visitor's language? | No. A stored choice makes `/` answer differently per visitor, and the brief says the default stays English |
| Q5 | Are URL paths translated? | No. `/de/games/lunar-base`, not a German path |

The numbers Q1, Q2 and Q5 are those of the plan's section Questions, and of
the files in `docs/issues/`.

## Rationale

Option C is what the brief forbids. Options B, D and E also preselect a
language. With any of them `/` answers differently per visitor, and the brief
says the default stays English.

Option A is also how the site already works. `parseLocalizedPath` reads the
edition from the path, and the canonical, `hreflang` and sitemap are computed
from the same prefix. No new mechanism is needed.

The accepted trade-off: a visitor who reads German and opens `/` gets English.
That visitor must use the language selector, or arrive by a link that carries
the prefix. `hreflang` gives a search engine the edition to offer.

Paths stay English because `ROUTE_PATHS` is the one place a path is written.
A translated path needs a second table per edition, and each such table can
drift from the first.

## Consequences

- One URL has one language, for every visitor. The edition does not vary by
  header, address or cookie, so a crawler is offered the edition a visitor
  gets.
- This decision is about the language only. The rest of a response can differ
  between visitors: the delivery-destination cookie changes the price figures
  a page states, on the legal pages too
  (`storefront/src/app/localized-routes.tsx`). A response is not cacheable by
  its URL alone.
- A link to an edition is stable and can be shared. The prefix is the whole
  state.
- A first-time visitor is not routed to a matching language. The selector must
  be easy to find on every page.
- A German or Estonian URL contains English path words.
- The absence of negotiation needs a guard. A source scan and a served test
  hold this decision: `storefront/tests/locale-selection.test.ts` and
  `storefront/tests/build-and-serve.test.ts`.
- The delivery-destination cookie continues to exist. It selects a price
  presentation and must never select a language.

The plan was carried out and retired on 2026-10-12. The present behaviour is
in [`docs/current/locales.md`](../current/locales.md). The three questions
above are still unanswered; each has a file in
[`docs/issues/`](../issues/README.md).
