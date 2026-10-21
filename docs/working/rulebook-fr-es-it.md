# Rulebook in French, Spanish and Italian

Started 2026-10-21. One pull request, branch `feature/rulebook-fr-es-it`.

**Size override.** This pull request is over the size gate in
`standards/planning.md`. Hanno Sirkel approved one pull request on 2026-10-21:
the PDFs, the page that links them and the preview that shows the page are
one reviewable change.

## Goal

The rulebook PDF exists in French, Spanish and Italian. A reader of any site
edition can open the rulebook in every language that has one. The site itself
stays in four editions: no new routes, prefixes, selector entries or
`hreflang` values.

## Decisions

| Decision | Detail |
| --- | --- |
| A rulebook language is not an edition | `fr`, `es`, `it` are rulebook languages only. A new type `RulebookLanguage` (site locales plus `fr`, `es`, `it`) keys the rulebook registry. `Locale` is unchanged |
| The page | The primary button still opens the edition's own rulebook. Below it, an "also available in" list links every other rulebook language: its name in its own language, `lang` and `hreflang` set, its size in the edition's number format |
| Language names | Each written in its own language (`Français`, `Español`, `Italiano`, plus the four site languages). Names are content, not component strings |
| PDFs | Built by the existing pipeline, `npm run rulebook:build -- <lang>`, checked with `rulebook:check`, recorded in `rulebook/manifest.json`, committed under `storefront/public/documents/lunar-base-rulebook-<lang>.pdf` |
| Glossary | Each new language gets a glossary over `terms.ts` and is held to it for its rulebook text. Card titles and station names stay as printed, as in every edition |
| Translation conventions | `docs/current/translation/{fr,es,it}.md` |
| Preview | Label `preview` on a same-repository pull request, applied by a user with write access, publishes a static snapshot of the head revision to GitHub Pages. Built in CI, deployed with `actions/deploy-pages`. Nothing is committed: merging brings no artifact. The last labelled pull request wins |

## Rows

- [x] Translate the rulebook: `rulebook/text/{fr,es,it}/`, glossaries, conventions docs
- [x] Register rulebook languages: type, registry, editions, tests, glossary check
- [x] Rulebook page lists every available language, in every edition's copy
- [ ] Build and check the three PDFs; commit PDFs and manifest
- [x] Preview workflow and its documentation
- [x] Update `docs/current/rulebook.md`, `locales.md`, `AGENTS.md`, ADR 0003
- [ ] `bash scripts/validate`, `habit-hooks`, `zizmor`, review

## Operator steps outside the repository

1. Settings → Pages → Source: GitHub Actions.
2. Settings → Environments → `github-pages` → deployment branches: allow
   pull-request branches (or no restriction).
