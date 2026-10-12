# Open issues

These files list what was still open when the site-translation plan was
retired on 2026-10-12. The plan added the German, Estonian and Klingon
editions and their rulebook PDFs. Nothing here is committed work.

Twelve files are questions the plan put to the operator. The plan chose a
reading for each and built on it, so the site works as each file describes.
The operator has not confirmed the readings. A file stays until the operator
answers; an answer that differs from the reading becomes a plan in
`docs/working/`.

Each item was open in the code on 2026-10-12. Verify it again before you plan
it: the code, not these files, is the authority.

## Known gaps

| File | What it holds |
| --- | --- |
| [`screenshot-baselines-for-translated-routes.md`](./screenshot-baselines-for-translated-routes.md) | Translated routes have no screenshot baseline, and the existing ones predate the language selector |
| [`payment-and-verification-widgets-follow-the-browser.md`](./payment-and-verification-widgets-follow-the-browser.md) | Stripe's card form and the Turnstile widget are given no language |
| [`klingon-language-tag-in-search-metadata.md`](./klingon-language-tag-in-search-metadata.md) | `hreflang="tlh"` and `og:locale="tlh"` are emitted knowingly; search engines may ignore them |
| [`german-conventions-and-the-content-scan.md`](./german-conventions-and-the-content-scan.md) | The German conventions give a price and a date form that the content scan rejects |
| [`source-comments-name-the-retired-plan.md`](./source-comments-name-the-retired-plan.md) | Seven TypeScript files name a path under the deleted plan directory |

## Questions the operator has not answered

| File | Question | Reading in force |
| --- | --- | --- |
| [`q01-never-by-address.md`](./q01-never-by-address.md) | Does "never by address" mean the network address or the URL? | The network address and location |
| [`q02-remembering-a-language.md`](./q02-remembering-a-language.md) | Does the site remember a visitor's language? | No |
| [`q03-order-emails-in-english.md`](./q03-order-emails-in-english.md) | Does "the site" include the order e-mails? | No. They stay English |
| [`q04-klingon-script.md`](./q04-klingon-script.md) | Klingon in pIqaD or in Latin letters? | Latin letters |
| [`q05-translated-url-paths.md`](./q05-translated-url-paths.md) | Are URL paths translated? | No |
| [`q06-prevailing-language-clause.md`](./q06-prevailing-language-clause.md) | Must a translated legal page say which language prevails? | No clause is added |
| [`q07-cards-and-box.md`](./q07-cards-and-box.md) | Are the cards and the box translated? | No. Only the rulebook |
| [`q08-klingon-country-names.md`](./q08-klingon-country-names.md) | Country names in the Klingon edition? | English, as the shop names them |
| [`q09-estonian-legal-pages.md`](./q09-estonian-legal-pages.md) | Is the Estonian legal set translated again? | No |
| [`q10-pinned-image-on-a-worker.md`](./q10-pinned-image-on-a-worker.md) | Can a worker run the pinned Playwright image? | It could not |
| [`q11-implementer-name-in-the-task-schema.md`](./q11-implementer-name-in-the-task-schema.md) | Should the task schema admit `claude-lead`? | The plan used it; the validator rejects it |
| [`q12-destination-change-from-a-prefixed-basket.md`](./q12-destination-change-from-a-prefixed-basket.md) | Does a prefixed basket need a POST to change destination? | No |

The question numbers are those of the retired plan's section Questions.
Decision [0001](../decisions/0001-locale-chosen-by-url.md) cites Q1, Q2 and
Q5 by the same numbers.
