# Q2: whether the site remembers a visitor's language

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

The brief says the default stays English. It does not say whether a visitor
who chose German once gets German on the next visit to `/`.

## Reading in force

No. The choice is not stored. A stored choice makes `/` answer differently
per visitor, and the brief says the default stays English.

## Where it shows

| Fact | Where |
| --- | --- |
| No language cookie exists. Links inside an edition keep its prefix | [`docs/current/locales.md`](../current/locales.md), section How an edition is chosen |
| `/` answers in English for every visitor | `storefront/tests/build-and-serve.test.ts` |
| The accepted cost: a German reader who opens `/` gets English and must use the selector | [0001](../decisions/0001-locale-chosen-by-url.md), section Rationale |

## If the answer differs

A remembered language needs a cookie, a redirect from `/`, and a disclosure
of the cookie on the privacy page of each edition. One URL then has more than
one language, so a crawler and a visitor can be given different pages.
Decision 0001 must be replaced first.
