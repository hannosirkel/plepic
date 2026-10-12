# Klingon translation conventions

Use Okrand's Latin spelling exactly. Capital letters distinguish sounds: `q`,
`Q`, `H`, `I`, `D` and `S` keep their case even at the beginning of a sentence.
Write the glottal stop as the plain ASCII apostrophe (`'`). Do not use pIqaD,
curly apostrophes, or CSS case changes. The site uses the `tlh` language tag.

Consult *The Klingon Dictionary* (TKD), *Klingon for the Galactic Traveler*
(KGT), and the Klingon Language Institute (KLI) word lists before choosing a
root. Add each root to `content/glossary/tlh-lexicon.ts` with its word class,
English gloss and source. A new root needs a source; do not infer a word from
English spelling. `scripts/klingon-words.test.ts` checks spelling and that
inflected words reduce to roots in this list.

For a concept without an attested root, make a short Klingon phrase or compound
from listed roots. Record the literal construction in `content/glossary/tlh.ts`.
For example, `Huch mI' jan` is money + number + device for Credit Counter.
Keep one construction across site and rulebook. Card labels and Station names
stay exactly as printed; at first use on a rulebook sheet, put the English
card label in brackets beside the Klingon term.

When a clear construction cannot convey the concept, keep the international
word as a loan. Add it to the named loan list in `scripts/klingon-words.ts`,
mark it as a loan in the glossary note, and explain it at first use. Proper
nouns are exempt only when entered on the named proper noun list, with exact
case. Do not use a spelling exception to admit an invented Klingon root.

The word check is deliberately a guard, not a translator. A passing check says
that each token has valid spelling and a listed root; a reviewer still checks
grammar, meaning, and the fit of phrases in the page and rulebook.
