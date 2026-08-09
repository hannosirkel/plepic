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
export * from "./routes.js";
export * from "./schema.js";
export * from "./pages.js";
export * as publisher from "./publisher.js";
export * as lunarBase from "./lunar-base.js";
export * as proof from "./proof.js";
export * as support from "./support.js";
export * as legal from "./legal/index.js";
