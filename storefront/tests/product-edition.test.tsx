import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE, LOCALES } from "../../content/routes.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";
import { FeatureSpecStrip } from "../src/components/FeatureSpecStrip.js";
import { buildProductJsonLd } from "../src/lib/product-jsonld.js";
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { CHROME_STRINGS, LANGUAGE_SWITCHER_LABELS } from "../src/lib/chrome-strings.js";
import { editionsMarkedIn, markedFor, unmarkedText } from "./helpers/marker-site-copy.js";

type Editions = typeof import("../../content/editions.js");

vi.mock("../../content/editions.js", async (importOriginal) => {
  const actual = await importOriginal<Editions>();
  const { markSiteCopy } = await import("./helpers/marker-site-copy.js");
  const source = actual.siteCopyFor("en");
  const siteCopyByLocale = Object.fromEntries(
    Object.keys(actual.siteCopyByLocale).map((locale) => [locale, markSiteCopy(source, locale)]),
  );
  return { ...actual, siteCopyByLocale, siteCopyFor: (locale: string) => siteCopyByLocale[locale] };
});

const { siteCopyFor: actualSiteCopyFor } = await vi.importActual<Editions>("../../content/editions.js");
const english = actualSiteCopyFor(DEFAULT_LOCALE);

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
}

describe("the product page under the marker fixture", () => {
  for (const locale of LOCALES) {
    const html = renderToStaticMarkup(<LunarBaseMockup locale={locale} />);

    it(`shows only its own edition's sentences in ${locale}`, () => {
      expect(editionsMarkedIn(html)).toEqual([locale]);
      expect(html).toContain(markedFor(locale, english.lunarBase.pitch.text));
      expect(html).toContain(markedFor(locale, english.interface.product.victoryHeading));
    });

    it(`shows no unmarked sentence in ${locale}`, () => {
      expect(unmarkedText(html, [
        ...stringsIn(CHROME_STRINGS[locale]),
        // The language selector names every edition in its own language, on every edition.
        ...Object.values(LANGUAGE_SWITCHER_LABELS),
        resolveCatalogue(undefined, undefined, locale).productName,
        resolveCatalogue(undefined, undefined, locale).vatIncludedNote,
        "Plepic Games", "Instagram", "Facebook",
        ...Object.values(resolveCatalogue(undefined, undefined, locale)).filter((value): value is string => typeof value === "string"),
      ].filter(Boolean))).toEqual([]);
    });

    it(`keeps every specification's icon in ${locale}`, () => {
      const strip = renderToStaticMarkup(<FeatureSpecStrip locale={locale} />);
      const items = [...strip.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1] ?? "");
      expect(items).toHaveLength(english.lunarBase.specifications.length);
      for (const [index, spec] of english.lunarBase.specifications.entries()) {
        expect(items[index]).toContain("<svg");
        expect(items[index]).toContain(markedFor(locale, spec.term));
      }
    });

    it(`puts its product copy in JSON-LD in ${locale}`, () => {
      const data = buildProductJsonLd({
        url: "https://example.com/games/lunar-base",
        description: markedFor(locale, english.pages.marketingPages[1]!.description),
      });
      expect(data.name).toBe(mockCatalogue.name);
      expect(data.description).toBe(markedFor(locale, english.pages.marketingPages[1]!.description));
    });
  }
});
