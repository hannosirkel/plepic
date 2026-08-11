/**
 * The content package.
 *
 * Everything the site says about itself comes through here. Nothing else in the
 * repository writes marketing copy, and nothing here knows a hostname, a base
 * URL or a price.
 */

/*
 * `evidence.ts` is deliberately **not** re-exported. It holds editorial
 * internals: the `caution` notes, and the `NOT_PUBLISHABLE` and
 * `CAMPAIGN_STATE_PHRASES` blocklists, which contain the exact strings the site
 * must never show. Re-exporting them would ship a list of banned marketing
 * phrases, and the two unpublishable Kickstarter figures, into every bundle
 * that imports this barrel. Anything that genuinely needs the registry imports
 * `./evidence.js` directly and takes that cost knowingly.
 */
import { legalPagesByLocale } from "./legal/index.js";
import { pages } from "./pages.js";
import type { LocalizedContent, Page } from "./schema.js";

export * from "./routes.js";
export * from "./schema.js";
export * from "./pages.js";
export * as publisher from "./publisher.js";
export * as lunarBase from "./lunar-base.js";
export * as proof from "./proof.js";
export * as support from "./support.js";
export * as shop from "./shop.js";
export * as legal from "./legal/index.js";

/**
 * The page registry, per locale: which pages each published edition of this
 * site actually has.
 *
 * This is the site-wide half of the locale dimension, and it lives in the
 * barrel for the same reason `legal/index.ts` holds the legal half — the
 * registration belongs at the boundary of the thing being registered, not
 * inside the copy. `pages.ts` stays a flat list of the English pages and is
 * not locale-aware; it is what the `en` entry is built from.
 *
 * **An edition need not publish every route.** `Record<Locale, …>` is total,
 * so a new locale must appear here, but what it maps to is that edition's own
 * page list — which may legitimately be the five legal pages and nothing
 * else, because the reason this dimension exists is a legal-language
 * obligation and not a decision to translate the marketing site. The sitemap,
 * the canonical and the `hreflang` alternates are all computed from this
 * registry, so a route an edition does not publish simply has no URL, no
 * sitemap entry and no alternate in that locale, rather than a URL that
 * answers 200 with another language's words.
 *
 * What stops the second case is not this file: renderers live in the
 * storefront, and `storefront/tests/locale-routing.test.ts` fails on a page
 * registered in a locale that has no renderer able to serve it.
 */
export const pagesByLocale: LocalizedContent<readonly Page[]> = {
  en: pages,
  /*
   * The Estonian edition publishes the legal set and nothing else — the
   * reason the dimension exists is the legal-language obligation, not a
   * decision to translate the marketing site. Its page list *is* its legal
   * set: a `LegalPage` is a `Page`, and registering the same objects both
   * here and in `legal/index.ts` is what keeps the two registries incapable
   * of disagreeing about what the edition contains.
   */
  et: legalPagesByLocale.et,
};
