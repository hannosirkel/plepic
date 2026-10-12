/**
 * The locale dimension, where it meets routing.
 *
 * `content/content.test.ts` holds the content half — which locales exist,
 * which registries are total, which edition owns the unprefixed URLs. This
 * file holds the half that only the storefront can answer: whether a URL a
 * registry implies is a URL something can actually render, and whether the
 * default edition's pages and the localized router share one renderer or have
 * quietly grown two.
 *
 * The defect class it is written against is the one this repository has
 * already paid for once: five legal routes answered 200 with a placeholder
 * through three merged pull requests, because every test asked whether the
 * route answered 200 with a canonical. A locale route that answers 200 with
 * the previous language's words is the same failure wearing a translation.
 */

import { readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { pagesByLocale } from "../../content/index.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  RETIRED_ROUTES,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../content/routes.js";
import { contentFor, type Page } from "../../content/schema.js";
import {
  BasketRoute,
  CheckoutRoute,
  HomeRoute,
  LunarBaseRoute,
  LegalRoute,
  LOCALIZED_ROUTE_VIEWS,
  RulebookRoute,
  SupportRoute,
  lookupLegalPage,
  resolveLocalizedRoute,
} from "../src/app/localized-routes.js";
import { pagesIn } from "../src/lib/seo.js";
import {
  canonicalUrl,
  localeForPathSegment,
  localizedPath,
  parseLocalizedPath,
  routeIdForPath,
} from "../src/lib/urls.js";
import { listSourceFiles } from "./helpers/source-files.js";

const srcDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "src");

const ROUTE_IDS = Object.keys(ROUTE_PATHS) as readonly RouteId[];

/**
 * Comments removed.
 *
 * Every scan below asks what the *code* does, and these files document
 * themselves heavily — the first revision of the `<html>` guard failed
 * because `app/[locale]/layout.tsx` explains in prose why `<html lang>` can
 * only be set by a root layout. A guard that a doc comment can trip is a
 * guard that gets weakened by whoever writes the next doc comment.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface SourceFile {
  readonly name: string;
  /** Raw file text. */
  readonly text: string;
  /** File text with comments removed — what the scans below read. */
  readonly code: string;
}

function sourceFiles(): readonly SourceFile[] {
  return listSourceFiles(srcDir).map((path) => {
    const text = readFileSync(path, "utf8");
    return { name: relative(srcDir, path).split(sep).join("/"), text, code: stripComments(text) };
  });
}

describe("localized paths", () => {
  it("leaves the default edition on exactly the paths this site already served", () => {
    for (const routeId of ROUTE_IDS) {
      expect(localizedPath(DEFAULT_LOCALE, ROUTE_PATHS[routeId])).toBe(ROUTE_PATHS[routeId]);
    }
  });

  it("round-trips every route in every locale", () => {
    for (const locale of LOCALES) {
      for (const routeId of ROUTE_IDS) {
        const served = localizedPath(locale, ROUTE_PATHS[routeId]);
        const parsed = parseLocalizedPath(served);
        expect(parsed.locale, served).toBe(locale);
        expect(parsed.path, served).toBe(ROUTE_PATHS[routeId]);
        expect(routeIdForPath(parsed.path), served).toBe(routeId);
      }
    }
  });

  it("prefixes every non-default edition and collides with nothing", () => {
    const served = LOCALES.flatMap((locale) =>
      ROUTE_IDS.map((routeId) => localizedPath(locale, ROUTE_PATHS[routeId])),
    );
    expect(new Set(served).size).toBe(served.length);
  });

  it("reads an unprefixed path as the default edition's", () => {
    expect(parseLocalizedPath("/legal/imprint")).toEqual({
      locale: DEFAULT_LOCALE,
      path: "/legal/imprint",
    });
    expect(parseLocalizedPath("/")).toEqual({ locale: DEFAULT_LOCALE, path: "/" });
  });

  /**
   * The default edition's identifier is not one of its URLs. If
   * `/en/legal/imprint` resolved, the imprint would have two URLs and one
   * canonical, which is the duplicate a locale dimension is supposed to
   * prevent rather than create.
   */
  it("never resolves a locale's own identifier when its prefix is empty", () => {
    for (const locale of LOCALES) {
      const { pathPrefix } = LOCALE_DEFINITIONS[locale];
      expect(localeForPathSegment(locale)).toBe(pathPrefix === "" ? undefined : locale);
    }
  });

  it("resolves no unknown segment", () => {
    for (const segment of ["", "xx", "legal", "assets", "EN"]) {
      const known = LOCALES.some(
        (locale) => LOCALE_DEFINITIONS[locale].pathPrefix === `/${segment}`,
      );
      expect(localeForPathSegment(segment) === undefined, segment).toBe(!known);
    }
  });
});

describe("resolveLocalizedRoute", () => {
  for (const locale of ["de", "et", "tlh"] as const) {
    it(`serves every active English route under ${locale}, plus the checkout return`, () => {
      expect(pagesIn("en").map((page) => page.route).toSorted()).toEqual(
        ROUTE_IDS.filter((routeId) => !Object.hasOwn(RETIRED_ROUTES, routeId)).toSorted(),
      );
      for (const page of pagesIn("en")) {
        const segments = ROUTE_PATHS[page.route].split("/").filter(Boolean);
        expect(resolveLocalizedRoute(locale, segments), page.route).toEqual({
          locale, routeId: page.route,
        });
      }
      expect(resolveLocalizedRoute(locale, ["about"])).toBeNull();
      expect(resolveLocalizedRoute(locale, ["checkout", "payment-return"])).toEqual({
        locale, routeId: "checkout", view: "checkoutReturn",
      });
    });
  }

  it("refuses the default edition's own identifier", () => {
    expect(resolveLocalizedRoute(DEFAULT_LOCALE, ["legal", "imprint"])).toBeNull();
  });

  it("refuses an unknown first segment", () => {
    expect(resolveLocalizedRoute("nonsense", ["legal", "imprint"])).toBeNull();
    expect(resolveLocalizedRoute("nonsense", undefined)).toBeNull();
  });

  it("refuses a path that is not a route, in every locale", () => {
    for (const locale of LOCALES) {
      const prefix = LOCALE_DEFINITIONS[locale].pathPrefix;
      if (prefix === "") continue;
      expect(resolveLocalizedRoute(prefix.slice(1), ["not", "a", "route"])).toBeNull();
    }
  });

  it("serves exactly the routes a locale both publishes and can render", () => {
    for (const locale of LOCALES) {
      const prefix = LOCALE_DEFINITIONS[locale].pathPrefix;
      if (prefix === "") continue;

      for (const routeId of ROUTE_IDS) {
        const segments = ROUTE_PATHS[routeId].split("/").filter((segment) => segment !== "");
        const resolved = resolveLocalizedRoute(prefix.slice(1), segments);
        const servable =
          pagesIn(locale).some((page) => page.route === routeId) &&
          LOCALIZED_ROUTE_VIEWS[routeId] !== undefined;

        expect(resolved === null, `${prefix}${ROUTE_PATHS[routeId]}`).toBe(!servable);
        if (resolved !== null) {
          expect(resolved).toEqual({ locale, routeId });
        }
      }
    }
  });
});

/**
 * The guard that makes registering a locale honest.
 *
 * A translator adds an edition by writing content files and registering them.
 * If that edition claims a route with no locale-aware renderer, the route
 * 404s — silently, and only on the day somebody visits it. This fails the
 * build instead, on the registration.
 */
describe("every published route can actually be rendered in its locale", () => {
  it("gives every route a non-default edition publishes a locale-aware renderer", () => {
    const orphans: string[] = [];

    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      for (const page of contentFor(pagesByLocale, locale)) {
        if (LOCALIZED_ROUTE_VIEWS[page.route] === undefined) {
          orphans.push(`${locale}:${page.route}`);
        }
      }
    }

    expect(
      orphans,
      "these routes are registered in a locale that has no renderer able to serve them — " +
        "either give the route a locale-aware view or do not publish it in that edition",
    ).toEqual([]);
  });

  it("names only declared routes in the view table", () => {
    for (const routeId of Object.keys(LOCALIZED_ROUTE_VIEWS)) {
      expect(Object.hasOwn(ROUTE_PATHS, routeId), routeId).toBe(true);
    }
  });

  /**
   * The routes whose renderer reads the edition it is given: the five legal
   * routes, which read a locale-keyed registry, and the home page, the Lunar
   * Base page, the support page, the rulebook page, the basket and the
   * checkout, which read `siteCopyFor(locale)`. Pinned by name and by renderer because the
   * failure mode is a route quietly *leaving* the table — after which its
   * locale URLs 404 and the suite above still passes, since a route nothing
   * publishes needs no renderer. A route joins this list in the change that
   * makes its renderer locale-aware, and not before.
   */
  it("carries the legal set and the home page, and nothing that only looks locale-aware", () => {
    expect(LOCALIZED_ROUTE_VIEWS).toEqual({
      home: HomeRoute,
      lunarBase: LunarBaseRoute,
      support: SupportRoute,
      rulebook: RulebookRoute,
      cart: BasketRoute,
      checkout: CheckoutRoute,
      legalImprint: LegalRoute,
      legalPrivacy: LegalRoute,
      legalReturns: LegalRoute,
      legalShipping: LegalRoute,
      legalTerms: LegalRoute,
    });
  });

  it("finds a legal page for every legal route in every locale that publishes it", () => {
    const legalRouteIds = (Object.keys(LOCALIZED_ROUTE_VIEWS) as RouteId[]).filter(
      (routeId) => LOCALIZED_ROUTE_VIEWS[routeId] === LegalRoute,
    );
    expect(legalRouteIds).toHaveLength(5);

    for (const locale of LOCALES) {
      for (const routeId of legalRouteIds) {
        const published = pagesIn(locale).some((page) => page.route === routeId);
        const page = lookupLegalPage(routeId, locale as Locale);
        expect(page !== undefined, `${locale}:${routeId}`).toBe(published);
        if (page !== undefined) expect(page.route).toBe(routeId);
      }
    }
  });
});

/**
 * One projection, two entry points.
 *
 * `LegalPageContent` exists because five routes rendered a placeholder while
 * the content was complete. A second component projecting `content/legal/*` —
 * one for the default edition, one for the prefixed ones — would reintroduce
 * exactly that: two renderers, one of which somebody forgets. So the rule is
 * that `localized-routes.tsx` is the only thing under `src/` that renders it,
 * and every route file goes through `LegalRoute`.
 */
describe("the legal projection has one renderer", () => {
  it("is imported by localized-routes.tsx and by nothing else under src/", () => {
    const importers = sourceFiles()
      .filter((file) => /\bfrom\s+"[^"]*LegalPageContent\.js"/.test(file.code))
      .map((file) => file.name);

    expect(importers).toEqual(["app/localized-routes.tsx"]);
  });

  it("is what every default-edition legal route renders", () => {
    const legalRoutes = sourceFiles().filter((file) =>
      /^app\/\(site\)\/legal\/[a-z]+\/page\.tsx$/.test(file.name),
    );
    expect(legalRoutes).toHaveLength(5);

    for (const file of legalRoutes) {
      expect(file.code, `${file.name} does not render LegalRoute`).toMatch(/<LegalRoute\b/);
      expect(file.code, `${file.name} does not declare its locale`).toMatch(/DEFAULT_LOCALE/);
    }
  });
});

/**
 * The same rule for the home page: `HomepageMockup` is rendered by
 * `HomeRoute` and by nothing else, so the default edition's `/` and a
 * prefixed edition's home page are one renderer handed two locales.
 */
describe("the home page has one renderer", () => {
  it("is imported by localized-routes.tsx and by nothing else under src/", () => {
    const importers = sourceFiles()
      .filter((file) => /\bfrom\s+"[^"]*HomepageMockup\.js"/.test(file.code))
      .map((file) => file.name);

    expect(importers).toEqual(["app/localized-routes.tsx"]);
  });

  it("is what the default edition's home route renders", () => {
    const home = sourceFiles().find((file) => file.name === "app/(site)/page.tsx");

    expect(home?.code).toMatch(/<HomeRoute\b[^>]*\blocale=\{DEFAULT_LOCALE\}/);
  });

  /**
   * `HomeRoute` asks the page registry itself. An edition that does not
   * publish the home page has no site copy to render it from, and the
   * renderer reached without the resolver must still answer 404 rather than
   * throw `siteCopyFor`'s error, which a visitor would meet as a 500.
   */
  it("answers 404 for an edition that does not publish the home page", async () => {
    // Every edition publishes the home page now, so each has it withheld in turn.
    const pages = pagesByLocale as Record<Locale, readonly Page[]>;

    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      const published = pages[locale];
      pages[locale] = published.filter((page) => page.route !== "home");
      try {
        await expect(HomeRoute({ routeId: "home", locale }), locale).rejects.toMatchObject({
          digest: expect.stringContaining("404"),
        });
      } finally {
        pages[locale] = published;
      }
    }
  });
});

/**
 * The served document declares its language in exactly one place.
 *
 * `<html lang>` was a literal in the root layout. A literal is invisible to
 * every check in this repository and correct only by luck once a second
 * edition exists, so there is now one `<html>` element in the tree and its
 * `lang` comes from the locale's own definition.
 */
describe("the document's language", () => {
  it("renders <html> in one file only", () => {
    const renderers = sourceFiles()
      .filter((file) => /<html\b/.test(file.code))
      .map((file) => file.name);

    expect(renderers).toEqual(["app/site-document.tsx"]);
  });

  it("hard-codes no language tag anywhere under src/", () => {
    const offenders = sourceFiles()
      .filter((file) => /\blang=["'{]?["'][a-z]{2}(-[A-Za-z0-9]+)*["']/.test(file.code))
      .map((file) => file.name);

    expect(
      offenders,
      "a language tag written as a literal is one that no locale registration can change",
    ).toEqual([]);
  });

  it("takes the tag from the locale definition", () => {
    const document = sourceFiles().find((file) => file.name === "app/site-document.tsx");
    expect(document?.code).toMatch(/lang=\{LOCALE_DEFINITIONS\[locale\]\.languageTag\}/);
  });

  /**
   * Two root layouts, one document. The reason there are two is that only a
   * root layout may render `<html>` and only one under a dynamic segment can
   * know the locale; the reason the document is a component is so the second
   * root layout cannot drift from the first on its first edit.
   */
  it("has one root layout per edition shape, both wrapping the shared document", () => {
    const layouts = sourceFiles().filter((file) => /^app\/[^/]+\/layout\.tsx$/.test(file.name));
    expect(layouts.map((file) => file.name).toSorted()).toEqual([
      "app/(site)/layout.tsx",
      "app/[locale]/layout.tsx",
    ]);
    for (const layout of layouts) {
      expect(layout.code, `${layout.name} does not render SiteDocument`).toMatch(/<SiteDocument\b/);
    }
  });
});

describe("canonical URLs", () => {
  it("gives every (locale, route) pair its own URL and no other", () => {
    const seen = new Map<string, string>();
    for (const locale of LOCALES) {
      for (const page of pagesIn(locale)) {
        const url = canonicalUrl("https://example.com", locale, page.route);
        expect(seen.has(url), `${url} already belongs to ${seen.get(url) ?? ""}`).toBe(false);
        seen.set(url, `${locale}:${page.route}`);
      }
    }
  });
});

/**
 * The 404's link, and the one thing that can be guarded cheaply.
 *
 * The link shipped with no class and no rule, so it rendered at the user
 * agent's default `rgb(0,0,238)` on the page's background: **1.75:1** against
 * a 4.5:1 requirement, on the single interactive element the page exists to
 * offer. The heading and paragraphs beside it were at 14.96:1, so nothing
 * looked wrong.
 *
 * **What this does not do.** It does not measure contrast. Measuring what a
 * browser actually paints needs a browser, this suite has none, and the plan
 * forbids adding one — the ratio was measured out of band (5.32:1) and is
 * recorded in the unit's report. A source-level "every `<a>` must carry a
 * className" rule was considered and rejected: nine anchors elsewhere under
 * `src/` are legitimately styled by descendant selectors, so it would be nine
 * false positives on components outside this unit's authority and wrong in
 * principle.
 *
 * **What it does do** is close the chain between what this page paints and
 * what `design/tokens.test.ts` already measures. That suite resolves the token
 * file and holds declared pairs to their WCAG minimum; it cannot see an
 * element that declares nothing. Putting this page on `--accent` over
 * `--surface` — a pair it *does* measure — means the contrast is covered going
 * forward by a suite that runs on every build. These assertions are the links
 * in that chain: the component uses the classes, the classes use the tokens,
 * and the token suite measures that pair. Break any one and this goes red.
 */
describe("the 404's link is on a token pair the contrast suite measures", () => {
  /* Comments stripped: this file quotes the two measured colours in prose,
     and a guard a doc comment can trip is a guard the next doc comment weakens. */
  const styles = stripComments(
    readFileSync(join(srcDir, "styles/pages/not-found.module.css"), "utf8"),
  );
  const component = sourceFiles().find((file) => file.name === "app/not-found-content.tsx");
  const tokenSuite = readFileSync(
    join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "design/tokens.test.ts"),
    "utf8",
  );

  it("gives the page a surface and the link an accent, both as tokens", () => {
    expect(styles).toMatch(/\.page\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(styles).toMatch(/\.link\s*\{[^}]*color:\s*var\(--accent\)/);
  });

  it("writes no literal colour on this page", () => {
    expect(
      styles.match(/#[0-9a-f]{3,8}\b|\brgba?\(/gi) ?? [],
      "a literal colour here is a colour the token suite cannot measure",
    ).toEqual([]);
  });

  it("is the pair design/tokens.test.ts holds to 4.5:1", () => {
    expect(tokenSuite).toMatch(
      /foreground:\s*"--accent",\s*background:\s*"--surface",\s*minimum:\s*4\.5/,
    );
  });

  it("actually applies those classes to the heading, the body and the link", () => {
    expect(component?.code).toMatch(/<a\s+className=\{styles\.link\}/);
    expect(component?.code).toMatch(/className=\{styles\.page\}/);
    expect(component?.code).toMatch(/<h1 className=\{styles\.heading\}/);
  });

  /**
   * A hover colour is not a focus indicator. `--accent-hover` on this layer is
   * the navy the page's own text is made of, so a keyboard user tabbing to the
   * only link would get a colour change they cannot see against the copy
   * beside it. The ring is the site's convention.
   */
  it("gives the link the site's focus ring rather than a colour change", () => {
    expect(styles).toMatch(
      /a\.link:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring-width\)\s+solid\s+var\(--focus-ring\)/,
    );
  });
});
