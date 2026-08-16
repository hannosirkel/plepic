import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as lunarBase from "../../content/lunar-base.js";
import { pagesByLocale } from "../../content/index.js";
import { LOCALES, ROUTE_PATHS } from "../../content/routes.js";
import { contentFor } from "../../content/schema.js";
import { buildProductJsonLd } from "../src/lib/product-jsonld.js";
import { findPage } from "../src/lib/seo.js";
import { listSourceFiles } from "./helpers/source-files.js";

/**
 * "Exactly one canonical product page exists with exactly one set of product
 * copy. A test must fail if the same product description exists in two
 * places."
 *
 * That sentence had a module doc comment asserting it (`content/lunar-base.ts`
 * opens with "the single canonical set") and no test. A doc comment is not a
 * guard: the duplication this forbids is not introduced by someone who
 * disagrees with the rule, it is introduced by someone who never read the
 * file — a second product page, a hard-coded pitch in a component, a Medusa
 * product description pasted into the backend seed. All three keep every
 * existing test green, and all three cost the canonical page its ranking to a
 * duplicate of itself.
 *
 * So this scans the authored source tree for the copy itself, rather than
 * trusting the import graph. A string that appears twice is the defect,
 * wherever the second copy came from.
 */

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Every string of sentence length reachable from `content/lunar-base.ts`'s exports. */
function authoredProductCopy(): readonly string[] {
  const found = new Set<string>();

  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      // Long enough to be product copy rather than a label, a route id or a
      // manifest key. A duplicated two-word heading is not the defect.
      //
      // Measured on the prose *after* the configuration placeholders are
      // removed, because `"{merchantLegalName}, {merchantRegisteredAddress}."`
      // is a formatting template rather than copy: the GPSR block on the
      // product page and both privacy pages legitimately share it, and it says
      // nothing about the product at all. Counting it as product copy would
      // make this guard report the identity template as a duplicated
      // description and teach the next reader to add exemptions.
      if (value.replaceAll(/\{[^}]*\}/g, "").trim().length >= 40) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const entry of Object.values(value)) walk(entry);
    }
  };

  walk(lunarBase);
  return [...found];
}

/**
 * The one authored file this scan skips, and why.
 *
 * `content/evidence.ts` is the provenance registry: one entry per source, each
 * summarising what the operator's evidence manifest holds, so the editorial
 * gate is discharged by reading a list. Its summaries quote the terms the site
 * displays — the test report entry names `EN71-3:2019 with Regulation (EU)
 * 2019/1922`, which the product page also names as a specification — and that
 * overlap is the registry doing its job rather than a second copy of anything.
 *
 * It is safe to skip because it is not site copy by construction and this is
 * checked, not assumed: nothing imports it except `content/content.test.ts`,
 * so no string in it can reach a rendered page. If that ever changes, the
 * assertion below stops being sound — which is why the importer set is pinned
 * here rather than trusted.
 */
const NOT_SITE_COPY = "content/evidence.ts";

/**
 * Every authored `.ts`/`.tsx` file in the three source trees that **ships** —
 * test files excluded, since a suite quoting a sentence in order to assert
 * something about it is not a second copy of the site's copy.
 */
function shippingSources(): readonly string[] {
  return [
    ...listSourceFiles(join(repoRoot, "content")),
    ...listSourceFiles(join(repoRoot, "storefront", "src")),
    ...listSourceFiles(join(repoRoot, "backend", "src")),
  ]
    .map((path) => relative(repoRoot, path))
    .filter((path) => !/\.test\.tsx?$/.test(path));
}

/** Those files, minus the provenance registry, as [path, text]. */
function authoredSources(): readonly (readonly [string, string])[] {
  return shippingSources()
    .filter((path) => path !== NOT_SITE_COPY)
    .map((path) => [path, readFileSync(join(repoRoot, path), "utf8")] as const);
}

describe("exactly one set of product copy exists", () => {
  const copy = authoredProductCopy();
  const sources = authoredSources();

  it("skips the provenance registry only because nothing renders it", () => {
    const importers = shippingSources()
      .filter((path) => path !== NOT_SITE_COPY)
      .filter((path) => /from "[^"]*evidence\.js"/.test(readFileSync(join(repoRoot, path), "utf8")));

    expect(importers, "content/evidence.ts now reaches rendered code; it can no longer be skipped").toEqual([]);
  });

  it("finds product copy to check at all, so the scan below is not vacuous", () => {
    expect(copy.length).toBeGreaterThan(5);
    expect(copy).toContain(
      "Lunar Base is a 2-6 player strategy card game where you compete to build the most powerful moon base.",
    );
    expect(sources.length).toBeGreaterThan(50);
  });

  it("authors every sentence of it in content/lunar-base.ts and nowhere else", () => {
    for (const sentence of copy) {
      const holders = sources
        .filter(([, text]) => text.includes(sentence))
        .map(([path]) => path);

      expect(holders, `duplicated product copy: ${JSON.stringify(sentence.slice(0, 60))}…`).toEqual([
        "content/lunar-base.ts",
      ]);
    }
  });

  it("gives the product route one meta description, authored once", () => {
    const description = findPage("lunarBase").description;
    const holders = sources.filter(([, text]) => text.includes(description)).map(([path]) => path);

    expect(holders, "the product page's description is authored in more than one file").toHaveLength(1);
  });

  /**
   * The machine-readable copy and the human-readable copy are one string, not
   * two that happen to agree today. A second `description:` written into the
   * JSON-LD builder would be the duplication this row forbids, in the place it
   * is least likely to be noticed.
   */
  it("publishes that same description to a crawler, rather than a second one", () => {
    const page = findPage("lunarBase");
    const jsonLd = buildProductJsonLd({
      url: "https://example.com/games/lunar-base",
      description: page.description,
    });

    expect(jsonLd.description).toBe(page.description);

    const builder = readFileSync(
      join(repoRoot, "storefront", "src", "lib", "product-jsonld.ts"),
      "utf8",
    );
    expect(builder, "the JSON-LD builder authors product prose of its own").not.toContain(
      page.description,
    );
  });
});

describe("exactly one canonical product page exists", () => {
  /**
   * The plan's site shape sketches both `/games/lunar-base` and a minimal
   * `/store/lunar-base`. The route table declares only the first, which is the
   * strongest available form of "one product page" — there is no second route
   * to keep in sync and no `rel=canonical` hop to get wrong. This pins that
   * choice: a `/store` product route reappearing is a decision, not an
   * accident, and it would need this test changed before it could ship.
   */
  it("declares one product route, and no /store route to compete with it", () => {
    const productRoutes = Object.entries(ROUTE_PATHS).filter(([, path]) =>
      path.includes("lunar-base"),
    );
    const salesPages = productRoutes.filter(([id]) => id === "lunarBase");

    expect(salesPages).toEqual([["lunarBase", "/games/lunar-base"]]);
    expect(Object.values(ROUTE_PATHS).filter((path) => path.startsWith("/store"))).toEqual([]);
  });

  it("registers the product page in exactly one locale edition per canonical URL", () => {
    const publishing = LOCALES.filter((locale) =>
      contentFor(pagesByLocale, locale).some((page) => page.route === "lunarBase"),
    );

    // One edition publishes it today; the assertion that matters at any number
    // is that no two editions claim the same URL, which `seo.test.ts` holds.
    expect(publishing.length).toBeGreaterThan(0);
    for (const locale of publishing) {
      const pages = contentFor(pagesByLocale, locale).filter((page) => page.route === "lunarBase");
      expect(pages, `${locale} registers the product route twice`).toHaveLength(1);
    }
  });
});
