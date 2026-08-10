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
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../content/routes.js";
import { contentFor } from "../../content/schema.js";
import {
  LegalRoute,
  LOCALIZED_ROUTE_VIEWS,
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
   * The five legal routes are the ones whose renderer reads a locale-keyed
   * registry. Pinned by name because the failure mode is a route quietly
   * *leaving* the table — after which its locale URLs 404 and the suite above
   * still passes, since a route nothing publishes needs no renderer.
   */
  it("carries the whole legal set and nothing that only looks locale-aware", () => {
    expect(Object.keys(LOCALIZED_ROUTE_VIEWS).toSorted()).toEqual(
      ["legalImprint", "legalPrivacy", "legalReturns", "legalShipping", "legalTerms"].toSorted(),
    );
    for (const routeId of Object.keys(LOCALIZED_ROUTE_VIEWS) as RouteId[]) {
      expect(LOCALIZED_ROUTE_VIEWS[routeId]).toBe(LegalRoute);
    }
  });

  it("finds a legal page for every legal route in every locale that publishes it", () => {
    for (const locale of LOCALES) {
      for (const routeId of Object.keys(LOCALIZED_ROUTE_VIEWS) as RouteId[]) {
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
