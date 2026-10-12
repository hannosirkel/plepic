# The German conventions name forms the content scan rejects

Opened 2026-10-12, when the site-translation plan was retired. The plan's
review raised it and it was not taken up.

## What is open

[`docs/current/translation/de.md`](../current/translation/de.md), section
Typography and numbers, gives two forms that no content string may hold.

| The conventions say | The scan in `content/content.test.ts` |
| --- | --- |
| Write prices as `19,90 €` | Fails on a currency symbol, and on two digits after a comma or a full stop |
| Write a compact date as `12.10.2026` | Reads `12.10` as a money amount and fails |

No German string breaks the scan today: `bash scripts/validate` passes. A
price is never written in a content string in any edition. The site formats
every amount with the `de-DE` format. The risk is the next translator, who
follows the conventions and meets a failing test.

The Estonian conventions already say both things:
[`docs/current/translation/et.md`](../current/translation/et.md), section
Typography, numbers and dates.

## What closing it takes

Reword the paragraph in `de.md` as `et.md` has it: never write a price or a
currency in a content string, and write a date out, "12. Oktober 2026". The
file was moved unchanged when the plan was retired, so the edit is a change
of its own.
