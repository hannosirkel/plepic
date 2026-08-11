/**
 * The body of a 404, shared by both root layouts' `not-found.tsx`.
 *
 * ## Why it exists
 *
 * Before this unit an unmatched path matched **no route**, so Next served its
 * own `/_not-found` page. That was never a designed 404 and there is nothing
 * in it to preserve: it rendered the framework's stock *"This page could not
 * be found"* and — measured on `main` at `a6eaa69` — its inline styling was
 * blocked by **five CSP `style-src` violations**, because this application
 * serves a nonce-based policy the framework's error page does not carry a
 * nonce for. The replacement says what happened in the site's own words and
 * offers the one link that is certainly valid.
 *
 * ## What Next.js does with the surrounding document, measured
 *
 * `notFound()` renders the framework's standalone `<html id="__next_error__">`
 * document. That is not caused by this unit's routing: it reproduces on `main`,
 * with its single root layout and a `not-found.tsx` present, from a
 * `notFound()` call in an ordinary page. `main` never met it only because
 * nothing there called `notFound()`. With multiple root layouts the
 * unmatched-path 404 has no root layout to render into either. Six
 * configurations were tried — a `not-found.tsx` beside each root layout, one
 * nested under the catch-all, one rendering a full `<html>` of its own, a
 * root-level `app/not-found.tsx`, `app/global-not-found.tsx` (experimental in
 * this version and inert without a `next.config.ts` flag this unit may not
 * set), and `dynamicParams = false`. All six produce the same document.
 *
 * **`dynamicParams = false` is rejected for one reason and one only: it does
 * not fix the 404 document.** An earlier revision of this note also claimed it
 * would statically prerender the localized route and bake the building
 * environment's base URL into a second edition. **That did not reproduce.**
 * Review tested three configurations with a build-time canary — as shipped,
 * with `force-dynamic` removed from the page, and removed from the page and
 * the layout — and in all three the route stayed dynamic with no canary
 * anywhere in `.next/`, because `generateMetadata` reads `headers()` and that
 * keeps the segment dynamic regardless. The conclusion stood; the reason was
 * an inference stated as a measurement, and it is withdrawn.
 *
 * ## The cost, at full price
 *
 * **A visitor with JavaScript disabled receives zero characters.** Not a
 * degraded page: the server-rendered HTML of a 404 carries no body content at
 * all, only the flight payload the client would have hydrated from. With
 * JavaScript the page is complete — styled, brand navy, `MADE Evolve Sans`,
 * the heading, the sentence and the link, no console errors.
 *
 * **The `<title>` is the exception, and it is server-rendered.** It is set from
 * the localized route's `generateMetadata`, and `curl` sees it with no
 * JavaScript at all — so a no-JS visitor gets an empty page with an honest tab
 * title rather than an empty page called nothing. An earlier revision of this
 * note said the opposite; that sentence was written before the `<title>` was
 * fixed and survived the fix, which is the same class of stale record this unit
 * corrected twice elsewhere.
 *
 * The empty body is real and is a consequence of two root layouts, which are
 * what make `<html lang>` a property of the edition rather than a literal. The
 * trade was taken deliberately; what would end it is a rewrite in
 * `src/proxy.ts` mapping the unprefixed paths onto a single dynamic root
 * segment, so there is one root layout again and it can still read the locale.
 * That file is outside this unit's authority.
 *
 * ## What this file still controls
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
 * See `src/styles/pages/not-found.module.css` for why the link's colour is a
 * token pair rather than a value, and what that buys.
 *
 * ## What it deliberately is not
 *
 * A designed 404. Page composition is another unit's, and inventing a
 * decorated error page here would be scope this unit has no authority for.
 */

import { DEFAULT_LOCALE, LOCALE_DEFINITIONS, ROUTE_PATHS } from "../../../content/routes.js";
import styles from "../styles/pages/not-found.module.css";

/**
 * The heading and the document title, as one string.
 *
 * A browser tab showing the raw URL is what a 404 with no `<title>` looks
 * like. The title is set from the localized route's `generateMetadata` and
 * from each `not-found.tsx`'s own `metadata`; keeping it here means the tab
 * and the heading cannot come to say different things.
 */
export const NOT_FOUND_TITLE = "Page not found";

export function NotFoundContent() {
  return (
    <main
      className={styles.page}
      lang={LOCALE_DEFINITIONS[DEFAULT_LOCALE].languageTag}
      data-layer="publisher"
    >
      <div className={styles.content}>
        <h1 className={styles.heading}>{NOT_FOUND_TITLE}</h1>
        <p className={styles.body}>That address does not match a page on this site.</p>
        <p className={styles.body}>
          <a className={styles.link} href={ROUTE_PATHS.home}>
            Go to the home page
          </a>
        </p>
      </div>
    </main>
  );
}
