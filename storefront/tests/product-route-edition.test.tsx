import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE, LOCALES, LOCALE_DEFINITIONS } from "../../content/routes.js";
import { LunarBaseRoute } from "../src/app/localized-routes.js";
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { CHROME_STRINGS, LANGUAGE_SWITCHER_LABELS } from "../src/lib/chrome-strings.js";
import { destinationForCode } from "../src/lib/destination.js";
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
vi.mock("../../content/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../content/index.js")>();
  const { markSiteCopy } = await import("./helpers/marker-site-copy.js");
  const source = (await vi.importActual<Editions>("../../content/editions.js")).siteCopyFor("en");
  const pagesByLocale = Object.fromEntries(
    Object.keys(actual.pagesByLocale).map((locale) => [locale, markSiteCopy(source, locale).pages.pages]),
  );
  return { ...actual, pagesByLocale };
});
vi.mock("../src/config/runtime-config.js", () => ({
  getRuntimeConfig: () => ({
    medusa: { backendUrl: "http://backend.test", publishableKey: "pk_test" },
    merchant: { legalName: null, registeredAddress: null, registrationNumber: null, vatNumber: null, contactAddress: null, phoneNumber: null, returnAddress: null },
    externalTargets: {},
  }),
}));
vi.mock("../src/config/hosts.js", () => ({ loadSiteHostConfig: () => ({ baseUrl: "https://example.com" }) }));
vi.mock("../src/lib/nonce.js", () => ({ getRequestNonce: async () => undefined }));
vi.mock("../src/lib/destination-request.js", () => ({ getRequestDestination: async () => destinationForCode("EE") }));
vi.mock("../src/lib/store-product.js", () => ({
  loadStoreProduct: async () => ({ catalogue: { ...mockCatalogue, name: "Lunar Base Deluxe" }, variantId: "variant_test", analyticsVariantId: "variant_test", imageUrls: [] }),
}));
// This control needs Next's mounted router. Its labels belong to the delivery UI.
vi.mock("../src/components/shop/DestinationSelector.js", () => ({ DestinationSelector: () => null }));

const { siteCopyFor: actualSiteCopyFor } = await vi.importActual<Editions>("../../content/editions.js");
const english = actualSiteCopyFor(DEFAULT_LOCALE);

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
}

describe("the served product page", () => {
  for (const locale of LOCALES) {
    it(`renders ${locale} copy in the page and JSON-LD`, async () => {
      const html = renderToStaticMarkup(await LunarBaseRoute({ routeId: "lunarBase", locale }));
      const script = /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s.exec(html)?.[1];
      expect(script).toBeDefined();
      const jsonLd = JSON.parse(script!) as Record<string, unknown>;
      expect(jsonLd.name).toBe("Lunar Base Deluxe");
      expect(jsonLd.description).toBe(markedFor(locale, english.pages.marketingPages[1]!.description));
      expect(jsonLd.url).toBe(`https://example.com${LOCALE_DEFINITIONS[locale].pathPrefix}/games/lunar-base`);
      expect(editionsMarkedIn(html)).toEqual([locale]);
      const catalogue = resolveCatalogue({ ...mockCatalogue, name: "Lunar Base Deluxe" }, destinationForCode("EE"), locale);
      expect(html).toMatch(new RegExp(`<p class="[^"]*productName[^"]*">[^<]*${catalogue.productName}[^<]*</p>`));
      const outsideCopy = [
        ...stringsIn(CHROME_STRINGS[locale]),
        // The language selector names every edition in its own language, on every edition.
        ...Object.values(LANGUAGE_SWITCHER_LABELS),
        ...Object.values(catalogue).filter((value): value is string => typeof value === "string"),
        mockCatalogue.name, "Plepic Games", "Instagram", "Facebook",
      ].filter(Boolean);
      expect(unmarkedText(html, outsideCopy)).toEqual([]);
    });
  }
});
