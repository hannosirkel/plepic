/**
 * The body of a 404, shared by both root layouts' `not-found.tsx`.
 *
 * ## What was measured, because the answer is not what it looks like
 *
 * Before this unit an unmatched path matched **no route**, so Next served its
 * `/_not-found` page inside the single root layout: a 404 arrived as
 * `<html lang="en" data-layer="publisher">` with a server-rendered body, and
 * nobody had written anything to make that so.
 *
 * Two facts about Next 16.3, each established by running it rather than by
 * reading about it:
 *
 * 1. **`notFound()` always renders the standalone `<html id="__next_error__">`
 *    document, with the boundary's body only in the flight payload and not in
 *    the server-rendered HTML.** This is not caused by this unit's routing: it
 *    reproduces on `main`, with its single root layout and a `not-found.tsx`
 *    present, from a `notFound()` call in an ordinary page. `main` never met
 *    it only because nothing there called `notFound()`.
 * 2. **With multiple root layouts, the unmatched-path 404 has no root layout
 *    to render into either**, and produces the same document. Tried and
 *    rejected: a `not-found.tsx` beside each root layout, one nested under the
 *    catch-all, one rendering a full `<html>` of its own, a root-level
 *    `app/not-found.tsx`, `app/global-not-found.tsx` (experimental in this
 *    version and inert without a `next.config.ts` flag this unit may not set),
 *    and `dynamicParams = false` so the router rather than this code answers
 *    an unknown prefix. All five produce `<html id="__next_error__">`.
 *
 * `dynamicParams = false` was additionally **wrong on its own terms** and is
 * worth recording: it marked the localized route statically prerendered, which
 * on the day a second edition exists would prerender its pages at build time
 * and bake the base URL of whatever environment ran `next build` into them —
 * the one thing this application's whole runtime-config design exists to
 * prevent.
 *
 * ## So this is the honest state
 *
 * A 404 answers 404, carries `noindex` and no canonical, and delivers this
 * body — hydrated rather than server-rendered. That is a real cost of two root
 * layouts, and two root layouts are what make `<html lang>` a property of the
 * edition rather than a literal. The trade was taken deliberately; the thing
 * that would end it is a rewrite in `src/proxy.ts` mapping the unprefixed
 * paths onto a single dynamic root segment, and that file is outside this
 * unit's authority.
 *
 * The content root declares the language and the design layer itself, which is
 * valid HTML — `lang` on any element governs its subtree — so what does reach
 * a reader says what language it is in even though the document element
 * cannot. The tag comes from the locale definition; a literal here is the
 * exact thing `tests/locale-routing.test.ts` refuses.
 *
 * The 404 is the default edition's, unconditionally. A prefixed URL that did
 * not resolve did not identify an edition — that is *why* it did not
 * resolve — so answering in the site's own language is the only defensible
 * choice.
 *
 * ## What it deliberately is not
 *
 * A designed 404. Page composition is another unit's, and inventing a
 * decorated error page here would be scope this unit has no authority for.
 * This is the smallest body that says what happened and offers the one link
 * that is certainly valid.
 */

import { DEFAULT_LOCALE, LOCALE_DEFINITIONS, ROUTE_PATHS } from "../../../content/routes.js";

export function NotFoundContent() {
  return (
    <main lang={LOCALE_DEFINITIONS[DEFAULT_LOCALE].languageTag} data-layer="publisher">
      <h1>Page not found</h1>
      <p>That address does not match a page on this site.</p>
      <p>
        <a href={ROUTE_PATHS.home}>Go to the home page</a>
      </p>
    </main>
  );
}
