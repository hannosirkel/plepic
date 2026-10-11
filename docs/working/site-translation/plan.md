# Plan: translate the site and the rulebook

German, Klingon and Estonian editions of the site, a language selector, and a
translated rulebook PDF in each of the three languages. English stays the
default. 46 tasks, one pull request each, in one linear stack; they are in
[`tasks.json`](./tasks.json).

The brief is the operator's, dated 2026-10-10. It is not in this repository.
Its requirements are restated in [Requirements](#requirements) so this plan
can be read alone.

## Requirements

| # | Requirement | Where the plan meets it |
| --- | --- | --- |
| R1 | The site is translated into German, Klingon and Estonian | M3, M4, M5 |
| R2 | The site gets a language selector | [The selector](#the-selector), T009 |
| R3 | No language is preselected from the visitor's IP address or location. The default stays English | [How a locale is chosen](#how-a-locale-is-chosen), T010 |
| R4 | The rulebook PDF is translated into all three languages | [The rulebook PDF](#the-rulebook-pdf), M2, T026, T034, T044 |
| R5 | Every translation is pre-approved, legal pages and rulebook included. Nobody stops to ask whether a text may be translated | Translated legal pages are marked `operator-approved`, citing this decision |
| R6 | Translations are written by Claude Opus or Codex Sol. Reviews are done by Claude Fable or Codex Astra | `implementer` in `tasks.json`; the dispatcher pairs the reviewer |
| R7 | Work lands as pull requests within the size guidance, stacked | One task is one pull request; each needs the one before |
| R8 | One worker at a time | The stack is linear, so nothing can run side by side |
| R9 | Agents do not push and do not open pull requests | Every task ends as a local branch |
| R10 | The repository is public: no credential, live hostname or per-environment value. No fabricated photography, reviews or awards | The existing content scans run on every translated file; see [Tests](#tests) |
| R11 | Read-only inputs stay read-only | The rulebook build reads `~/lunarfiles` and writes only inside the repository |

## Where the site is today

Read this before any task. It is the behaviour the stack starts from; T001
moves it into `docs/current/locales.md`.

| Fact | Where |
| --- | --- |
| A locale is an edition of the site with a language tag and a URL prefix. `en` has no prefix. `et` is served under `/et` | `content/routes.ts`: `LOCALES`, `LOCALE_DEFINITIONS` |
| `et` publishes the five legal pages and nothing else | `content/index.ts`: `pagesByLocale`; `content/legal/et/` |
| Every locale-keyed table is a total `Record<Locale, T>`, so a new locale does not compile until each table has it | `content/schema.ts`: `LocalizedContent` |
| A non-default locale must carry all five legal pages, mirroring the English structure | `content/content.test.ts` |
| Prefixed editions are served by one catch-all route. A route is served only when the edition publishes it and a locale-aware renderer exists | `storefront/src/app/[locale]/[[...segments]]/page.tsx`, `storefront/src/app/localized-routes.tsx` |
| Only the legal pages have a locale-aware renderer. The other pages import the English content modules directly | `storefront/src/components/` |
| About 60 reader-facing strings are written inside components, not in `content/` | for example `LunarBaseMockup.tsx`, `StripePaymentReturn.tsx`, `ConsentManager.tsx` |
| Canonical, `hreflang` and the sitemap are computed from `pagesByLocale` by one function each | `storefront/src/lib/seo.ts`, `storefront/src/lib/sitemap-contract.ts` |
| The footer has a language switcher. It lists the other editions that publish the current route | `storefront/src/components/SiteFooter.tsx` |
| Nothing reads `Accept-Language`, an IP address or a location to pick a locale | `storefront/src/proxy.ts`, `storefront/src/lib/urls.ts` |
| Prices are formatted with the fixed tag `en-IE` | `storefront/src/lib/catalogue.ts`, `storefront/src/lib/cart.ts` |
| The rulebook is one English PDF: 25 sheets, live text, made in InDesign | `storefront/public/documents/lunar-base-rulebook.pdf` |
| No InDesign source exists. The print file in `Lunar-production.zip` has its text converted to outlines | `~/lunarfiles` |
| `README.md` still says the site is published in one locale | `README.md`, section Locales |

## The site

### Where translated copy lives

Copy stays in `content/`. The English modules are not edited: their diff stays
empty, as it did when `et` was added.

| Copy | English | Each other edition |
| --- | --- | --- |
| Legal pages | `content/legal/*.ts` | `content/legal/<locale>/*.ts` (exists for `et`) |
| Publisher, product, proof, support, shop | `content/publisher.ts`, `lunar-base.ts`, `proof.ts`, `support.ts`, `shop.ts` | `content/<locale>/` with the same file names |
| Page titles and descriptions | `content/pages.ts` | `content/<locale>/pages.ts` |
| Strings now written inside components | new `content/interface.ts` | `content/<locale>/interface.ts` |
| Header and footer labels | `storefront/src/lib/chrome-strings.ts` (unchanged home) | a new key in the same table |
| Delivery method names | `deliveryMethodNames` in `content/interface.ts`, keyed by method id | the same key in `content/<locale>/interface.ts` |
| Country names in the basket and the checkout | `storefront/mock/countries.json` | no file: `destinationNameIn` asks ICU for the edition's name |

The last two rows are labels that reach the page from data, not from
`content/`: Medusa returns a delivery method's name in English, and the
country list holds English names. A visitor reads them all the same, so each
is translated or kept on purpose (T006, T007). The forms still submit the
English value, and the storefront still recognises a method by the name
Medusa returns.

One new registry, `content/editions.ts`, holds
`siteCopyByLocale: LocalizedContent<SiteCopy | null>`. `SiteCopy` is the shape
of the English modules, so a translated module that lacks an export does not
compile. `null` means "this edition has no site copy yet". It is what lets
`et` stay legal-only until M4, and it is removed in T045, after which an
edition without full copy does not compile.

Components stop importing English modules. They take a `locale` and read
`siteCopyByLocale`. T003 to T008 do this one page group at a time and move
each group's literals into `content/interface.ts`. English output does not
change in those tasks.

A translation lands in two steps, because a locale cannot be half registered:

| Step | What lands | Reachable by a visitor |
| --- | --- | --- |
| Staged | Files under `content/<locale>/` or `content/legal/<locale>/`. They compile, the content scans read them, and the mirror test compares them with English | No |
| Published | The registry entry and the routes in `pagesByLocale` | Yes |

The mirror test (T002) runs over every edition directory on disk, registered
or not. It fails when a translated module differs from the English one in
anything but prose: export names, list lengths, anchors, source ids, link
targets and placeholders must be equal.

### How a locale is chosen

By the URL the visitor opened, and by nothing else.

| Rule | Detail |
| --- | --- |
| The path prefix is the choice | `/de/...` is German, `/tlh/...` is Klingon, `/et/...` is Estonian, no prefix is English |
| The server never guesses | It does not read `Accept-Language`, an IP address, a location header, the delivery-destination cookie or the delivery country to pick a language |
| No redirect chooses a language | `/` always answers in English, for every visitor |
| The choice is not stored | No language cookie. Links inside an edition keep its prefix, so the choice lasts while the visitor browses |
| Language and delivery country are separate | Choosing Germany as destination does not switch to German. Choosing German does not change the destination |

T010 guards this with two tests. A source scan fails when anything under
`storefront/src` reads `accept-language` or a client-address or location
header. A served test requests `/` with `Accept-Language: de`, a German
destination cookie and a forwarded address, and expects `<html lang="en">`
and English copy.

New editions:

| Locale | Language tag | Prefix | Selector label |
| --- | --- | --- | --- |
| `en` | `en` | none | English |
| `de` | `de` | `/de` | Deutsch |
| `et` | `et` | `/et` | Eesti |
| `tlh` | `tlh` | `/tlh` | tlhIngan Hol |

`tlh` is the ISO 639-2 code for Klingon and a valid BCP 47 tag. ICU has no
data for it, so two things are declared in `LOCALE_DEFINITIONS` instead of
left to a runtime default: the tag used to format prices (T006), and that
country names stay as the shop names them.

### The selector

One component, `LanguageSelector`, rendered in the header and in the footer.
It replaces the footer's inline switcher.

| Property | Behaviour |
| --- | --- |
| Form | A `<nav>` of plain links. It works without JavaScript and sets no cookie |
| Entries | Every edition that publishes the current route, each named in its own language, with `lang` and `hreflang` |
| Current edition | Shown, marked `aria-current="true"`, not a link |
| Target | The same route in the target edition, so a visitor on `/games/lunar-base` lands on `/de/games/lunar-base` |
| A route the target edition lacks | The edition is not offered on that page. After T041 every edition publishes every route, so this ends |
| Narrow viewport | Inside the navigation sheet |
| 404 page | Links to each edition's home page |

The basket survives a change of edition: it is kept by cart id in the
browser, and the id is not tied to a locale.

### Routes

All twelve route ids keep their English paths under each prefix. Paths are
not translated: `ROUTE_PATHS` stays the one place a path is written, and a
translated path would need a second table.

| Route group | Made locale-aware in | Note |
| --- | --- | --- |
| Home | T003 | |
| Lunar Base | T004 | Product structured data follows the edition's language |
| Support, rulebook page, forms | T005 | Server actions answer in the form's edition |
| Basket | T006 | `robots.txt` also disallows `/de/cart`, `/et/cart`, `/tlh/cart` and the checkout paths |
| Checkout | T007 | Country and delivery method names follow the edition. The Stripe return address keeps the edition's prefix |
| Payment return, consent banner, 404, document | T008 | The return page is served under the `checkout` route |

The payment-return address `/checkout/payment-return` is not a thirteenth
route id. A route id must have a `Page` in `content/pages.ts` and a share
image, and the return page has neither: it borrows the checkout route's
metadata today. The path is declared once, as `CHECKOUT_RETURN_PATH` beside
`ROUTE_PATHS`, and the catch-all route serves it for an edition that
publishes `checkout`.

`/en/...` stays a 404. Redirects keep carrying no locale.

### Metadata and sitemap

No new mechanism. `buildPageMetadata`, `alternateLinksFor` and
`buildSitemapEntries` already read `pagesByLocale`. When an edition publishes
a route, that route gains a canonical, an entry in every sibling's `hreflang`
set, and a sitemap entry with the same alternates.

| Item | Change |
| --- | --- |
| Title and description | From `content/<locale>/pages.ts`; unique within an edition (existing test) |
| `<html lang>` | From `LOCALE_DEFINITIONS`, as today |
| `og:locale` | From the language tag, as today |
| Share-card image and its `alt` | Image unchanged; `alt` is the translated title |
| `x-default` | The English URL, as today |
| Product structured data | Name and description from the edition's copy |

T010 extends `sitemap-contract.test.ts` and `seo.test.ts` to four editions:
each indexable route appears once per edition, and each `hreflang` set names
all four and `x-default`.

### Tests

All of these run in `bash scripts/validate` unless the row says otherwise.

| Test | Fails when | Added in |
| --- | --- | --- |
| Mirror | A translated module differs from English in structure | T002 |
| Content scans (existing) | A translated file holds a hostname, an absolute URL, a price, or exports a function | existing; cover new directories by construction |
| English leak | A page of a non-default edition renders a sentence of the English edition, or an English country or delivery method name where the edition has its own. Proper nouns and listed identical strings are exempt | T010 |
| No negotiation | Anything reads a language, address or location header to pick a locale | T010 |
| Routing (existing) | An edition publishes a route with no locale-aware renderer | existing |
| Glossary | A translated string uses a forbidden variant, or lacks the agreed term where the English string at the same key has it | T011 |
| Klingon words | A Klingon word is not built from the lexicon and the affix tables | T035 |
| Case | The `:lang(tlh)` rule that forbids a case change is missing, or a stylesheet holds a rule that could get past it. Klingon spelling is case-sensitive | T010 |
| Rulebook manifest | A committed rulebook PDF was built from text or layout that has since changed | T015 |
| Browser suite (CI only) | A translated route fails to render, the selector fails to move between editions, or Klingon text is shown in changed case | T009, T010, each publish task |

Screenshot baselines may be made only in the pinned Playwright image
(`README.md`, Browser screenshots). T009 changes the header on every page, so
it refreshes the existing baselines in that image. The publish tasks add
functional browser checks and no new baseline.

## The languages

### Glossary

One glossary serves the site and the rulebook. T011 builds the model and the
check; each language fills it in its first task.

| File | Holds |
| --- | --- |
| `content/glossary/terms.ts` | Term ids, the English term, and its class |
| `content/glossary/<locale>.ts` | Per term: the translation, its allowed inflected forms, forbidden variants, a note |
| `content/glossary.test.ts` | The check, over site copy and rulebook text |

| Class | Rule | Examples |
| --- | --- | --- |
| As printed | Never translated | Lunar Base, Plepic Games, card titles, Station names such as Terran Outpost |
| Translated with original | Translated; the English word follows in brackets at first use on a page or sheet, because the cards carry it | Agent, Module, Influence, Shuttle, Orb, Credit, Supply, Main Action |
| Translated | Translated freely but always the same way | deck, hand, discard pile, colonist, victory condition, basket, checkout, parcel machine |

The cards are printed in English and stay so. That is why the second class
exists: a German reader must be able to match the rulebook's word to the word
on the card.

The glossary is not exported from `content/index.ts`, so it reaches no
bundle.

### Conventions per language

| Language | Address | Other |
| --- | --- | --- |
| German | `du` in marketing copy and the rulebook; `Sie` on legal pages and in checkout acknowledgements | German quotation marks; neutral wording for players where it reads naturally |
| Estonian | `sina` in marketing copy and the rulebook; legal pages keep the register the existing `et` pages use | The glossary is reconciled with the terms those pages already use |
| Klingon | Imperative and second person as in the source | Okrand's Latin spelling, case kept exactly; no pIqaD script |

### Klingon

Klingon has a small fixed vocabulary, so the risk is invented words.

| Measure | Detail |
| --- | --- |
| Lexicon | `content/glossary/tlh-lexicon.ts` lists every root used, with an English gloss and a source: *The Klingon Dictionary*, *Klingon for the Galactic Traveler*, a later word list of the Klingon Language Institute, or `coined` |
| Coined terms | A concept with no word (VAT, cookie, parcel machine) is a compound or phrase built from lexicon roots, entered in the glossary with its construction. Where no construction is clear, the international word is kept as a loan and explained once |
| Word check | A script strips the closed sets of prefixes and suffixes from each word and requires the rest to be a lexicon root. Proper nouns and loans are on a named list |
| Spelling check | Every word must be a sequence of valid Klingon syllables |
| Proper nouns | Company name, addresses, product and card names stay as they are |

The reviewer then reviews a finite list of roots, not every sentence's
vocabulary.

### How quality is checked

| Check | By | Applies to |
| --- | --- | --- |
| Mirror, glossary, content scans, English leak | `bash scripts/validate` | every translation task |
| Word and spelling check | `bash scripts/validate` | Klingon |
| Review by the other model family | Fable reviews Sol's work, Astra reviews Opus's work | every task |
| Blind back-translation | The reviewer translates a sample back into English before reading the source, then compares meaning. Sample: every legal section, every rules sheet, and at least one string in five elsewhere | every translation task |
| Numbers | Every number, placeholder and cross-reference in a translated string equals the source's | mirror test for placeholders; reviewer for numbers in prose |
| Fit | The layout check of the rulebook; the browser suite for the site | rulebook and publish tasks |

A translation task's review notes record the back-translation sample and each
difference found.

## The rulebook PDF

### Sources

| Source | Use |
| --- | --- |
| `storefront/public/documents/lunar-base-rulebook.pdf` | The artwork and the layout. Its text is live, so positions, fonts and sizes can be read from it |
| `~/gascity/rigs/lunar-base/docs/inputs/rulebook.md` | A transcription, used to cross-check the extracted English text and its reading order. It belongs to another project and is only read |
| `Lunar-production.zip` | Not used. Its rulebook has outlined text and no editable source |

The published PDF sets its text in three families (`pdffonts`). The build
uses the same three and no other.

| Family | Where the PDF uses it | Origin | Licence |
| --- | --- | --- | --- |
| MADE Evolve Sans: Regular, Regular EVO, Light, Medium, Bold | Headings and body text | `~/lunarfiles/Web/Elements/Font/Fonts/`, OTF. The files cover ä, ö, ü, ß, õ, š and ž (measured) | Desktop licence: embedding in a read-only PDF is allowed, distributing the files is not |
| Lato 2.0: Italic, Medium Italic, Bold Italic, Heavy Italic | The "Note:" callouts and labels such as "New Cards", on ten sheets | The `lato-font` package. The Google Fonts build that `@fontsource/lato` packages has no Medium and no Heavy weight | SIL Open Font License 1.1 |
| Josefin Sans: Bold | The list bullets, on four sheets. MADE Evolve Sans has no bullet glyph | The `@fontsource/josefin-sans` package | SIL Open Font License 1.1 |

The MADE Evolve Sans files are read from the read-only input at build time.
They are never copied into the repository: it is public, and the licence
forbids distributing the files. The other two families arrive as
devDependencies, which their licence allows. One Minion Pro glyph on sheet 6
is a space and is dropped.

The build does not substitute. A weight it cannot load is an error, and the
layout check fails on any font name outside this table (T014, T015).

### How a translated PDF is produced

| Step | Tool | Result |
| --- | --- | --- |
| 1. Strip the text | Ghostscript, `-dFILTERTEXT` | The 25 sheets with artwork only |
| 2. Convert each sheet | `pdftocairo -svg` | One vector underlay per sheet |
| 3. Read the frames | `pdfjs-dist` | `rulebook/layout/frames.ts`: per text frame its sheet, box, font, size, weight, colour, alignment and English text |
| 4. Write the text | a person or model | `rulebook/text/<locale>/`: one string per frame id; a total record, so a missing frame does not compile |
| 5. Compose | HTML: each sheet is a page with the underlay as background and the frames positioned over it | |
| 6. Print | Playwright's Chromium, tagged PDF, the edition's `lang` | `storefront/public/documents/lunar-base-rulebook-<locale>.pdf` |

The result is real text: selectable, searchable, tagged, with headings and
lists marked up, and the document language set.

This was tried on sheet 10 before the plan was written. The stripped sheet
kept all artwork and no text. A German paragraph with `Õ Š Ž ß` and a
Klingon sentence printed in MADE Evolve Sans, the output was tagged, and
`pdftotext` returned the text. Three findings from that trial shape the
tasks:

| Finding | Consequence |
| --- | --- |
| The vector underlay showed a few hairlines that the source does not have | The layout check compares artwork pixel by pixel; a sheet that fails uses a 300 dpi raster underlay instead (T014) |
| Chromium rounded the page to 567.12 x 282.96 pt against 566.93 x 283.46 pt | The build sets the page size explicitly; the check allows 1 pt (T014, T015) |
| One sheet came to 0.5 MB | A whole rulebook is near 12 MB. The rulebook page states each file's size (T016) |

Text that is part of a picture stays English: the card faces above all. That
is correct, since the cards are English. T012 lists every other piece of
English that is not live text; each gets a patch and a frame, or a recorded
reason to stay.

The English PDF is never rebuilt or replaced. It remains the file "exactly as
printed".

The build needs Ghostscript, poppler, Playwright's Chromium
(`npx playwright install chromium`) and the MADE Evolve Sans directory, so it
runs on a worker's machine, not in CI. Its output is committed.

### How the layout is checked

`npm run rulebook:check -- <locale>` runs after a build. It fails on any row.

| Check | Rule |
| --- | --- |
| Sheets | 25 sheets, each within 1 pt of the English sheet's size |
| Artwork | Each sheet rendered without its text differs from the stripped English sheet by less than a set pixel ratio |
| Fit | Every frame's text fits its box. Type may shrink to 90 % of the English size and never below 6 pt; leading to 95 %. Past that the check names the frame and the translator shortens the text |
| Collisions | No two frames' ink overlaps, unless they overlap in English |
| Glyphs | `pdftotext` of each sheet returns every frame's text; no replacement character; every font is embedded and is one of the three families under [Sources](#sources) |
| Structure | The PDF is tagged and its language is the edition's |
| Size | The file is at most 16 MB |

The check also writes one image per sheet beside the English sheet into an
ignored directory. The reviewer looks at all 25 pairs and records the result;
that is the part no script can do.

T014 proves the pipeline on English first: the English text set through the
pipeline must pass every check and sit within a set pixel ratio of the
published PDF. Only then does a translation go through it.

`rulebook/manifest.json` records, per committed PDF, the hash of its text,
the frame map and the English PDF. A unit test compares them with the
current files, so text changed without a rebuild fails `scripts/validate`.

## The pull requests in order

The plan itself is the first pull request, on `site-translation/plan`. Each
task then stacks on the one before.

| Milestone | Tasks | It ends with |
| --- | --- | --- |
| M1 Site mechanism | T001 to T011 | Every page can be served in any edition; the selector, the guards and the glossary check exist. English output is unchanged except for the selector |
| M2 Rulebook pipeline | T012 to T016 | The pipeline reproduces the English rulebook and the rulebook page can offer a PDF per edition |
| M3 German | T017 to T026 | `/de` publishes every route and a German rulebook |
| M4 Estonian | T027 to T034 | `/et` publishes every route and an Estonian rulebook |
| M5 Klingon | T035 to T044 | `/tlh` publishes every route and a Klingon rulebook |
| M6 Finish | T045 to T046 | An edition without full copy no longer compiles; documents describe the result |

Each language follows the same order:

| Step | German | Estonian | Klingon |
| --- | --- | --- | --- |
| Glossary | T017 | T027 | T035, with the lexicon and word check |
| Legal pages, staged | T018 | exists | T036 |
| Register the edition; legal routes go live | T019 | exists | T037 |
| Publisher, proof, support, page metadata | T020 | T028 | T038 |
| Product copy | T021 | T029 | T039 |
| Interface, basket and checkout copy | T022 | T030 | T040 |
| Publish all routes | T023 | T031 | T041 |
| Rulebook text, sheets 1 to 13 | T024 | T032 | T042 |
| Rulebook text, sheets 14 to 25 | T025 | T033 | T043 |
| Rulebook PDF, checked and published | T026 | T034 | T044 |

Between a language's register step and its publish step, the edition serves
its legal pages only. Its other links cross to English with `hreflang`, as
`et` does today.

Implementers: `claude-lead` has 23 tasks and `codex` has 23. Each language
has tasks from both.

Size: each task aims at 400 to 800 changed lines and at most 10 files.
Generated files are excluded and named in the pull request: the frame map
(T012), the PDFs, and refreshed screenshots (T009).

## Questions

Each was unclear in the brief. The reading chosen is in force; the work does
not wait for an answer.

| # | Question | Reading chosen |
| --- | --- | --- |
| Q1 | "Never by address": the visitor's network address, or the URL? | The network address and location, as the brief's own sentence says. The URL prefix is how the visitor's choice is carried |
| Q2 | Should the site remember a visitor's language? | No. A stored choice would make `/` answer differently per visitor, and the brief says the default stays English |
| Q3 | Does "the site" include the order e-mails the backend sends? | No. They stay English. This plan changes no file under `backend/` |
| Q4 | Klingon in pIqaD script or Latin letters? | Latin letters, Okrand's spelling. pIqaD has no standard encoding and the brand font has no glyphs for it |
| Q5 | Are URL paths translated? | No. `/de/games/lunar-base`, not a German path |
| Q6 | Must a translated legal page say which language prevails? | No clause is added. The translations mirror the English pages section for section |
| Q7 | Are the cards and the box translated? | No. Only the rulebook. Pictures of cards in the rulebook stay English |
| Q8 | Country names in the Klingon edition? | As the shop names them in English. A carrier needs the real name |
| Q9 | Is the Estonian legal set translated again? | No. The five `et` pages exist and are approved. T027 only aligns the glossary with them |
| Q10 | Can a worker run the pinned Playwright image to refresh screenshots? | T009 tries. If it cannot, it says so in its hand-over and the browser suite stays red on that branch until the baselines are refreshed |
| Q11 | The task schema allows `claude` or `codex` as implementer; the dispatcher routes to `claude-lead` or `codex` | `tasks.json` uses `claude-lead` and `codex`, as the dispatch procedure needs. `validate-tasks.sh` therefore prints 23 errors, one per `claude-lead` task and all of the kind "implementer must be claude or codex", and exits 1. Nothing else fails: with that value read as `claude` the file is valid. The schema belongs to the `lunar-base` rig and is not changed here |
| Q12 | Does T006 require a POST to change destination from a prefixed basket? | No. The basket has no destination control or POST handler. The existing product-page selector writes the destination cookie and calls `router.refresh()`, which keeps the URL edition. A browser test covers each published product edition; prefixed editions join the test when their product routes are published |

## Out of scope

| Item | Why |
| --- | --- |
| `backend/` | Q3 |
| Translating product data held in Medusa | The site's product copy comes from `content/`, not from Medusa. This is not a licence to show English: every label from Medusa or the country list that a visitor reads is translated or kept on purpose, see [Where translated copy lives](#where-translated-copy-lives) |
| New photography, reviews or awards | Forbidden by `AGENTS.md`; translated editions reuse the existing evidence ids |
| Screenshot baselines for translated routes | They need the pinned image; functional browser checks cover the routes |
| The print-ready rulebook | The translated PDF is for reading on screen, like the published English one |
