# French, Spanish and Italian rulebooks await a native reader

Opened 2026-10-21, when the plan for these three rulebooks was retired.

The text in `rulebook/text/{fr,es,it}/` is a model translation. A check holds
it to the English frame by frame: the same frames, blocks and digits in the
same order, and the glossary's terms. A review read every rule and found none
changed. No native speaker has read it.

## Terms least settled

| Term | fr | es | it |
| --- | --- | --- | --- |
| Supply | étalage | Suministro | Mercato |
| Draft | sélectionner | Adquirir | Prelevare |
| Steal | — | Sustraer, chosen so it does not clash with Robar (Draw) | — |
| Parcel machine (shop copy, not in the rulebook) | consigne automatique | taquilla de paquetería | locker per pacchi |

Each glossary in `content/glossary/{fr,es,it}.ts` and each conventions file in
`docs/current/translation/` records the other choices.

## Calls made for the layout

| Call | Where |
| --- | --- |
| The six player labels on sheet 10 are in title case in es and it, because the capitals do not fit the dashed cards at the 90% type floor. fr keeps capitals | `s10.f08`–`f18` |
| fr and it say "the actions" where English says "action(s)", because the longer form runs under circle A | `s09.f04` |
| The Italian credits on sheet 24 are translated, as es and fr are | `s24` |

## A typo in the English source

Sheet 23 reads "**Shackleton** UN-backed Shackleton aims…". Each translation
names Shackleton once. The English PDF is the file as printed and is never
rebuilt.

## What closing it takes

A native reader of each language reads the PDF beside the English one, and
the glossary and text change where they say. Each change rebuilds that
language's PDF, as [`rulebook.md`](../current/rulebook.md) describes.
