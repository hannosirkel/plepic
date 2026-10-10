# 0002. Set translated rulebook text over the stripped English artwork

- **Date:** 2026-10-10
- **Status:** accepted

## Context and problem statement

The operator's brief of 2026-10-10 asks for the rulebook PDF in German,
Estonian and Klingon. The published rulebook is one English PDF of 25 sheets,
made in InDesign, with live text. No InDesign source exists. The site needs a
repeatable way to produce a translated PDF that keeps the artwork and holds
real text.

## Considered options

- A. Strip the text from the published PDF, set translated text over the
  remaining artwork in HTML, and print it with Chromium.
- B. Translate in the InDesign source. None exists.
- C. Start from the print file in `Lunar-production.zip`. Its text is converted
  to outlines, and it has no editable source.

## Decision

Chose option A.

### Sources

| Source | Use |
| --- | --- |
| `storefront/public/documents/lunar-base-rulebook.pdf` | The artwork and the layout. Its text is live, so positions, fonts and sizes are read from it |
| `~/gascity/rigs/lunar-base/docs/inputs/rulebook.md` | A transcription. It cross-checks the extracted English text and its reading order. It belongs to another project and is only read |
| `Lunar-production.zip` | Not used |

### Pipeline

| Step | Tool | Result |
| --- | --- | --- |
| 1. Strip the text | Ghostscript, `-dFILTERTEXT` | The 25 sheets with artwork only |
| 2. Convert each sheet | `pdftocairo -svg` | One vector underlay per sheet |
| 3. Read the frames | `pdfjs-dist` | `rulebook/layout/frames.ts`: per text frame its sheet, box, font, size, weight, colour, alignment and English text |
| 4. Write the text | A person or a model | `rulebook/text/<locale>/`: one string per frame id, in a total record, so a missing frame does not compile |
| 5. Compose | HTML | Each sheet is a page with the underlay as background and the frames positioned over it |
| 6. Print | Playwright's Chromium, tagged PDF, the edition's `lang` | `storefront/public/documents/lunar-base-rulebook-<locale>.pdf` |

The result is real text: selectable, searchable and tagged, with headings and
lists marked up and the document language set.

### Fonts

The published PDF sets its text in three families. The build uses the same
three and no other. It does not substitute: a weight it cannot load is an
error.

| Family | Where the PDF uses it | Origin | Licence |
| --- | --- | --- | --- |
| MADE Evolve Sans: Regular, Regular EVO, Light, Medium, Bold | Headings and body text | OTF files in the read-only input `~/lunarfiles`. They cover ä, ö, ü, ß, õ, š and ž (measured) | Desktop licence. Embedding in a read-only PDF is allowed. Distributing the files is not |
| Lato 2.0: Italic, Medium Italic, Bold Italic, Heavy Italic | The "Note:" callouts and labels such as "New Cards", on ten sheets | The `lato-font` package. The build that `@fontsource/lato` packages has no Medium and no Heavy weight | SIL Open Font License 1.1 |
| Josefin Sans: Bold | The list bullets, on four sheets. MADE Evolve Sans has no bullet glyph | The `@fontsource/josefin-sans` package | SIL Open Font License 1.1 |

The build reads the MADE Evolve Sans files from the read-only input. They are
never copied into this repository: it is public, and the licence forbids
distribution. One Minion Pro glyph on sheet 6 is a space and is dropped.

## Rationale

Options B and C are not available. The source that option B needs does not
exist, and the file of option C holds shapes, not text.

Option A needs only the published PDF, which is in the repository. Its text is
live, so every frame's position, font and size can be read from it, not
measured by eye.

The pipeline was tried on sheet 10 before the plan was written. The stripped
sheet kept all artwork and no text. A German paragraph with `Õ Š Ž ß` and a
Klingon sentence printed in MADE Evolve Sans. The output was tagged, and
`pdftotext` returned the text. The trial had three findings:

| Finding | Consequence |
| --- | --- |
| The vector underlay showed a few hairlines that the source does not have | The layout check compares artwork pixel by pixel. A sheet that fails uses a 300 dpi raster underlay |
| Chromium rounded the page to 567.12 x 282.96 pt against 566.93 x 283.46 pt | The build sets the page size explicitly. The check allows 1 pt |
| One sheet came to 0.5 MB | A whole rulebook is near 12 MB. The rulebook page states each file's size |

The accepted trade-off: a translated PDF is a new composition over the old
artwork, not the designer's file. Its type can differ in size and line breaks
from the English sheet, and a script cannot judge that in full.

## Consequences

- The English PDF is never rebuilt or replaced. It remains the file "exactly
  as printed".
- Text that is part of a picture stays English, the card faces above all. That
  is correct, because the cards are English. Every other piece of English that
  is not live text gets a patch and a frame, or a recorded reason to stay.
- The build needs Ghostscript, poppler, Playwright's Chromium and the MADE
  Evolve Sans directory. It runs on a worker's machine, not in CI, and its
  output is committed.
- A layout check runs after each build: sheet count and size, artwork, fit,
  collisions, glyphs and fonts, tagging and language, and file size.
- A reviewer compares all 25 sheet pairs by eye. No script does that part.
- The English text goes through the pipeline first. It must pass every check
  and match the published PDF within a set pixel ratio before a translation is
  built.
- A manifest records, per committed PDF, the hashes of its text, the frame map
  and the English PDF. A unit test fails when text changes without a rebuild.
- The translated PDF is for reading on screen. It is not print-ready.

The detail of each check and task is in `docs/working/site-translation/plan.md`
while the plan is active.
