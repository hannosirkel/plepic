# Q4: Klingon in pIqaD or in Latin letters

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

The brief asks for Klingon. It does not say in which script.

## Reading in force

Latin letters, in Okrand's spelling, with case kept exactly. No pIqaD.

| Reason | Detail |
| --- | --- |
| Encoding | pIqaD has no standard Unicode encoding. It lives in a private use area that only special fonts cover |
| The brand font | MADE Evolve Sans has no pIqaD glyphs, so neither the site nor the rulebook PDF could set it |
| Checking | The Klingon word check reads Latin spelling |

## Where it shows

[`docs/current/translation/klingon.md`](../current/translation/klingon.md)
holds the conventions. `storefront/tests/klingon-case.test.ts` guards the
case of Klingon text against stylesheets.

## If the answer differs

pIqaD needs a font licensed for the web and for PDF embedding, a transliteration
step from the Latin text, a new rulebook build with a fourth font family, and
a decision on what a reader without the font sees.
