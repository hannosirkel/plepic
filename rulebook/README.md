# Rulebook frame map

`layout/frames.ts` is generated from the live text in the published English
rulebook. It records each sheet's size and each extracted text frame's box (in
PDF points, measured from the top left), type style, colour, alignment, and
English text. Consecutive lines of a paragraph are grouped into one frame.
T013 reviews the resulting frames by hand before translated text is written.

Prerequisites: Node.js 24.18 or newer and dependencies installed with `npm ci`
at the repository root. No font files, InDesign source, Poppler, Ghostscript,
or network connection are needed for this extraction step. The source PDF is
`storefront/public/documents/lunar-base-rulebook.pdf`.

```bash
npm run rulebook:extract
```

The command overwrites `rulebook/layout/frames.ts` deterministically. Check
that rerunning it leaves no diff. `bash scripts/validate` tests the sheet count,
box bounds, unique frame ids, and word coverage against PDF.js.

Text baked into pictures is outside PDF.js's live text stream. A visual review
of all 25 published sheets found these English-bearing picture elements:

| Sheets | Picture text | Decision for translated editions |
| --- | --- | --- |
| 1 | The Lunar Base logo | Keep: it is the product name and logo. `RULE BOOK` below it is live text and has a frame. |
| 3–24 | Reproductions of printed cards, card backs, and counters | Keep: players use the English printed components, so these pictures must match them. Explanatory labels beside them are live text and have frames. |
| 25 | Lunar Base logo, website and social media addresses or handles | Keep: these are fixed brand marks and addresses. The QR code is also artwork, not text to translate. |

The frame map deliberately contains only live text. Future layout reviews
should compare a rendered translated sheet with the published one so these
picture elements stay in place.
