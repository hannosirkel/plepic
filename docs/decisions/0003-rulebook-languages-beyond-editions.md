# 0003. Make French, Spanish and Italian rulebook languages, not editions

- **Date:** 2026-10-21
- **Status:** accepted

## Context and problem statement

The operator wants the rulebook PDF in French, Spanish and Italian. The
operator does not want the site in those languages. The site has four editions
(English, German, Estonian, Klingon), each a complete copy of the copy, the
legal pages and the price formats, selected by the URL prefix
([0001](./0001-locale-chosen-by-url.md)). The rulebook PDFs are produced by a
pipeline that already makes a translated PDF from translated text
([0002](./0002-translated-rulebook-pdf.md)). The question is how to give a
reader the three new PDFs without committing to three new editions.

## Considered options

- A. Add `fr`, `es` and `it` as full editions: routes, prefixes, `hreflang`,
  sitemap entries, selector entries, site copy and legal pages.
- B. Add them as rulebook-only languages. A new type, `RulebookLanguage` (the
  site locales plus `fr`, `es`, `it`), keys the rulebook registry. `Locale` is
  unchanged. Each edition's rulebook page links every language that has a PDF.
- C. Link to external copies of the translated rulebook, hosted elsewhere.

## Decision

Chose option B.

| Rule | Detail |
| --- | --- |
| `Locale` is unchanged | `LOCALES` and `LOCALE_DEFINITIONS` hold the four editions. No route, prefix, selector entry or `hreflang` value is added |
| `RulebookLanguage` | The site locales plus `fr`, `es`, `it`, in `content/rulebook-documents.ts`. It keys the PDF registry |
| The rulebook page | The primary button opens the edition's own rulebook. Below it, every other language that has a PDF is listed: its name in its own language, with `lang` and `hreflang` set, and its size in the edition's number format |
| The build | The existing pipeline. `npm run rulebook:build -- <lang>`, `rulebook:check`, an entry in `rulebook/manifest.json` |
| Glossary and conventions | Each language has a glossary over `terms.ts` and a conventions document under `docs/current/translation/` |

## Rationale

Option A promises a site: every route, the shop, the legal pages and the
checkout in a language nobody has agreed to maintain. Option C leaves the file
off the repository, so the manifest cannot say what it was built from and the
layout check cannot read it. Option B is the smallest change that gives the
reader the PDF and keeps the site's promises as they are.

## Consequences

- The sitemap, the `hreflang` alternates and the language selector do not
  change. A reader of the site never lands in French, Spanish or Italian
  except through the rulebook page's list.
- The glossary of a rulebook language covers rulebook text only. The site's
  copy is not held to it, because the site has no copy in that language.
- `rulebook/layout/overrides.ts` is hashed into every translated edition's
  manifest entry. Any change to it rebuilds and recommits all six translated
  PDFs, whichever edition the change was for.
- Seven PDFs of about 9 MB each live under `storefront/public/documents/`.
- No native speaker has reviewed the French, Spanish and Italian terms. The
  glossaries record the choices and the reasons; a review is pending and may
  change them.
- Promoting a rulebook language to an edition later is a new decision. It
  adds the routes and the copy and removes the language from the rulebook-only
  list; the PDF and its glossary carry over.
