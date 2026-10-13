/**
 * The "Play online" box on the Lunar Base page.
 *
 * The online game is not a storefront route. A path rule in front of this
 * application sends {@link PLAY_ONLINE_PATH} to another process, and the game
 * is in English only. Three things follow, and each is held here:
 *
 * - The link is a plain same-origin anchor at exactly that path: no edition
 *   prefix, no host, and no client-side router that would look the path up
 *   among this application's routes.
 * - An edition that is not English says where the link leads, in its copy and
 *   in `hreflang`, as any link that leaves an edition does.
 * - The box stands at the top of the page, before the pitch, so a reader
 *   meets it without scrolling.
 *
 * The expected words are written out per edition and not read from
 * `content/`: a table that imported its expectations would agree with
 * whatever the edition says.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, LOCALE_DEFINITIONS, PLAY_ONLINE_PATH, ROUTE_PATHS, type Locale } from "../../content/routes.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";
import { buildRobotsRules } from "../src/lib/robots-contract.js";
import { buildSitemapEntries } from "../src/lib/sitemap-contract.js";
import { routeIdForPath } from "../src/lib/urls.js";

const EXPECTED: Readonly<Record<Locale, { heading: string; linkLabel: string; body: RegExp; namesEnglish?: RegExp }>> = {
  en: {
    heading: "Play online",
    linkLabel: "Play Lunar Base online",
    body: /in your browser for free.*No account needed\./,
  },
  de: {
    heading: "Online spielen",
    linkLabel: "Lunar Base online spielen",
    body: /kostenlos im Browser.*Ein Konto brauchst du nicht\./,
    namesEnglish: /auf Englisch/,
  },
  et: {
    heading: "Mängi veebis",
    linkLabel: "Mängi Lunar Base’i veebis",
    body: /tasuta otse brauseris.*Kontot pole vaja\./,
    namesEnglish: /inglise keeles/,
  },
  tlh: {
    heading: "SIr'o'Daq yIQuj",
    linkLabel: "SIr'o'Daq Lunar Base yIQuj",
    body: /DIlnISbe'lu'.*bIqI'nISbe'\./,
    namesEnglish: /English Hol/,
  },
};

function decodeEntities(text: string): string {
  return text.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

/** The box as rendered, tags included, or the empty string when the page has none. */
function playOnlineBoxIn(html: string): string {
  return /<div[^>]*data-play-online[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
}

/** The text of the box's element whose class names `part`: `Heading`, `Body` or `Link`. */
function textOf(box: string, part: "Heading" | "Body" | "Link"): string {
  const pattern = new RegExp(`<(\\w+)\\b[^>]*class="[^"]*playOnline${part}[^"]*"[^>]*>([\\s\\S]*?)</\\1>`);
  return decodeEntities(pattern.exec(box)?.[2] ?? "");
}

describe("the online game's address", () => {
  it("is one site-relative path, written once", () => {
    expect(PLAY_ONLINE_PATH).toBe("/play/lunar-base");
  });

  it("is not a route of this application", () => {
    expect(Object.values(ROUTE_PATHS)).not.toContain(PLAY_ONLINE_PATH);
    expect(routeIdForPath(PLAY_ONLINE_PATH)).toBeUndefined();
  });

  it("is not listed in the sitemap, which holds this application's pages only", () => {
    const entries = buildSitemapEntries("https://example.com");
    expect(entries.some((entry) => entry.url.includes(PLAY_ONLINE_PATH))).toBe(false);
  });

  it("is not closed to crawlers", () => {
    const rules = buildRobotsRules({ isTestHost: false, baseUrl: "https://example.com" }).rules;
    const disallowed = [rules].flat().flatMap((rule) => rule.disallow ?? []);
    expect(disallowed.some((path) => PLAY_ONLINE_PATH.startsWith(path))).toBe(false);
  });
});

describe("the Play online box on the Lunar Base page", () => {
  for (const locale of LOCALES) {
    const html = renderToStaticMarkup(<LunarBaseMockup locale={locale} />);
    const box = playOnlineBoxIn(html);
    const expected = EXPECTED[locale];

    it(`renders once in ${locale}, at the top of the hero and before the pitch`, () => {
      expect(html.match(/data-play-online/g)).toHaveLength(1);
      const hero = html.indexOf('id="aboutgame"');
      const start = html.indexOf("data-play-online");
      expect(hero).toBeGreaterThan(-1);
      expect(start).toBeGreaterThan(hero);
      expect(start).toBeLessThan(html.indexOf("<h1"));
    });

    it(`says what it is in ${locale}`, () => {
      expect(textOf(box, "Heading")).toBe(expected.heading);
      // The pitch stays the page's first heading; see `tests/design-assets.test.tsx`.
      expect(box).not.toMatch(/<h[1-6]\b/);
      expect(textOf(box, "Body")).toMatch(expected.body);
    });

    it(`links to the game with one plain anchor in ${locale}`, () => {
      const anchors = [...html.matchAll(/<a\s[^>]*>/g)].map((match) => match[0])
        .filter((tag) => tag.includes("/play/"));
      expect(anchors).toHaveLength(1);
      expect(box).toContain(anchors[0]);
      // Exactly the path: no edition prefix, no host, no fragment.
      expect(/href="([^"]*)"/.exec(anchors[0]!)?.[1]).toBe("/play/lunar-base");
      expect(anchors[0]).not.toMatch(/target=|rel=/);
      expect(textOf(box, "Link")).toBe(expected.linkLabel);
    });

    if (locale === DEFAULT_LOCALE) {
      it("claims no language for an English link on the English page", () => {
        expect(box).not.toContain("hrefLang=");
      });
    } else {
      it(`tells a ${locale} reader that the game is in English`, () => {
        expect(textOf(box, "Body")).toMatch(expected.namesEnglish!);
        expect(box).toContain(`hrefLang="${LOCALE_DEFINITIONS[DEFAULT_LOCALE].languageTag}"`);
      });
    }
  }

  it("is not rendered through the client-side router", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "src", "components", "mockups", "LunarBaseMockup.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from "next\/link"/);
  });
});
