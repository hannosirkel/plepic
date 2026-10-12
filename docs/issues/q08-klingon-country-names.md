# Q8: country names in the Klingon edition

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

The basket and the checkout list delivery countries. German and Estonian
names come from ICU. ICU has no data for Klingon.

## Reading in force

The Klingon edition shows each country as the shop names it in English. A
carrier needs the real name, and an invented Klingon name for a country would
be a coined word on an address form.

## Where it shows

`destinationNameIn` in `storefront/src/lib/destination.ts` answers with the
English name when ICU does not support the edition's language.
`storefront/tests/english-leak-exemptions.ts` lets a country keep its English
name in an edition whose own name for it is the same, and `storefront/tests/destination.test.ts` holds the
names per edition.

## If the answer differs

Klingon names need a table of the delivery countries in
`content/tlh/interface.ts` or beside it, a source or a recorded construction
for each name in the lexicon, and the removal of the exemption. The forms
would still submit the English name.
