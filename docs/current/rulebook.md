# Rulebook PDFs

The Lunar Base rulebook is published as seven PDFs: one for each of the four
editions of the site, and one for each of three rulebook-only languages
(French, Spanish and Italian). The English one is the file as printed. The
other six are built from it in this repository: translated text set over the
English artwork. The decision is in
[0002](../decisions/0002-translated-rulebook-pdf.md); why French, Spanish and
Italian are rulebook languages and not editions is in
[0003](../decisions/0003-rulebook-languages-beyond-editions.md).

`fr`, `es` and `it` are rulebook languages, not site editions. The site has no
route, prefix, selector entry or `hreflang` for them; `Locale` is unchanged.
`RulebookLanguage` in `content/rulebook-documents.ts` (the site locales plus
`fr`, `es`, `it`) keys the registry, and every edition's rulebook page links
every language that has a PDF.

[`rulebook/README.md`](../../rulebook/README.md) is the working reference for
the build. This document says what exists and why.

## The files

| Language | File under `storefront/public/documents/` | Size | Made by |
| --- | --- | --- | --- |
| `en` | `lunar-base-rulebook.pdf` | 8.9 MB | InDesign, by the designer. Never rebuilt |
| `de` | `lunar-base-rulebook-de.pdf` | 9.4 MB | `npm run rulebook:build -- de` |
| `et` | `lunar-base-rulebook-et.pdf` | 9.4 MB | `npm run rulebook:build -- et` |
| `tlh` | `lunar-base-rulebook-tlh.pdf` | 9.3 MB | `npm run rulebook:build -- tlh` |
| `fr` | `lunar-base-rulebook-fr.pdf` | 9.4 MB | `npm run rulebook:build -- fr` |
| `es` | `lunar-base-rulebook-es.pdf` | 9.4 MB | `npm run rulebook:build -- es` |
| `it` | `lunar-base-rulebook-it.pdf` | 9.4 MB | `npm run rulebook:build -- it` |

Each has 25 sheets. A built PDF holds real text: selectable, searchable and
tagged, with headings and lists marked up and the document language set.

`content/rulebook-documents.ts` registers the seven files with their size and
sheet count. The rulebook page of each edition links that edition's file and
states its size, and lists the other languages below it. `content/rulebook-documents.test.ts` fails when an edition
has no entry, or when an entry differs from the committed file.

A built PDF is for reading on screen. It is not print-ready.

## Sources

| Source | Use |
| --- | --- |
| `storefront/public/documents/lunar-base-rulebook.pdf` | The artwork and the layout. Its text is live, so every frame's position, font and size is read from it |
| `rulebook/layout/frames.ts` | Generated from that PDF: each sheet's size and each text frame's box, type, colour, alignment and English text |
| `rulebook/layout/overrides.ts` | The review of the frame map by hand: reading order, the role of each frame, and the boxes an edition grows |
| `rulebook/text/en.ts` | The reviewed English text, one string per frame |
| `rulebook/text/<locale>/` | The translated text. A total record over the frame ids, so a missing frame does not compile |
| `rulebook/layout/residual-english.md` | Every piece of English that is a picture, with the decision for each |
| The MADE Evolve Sans font files | Read at build time from a directory outside the repository |

No InDesign source exists. The print file has its text converted to outlines
and is not used.

Text that is part of a picture stays English: the card faces above all. That
is correct, because the cards are printed in English.

## Fonts

The English PDF sets its text in three families. A build uses the same three
and no other. It does not substitute: a face it cannot load is an error.

| Family | Comes from | Licence |
| --- | --- | --- |
| MADE Evolve Sans | OTF files in the directory `RULEBOOK_FONT_DIR` names | Desktop licence. Embedding in a read-only PDF is allowed. Distributing the files is not |
| Lato 2.0, four italic weights | The `lato-font` devDependency | SIL Open Font License 1.1 |
| Josefin Sans Bold | The `@fontsource/josefin-sans` devDependency | SIL Open Font License 1.1 |

The MADE Evolve Sans files are never copied into this repository. It is
public, and the licence forbids distribution. `rulebook/fonts.ts` is the exact
list of faces.

## Prerequisites

| Step | Needs |
| --- | --- |
| Every step | Node.js 24.18 or newer, and `npm ci` at the repository root |
| Extract | Nothing more |
| Build | Ghostscript (`gs`), Poppler (`pdftocairo`, `pdftoppm`), ImageMagick (`magick`), Playwright's Chromium (`npx playwright install chromium`), and `RULEBOOK_FONT_DIR` |
| Check | Ghostscript, Poppler (`pdftotext`, `pdffonts`, `pdfinfo`, `pdftoppm`) and ImageMagick. Neither the fonts nor Chromium |

A missing command, browser or font file stops the build with an error.

The build runs on a worker's machine, not in CI: CI has no font directory.
The built PDF is committed.

## Commands

```bash
npm run rulebook:extract
RULEBOOK_FONT_DIR=/path/to/Fonts npm run rulebook:build -- <locale>
npm run rulebook:check -- <locale>
```

| Command | Does |
| --- | --- |
| `rulebook:extract` | Writes `rulebook/layout/frames.ts` from the English PDF. Rerunning it leaves no diff |
| `rulebook:build -- <locale>` | Strips the text from the English PDF, sets the edition's text over the artwork in HTML, and prints a tagged PDF with Chromium. Writes the PDF and the edition's entry in `rulebook/manifest.json` |
| `rulebook:build -- en` | Builds an English proof into the ignored `rulebook/.work/en/`. It proves the pipeline and is not committed |
| `rulebook:check -- <locale>` | Reads the built PDF and prints one line per check. Exits non-zero when one fails |

To change a string of a translated rulebook: edit `rulebook/text/<locale>/`,
build that edition, run the check, look at the sheet pairs, and commit the
text, the PDF and `rulebook/manifest.json` together.

## The fit floors

A translation runs longer than the English text. The build shrinks a frame's
type step by step until the text fits, and stops at these floors.

| Floor | Value |
| --- | --- |
| Type size | 90% of the frame's English size |
| Absolute type size | 6 pt. A frame already under 6 pt in English keeps its English size |
| Leading | 95% of the frame's English leading |
| Text outside its box | 3 pt |

`rulebook/thresholds.ts` holds every limit, each with the value measured on
the English proof.

**Known trade-off: sibling frames at different sizes.** The ladder runs per
frame, so two frames that stand side by side and read as a pair, such as the
entries of one list or the labels of one row, can end at different sizes: one
fits at 100% and the other needs 90%. This is accepted. Making siblings match
would shrink frames that fit, and a reviewer sees the difference only beside
the English sheet. Where a pair's difference is plain on the page, the remedy
is a wider box for the shrunk frame or shorter text, not a shared size.

A frame that does not fit at the last step is printed there and marked
`"fits": false`. The build names it, leaves the manifest alone and exits
non-zero. There are two remedies:

| Remedy | Where | Use it when |
| --- | --- | --- |
| Shorten the text | `rulebook/text/<locale>/` | The sheet has no room around the frame. The rule the text states must stay the same |
| Grow the frame's box | The edition's entry in `editionBoxes`, `rulebook/layout/overrides.ts` | The sheet is empty beside or under the frame |

## The layout check

| Check | Rule |
| --- | --- |
| Sheets | 25 sheets, each within 1 pt of the English sheet's size |
| Artwork | With the text stripped from both, each sheet differs from the English sheet in at most 2% of its pixels |
| Fit | The floors above |
| Collisions | No two frames' ink overlaps by over 1 pt more than in the English PDF |
| Glyphs | `pdftotext` returns every frame's text. No replacement character. Every font is embedded and is one `rulebook/fonts.ts` allows |
| Structure | The PDF is tagged, its language is the edition's, and each sheet has one structure element per frame |
| Size | At most 16 MB |
| English proof | `en` only: each sheet differs from the published sheet in at most 9% of its pixels |

The check reads the built PDF alone, so a committed PDF can be checked without
a rebuild.

The check also writes `rulebook/.work/<locale>/compare/sheet-NN.png`: the
built sheet beside the English sheet. A reviewer looks at all 25 pairs. No
script does that part.

## The manifest

`rulebook/manifest.json` records what each committed PDF was built from: the
hash of the edition's text files, of `rulebook/layout/frames.ts`, of
`rulebook/layout/overrides.ts`, of the English PDF, and of the built PDF
itself. It also pins the English PDF on its own.

`rulebook/manifest.test.ts` runs in `bash scripts/validate`. It fails when a
recorded hash differs from the current file, when a text file was added to an
edition after its build, and when a translated PDF has no entry. Text or
layout changed without a rebuild therefore cannot be merged.

`bash scripts/validate` does not run the build or the layout check. It holds
the text and the manifest:

| Test | Holds |
| --- | --- |
| `rulebook/frames.test.ts` | The frame map: sheet count, box bounds, unique ids, word coverage, and the hand review |
| `rulebook/text/translations.test.ts` | Each edition has a string for every frame, keeps the English frame's blocks and list numbers, and holds its digits in the same order |
| `content/glossary.test.ts` | Rulebook text uses the glossary's terms, as site copy does |
| `scripts/klingon-words.test.ts` | Every Klingon word is validly spelled and built from a root in the lexicon |
| `rulebook/manifest.test.ts` | No committed PDF is older than its text or layout |

## Why the English PDF is never rebuilt

| Reason | Detail |
| --- | --- |
| It is the file as printed | The designer made it in InDesign, and it matches the printed booklet. A rebuilt file would be a new composition by a browser |
| It is the source | Every edition's artwork and frame map is read from it. The manifest pins its hash, so a changed English PDF fails `bash scripts/validate` for every edition |
| The pipeline does not reproduce it exactly | The English proof differs from it by up to 9% of a sheet's pixels. The browser and InDesign place a face differently in its line, and the built type stands up to 2.6 pt higher |

The English proof exists to test the pipeline. It stays in the ignored work
directory, and `rulebook/editions.ts` gives it no path under
`storefront/public/documents/`.
