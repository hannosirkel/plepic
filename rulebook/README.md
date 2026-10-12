# Rulebook frame map

`layout/frames.ts` is generated from the live text in the published English
rulebook. It records each sheet's size and each extracted text frame's box (in
PDF points, measured from the top left), type style, colour, alignment, and
English text. Consecutive lines of a paragraph are grouped into one frame.

Extraction cannot know meaning, so the frame map is reviewed by hand:

| File | Holds |
| --- | --- |
| `layout/overrides.ts` | The review. Per sheet: which generated frames to merge, split or drop, then every frame once in reading order with its role (`h1`, `h2`, `p`, `ol`, `ul`, `caption`, `page-number`, `label`) and any corrected type or alignment. It exports the reviewed layout and the `FrameId` union |
| `text/schema.ts` | `RulebookText`, a total record over `FrameId`, and the small markup a frame's text may use, with its parser |
| `text/en.ts` | The reviewed English text, one string per frame |
| `layout/residual-english.md` | Every piece of English that is a picture, not live text, with a decision for each |

A translated edition is another `RulebookText`. It compiles only when it has
a string for every frame.

Prerequisites: Node.js 24.18 or newer and dependencies installed with `npm ci`
at the repository root. No font files, InDesign source, Poppler, Ghostscript,
or network connection are needed for this extraction step. The source PDF is
`storefront/public/documents/lunar-base-rulebook.pdf`.

```bash
npm run rulebook:extract
```

The command overwrites `rulebook/layout/frames.ts` deterministically. Check
that rerunning it leaves no diff. `bash scripts/validate` tests the sheet count,
box bounds, unique frame ids, and word coverage against PDF.js. It also tests
the review: every frame has a role, each sheet's reading order is a
permutation of its frames, the English text parses, and each frame's text is
what the PDF prints inside that frame's box.

Text baked into pictures is outside PDF.js's live text stream. A visual review
of all 25 published sheets found these English-bearing picture elements:

| Sheets | Picture text | Decision for translated editions |
| --- | --- | --- |
| 1 | The Lunar Base logo | Keep: it is the product name and logo. `RULE BOOK` below it is live text and has a frame. |
| 3–24 | Reproductions of printed cards, card backs, and counters | Keep: players use the English printed components, so these pictures must match them. Explanatory labels beside them are live text and have frames. |
| 25 | Lunar Base logo, website and social media addresses or handles | Keep: these are fixed brand marks and addresses. The QR code is also artwork, not text to translate. |

The frame map deliberately contains only live text. Future layout reviews
should compare a rendered translated sheet with the published one so these
picture elements stay in place. `layout/residual-english.md` goes through the
same pictures sheet by sheet.

## Building the translated PDF

Run `RULEBOOK_FONT_DIR=/path/to/Fonts npm run rulebook:build -- en` to build the
English proof in the ignored `rulebook/.work/en/` directory. The published
English PDF remains untouched. A translated edition builds to
`storefront/public/documents/lunar-base-rulebook-<locale>.pdf` once its text
module has been added to `editions.ts`.

Prerequisites are Ghostscript (`gs`), Poppler (`pdftocairo` and `pdftoppm`),
Playwright Chromium (`npx playwright install chromium`), and the directory of
MADE Evolve Sans OTF files specified by `RULEBOOK_FONT_DIR`. ImageMagick's
`magick compare` is used to measure vector rendering differences. A missing
command, browser or mapped font file stops the build with an error.

The build strips live text with Ghostscript, makes SVG artwork underlays with
Poppler, and chooses a 300 dpi raster underlay whenever the vector render
exceeds a 0.5% pixel difference from the stripped PDF. The choice and ratio
are recorded in `rulebook/.work/<locale>/underlays.json`. The comparison
blurs both renders by one pixel and allows a 20% colour tolerance so edge
antialiasing and soft shadows do not force a raster underlay. The HTML uses the
reviewed frame order and roles. A frame starts at its English size and can
shrink to 90%, with measured English line spacing that can shrink to 95%
at each size step and a 6 pt minimum. Paragraphs and list items have spacing
between blocks. Frames already smaller than 6 pt in the published English
layout keep their original size. Selected sizes and line-spacing scales are
recorded in `fit.json`. Chromium prints a tagged
PDF at the sheet sizes.

Type is set with `text-rendering: geometricPrecision`. Without it Chromium
rounds every glyph's advance to a whole pixel, the words spread, and English
text no longer fits its own boxes: 76 of the 438 English frames then shrink,
against 28 with it.

Five circled letters stand inside a line of another frame, on sheets 9 and
16. Each is a `label` frame of its own and stays where English has it, because
its circle is artwork. The other frame's text names it where it stands
(`{s09.f11a}`), and the build keeps the line clear there: it leaves the
circle's width (`room` in `layout/overrides.ts`) empty and moves that gap
right until it lies around the letter. A translation has to bring the name
into the letter's own line, with no more text before it than English has;
otherwise the gap cannot reach the letter and the frame does not fit.

A frame whose text does not fit at the last step of that ladder is printed
there, and `fit.json` marks it `"fits": false`. The build names each such
frame, leaves `manifest.json` alone and exits non-zero. The PDF is still
written, so that the layout check can measure the frame and the reviewer can
see it.

The PDF uses exactly three font families:

| Family | File source | Licence |
| --- | --- | --- |
| MADE Evolve Sans | OTF files in `RULEBOOK_FONT_DIR`, read only | Desktop licence permits read-only PDF embedding; font files may not be redistributed |
| Lato 2.0 | `lato-font` devDependency, Italic, Medium Italic, Bold Italic and Heavy Italic | SIL Open Font License 1.1; its packaged README contains the OFL text |
| Josefin Sans | `@fontsource/josefin-sans` devDependency, Bold | SIL Open Font License 1.1 |

`fonts.ts` is the exact face allowlist. The Minion Pro space on sheet 6 is
dropped; no Minion Pro file is loaded. No font file is copied into Git.

## Giving a translation room

A translation runs longer than the English text. The build shrinks a frame's
type as far as the ladder allows; past that there are two remedies, and
`npm run rulebook:check -- <locale>` names every frame that needs one.

| Remedy | Where | Use it when |
| --- | --- | --- |
| Shorten the text | `text/<locale>/` | The sheet has no room around the frame. The rule the text states must stay the same |
| Grow the frame's box | the edition's entry in `editionBoxes`, `layout/overrides.ts` | The sheet is empty beside or under the frame: a Contents entry, a caption, a heading, a line of a list in a panel |

An `editionBoxes` entry adds points to a frame's box on the sides it names
(`left`, `right`, `up`, `down`), for that edition alone. The English layout is
untouched, and the frame keeps its English box as `englishBox`: that is where
the published text stands, which is what the leading and the Collisions row
are measured against. The Fit row holds the edition's text to the grown box.
Text starts at the top of its box and keeps the frame's alignment, so a
centred frame grows by the same amount on both sides. A box is honest when it
holds the text: one made too narrow, to push the type down the ladder, leaves
the text standing outside it by nearly the 3 pt the check allows.

`skip` is for a frame whose text stands around a picture. Six action names on
sheets 13 and 15 stand over an icon in a column too narrow for the German
name and the printed word beside it (`Abwerfen (Discard)`), and with no room
for two lines above the icon. The name stays over the icon, `skip` leaves that
many points empty above the text's last line, and the printed word stands
under the icon. The box has to grow `down` by as much.

Every entry is a judgment made on the rendered sheet. The check cannot tell
empty ground from a picture, so a grown box is looked at in
`rulebook/.work/<locale>/compare/` like everything else.

## Checking the layout

Run `npm run rulebook:check -- <locale>` after a build. It prints one line per
check and exits non-zero when any of them fails, with a further line for each
frame, sheet or font at fault.

| Check | Rule |
| --- | --- |
| Sheets | 25 sheets, each within 1 pt of the English sheet's size |
| Artwork | With the text stripped from both, each sheet differs from the English sheet in at most 2% of its pixels |
| Fit | Every frame is set at 90% of its English size or more and never under 6 pt, with 95% of its English leading or more, and its text stands at most 3 pt outside its box: the English box, or the one `editionBoxes` grew for the edition |
| Collisions | No two frames' ink overlaps by over 1 pt more than it does in the published English PDF |
| Glyphs | `pdftotext` returns every frame's text from where the frame was printed; no replacement character; every font is embedded and is one `fonts.ts` allows |
| Structure | The PDF is tagged, its language is the edition's, and each sheet has one structure element per frame, with headings and lists marked up |
| Size | At most 16 MB |
| English proof | `en` only: each sheet differs from the published sheet in at most 9% of its pixels |

The check reads the built PDF alone, never the build's own record of what it
did, so a committed PDF can be checked without a rebuild. Chromium tags one
structure element per frame, in the order of the HTML; that is how the check
knows which text in the PDF belongs to which frame, wherever it landed. The
Fit and Collisions rows are measured on that text, and the Glyphs row asks
`pdftotext` for the words standing there.

Collisions compares ink run by run: each stretch of text the PDF sets in one
piece, as tall as its type. A box around a whole frame, or around a whole
line, would not do. A circled letter set inside a paragraph's line lies
inside the paragraph's box, and it collides with the paragraph only when the
line runs through it instead of leaving it a gap. What two frames share in
English is measured the same way on the published PDF, each run given to the
smallest frame whose box holds it. No two frames share any ink there.

Prerequisites are Ghostscript (`gs`), Poppler (`pdftotext`, `pdffonts`,
`pdfinfo` and `pdftoppm`) and ImageMagick (`magick`). The check needs neither
the font files nor Chromium.

`thresholds.ts` holds every limit, each with the value measured on the
English proof beside it. Two of those values are worth knowing. Chromium
prints every baseline on a whole CSS pixel (0.75 pt), so leading can only be
bounded from a run of lines, not read off one pair. And the built type
stands up to 2.6 pt higher than the published type, because the browser and
InDesign place a face differently in its line; that is most of the 3 pt a
frame is allowed outside its box, and most of what the English proof differs
by.

The check also writes `rulebook/.work/<locale>/compare/sheet-NN.png`: the
built sheet on the left, the English sheet on the right. A reviewer looks at
all 25 pairs and records the result. That is the part no script can do.

## The manifest

`manifest.json` records what each committed PDF was built from: the hash of
the edition's text files, of `layout/frames.ts`, of `layout/overrides.ts`, of
the published English PDF, and of the built PDF itself. It also pins the
English PDF on its own, since every edition is laid over it and it is never
rebuilt. The build writes an edition's entry once its PDF is written and every
frame fits. The English proof is not committed and has no entry.

`manifest.test.ts` runs in `bash scripts/validate`. It fails when a recorded
hash differs from the current file, when a text file was added to an edition
after its build, and when a translated PDF in
`storefront/public/documents/` has no entry. Text or layout changed without a
rebuild therefore cannot be merged: build the edition again, run the layout
check, and commit the PDF with the manifest.
