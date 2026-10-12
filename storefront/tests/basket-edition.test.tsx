import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, LOCALE_DEFINITIONS } from "../../content/routes.js";
import { BasketPageContent } from "../src/components/shop/BasketPageContent.js";
import { DestinationSelector } from "../src/components/shop/DestinationSelector.js";
import { CartProvider } from "../src/lib/cart-store.js";
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { destinationForCode, destinationNameIn } from "../src/lib/destination.js";
import { formatAmount } from "../src/lib/cart.js";
import { editionsMarkedIn, unmarkedText } from "./helpers/marker-site-copy.js";

type Editions = typeof import("../../content/editions.js");
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("../../content/editions.js", async (importOriginal) => {
  const actual = await importOriginal<Editions>();
  const { markSiteCopy } = await import("./helpers/marker-site-copy.js");
  const source = actual.siteCopyFor("en");
  const siteCopyByLocale = Object.fromEntries(
    Object.keys(actual.siteCopyByLocale).map((locale) => [locale, markSiteCopy(source, locale)]),
  );
  return { ...actual, siteCopyByLocale, siteCopyFor: (locale: string) => siteCopyByLocale[locale] };
});

const destination = destinationForCode("EE");

function basket(scenario: "filled" | null, locale: (typeof LOCALES)[number]): string {
  return renderToStaticMarkup(
    <CartProvider scenario={scenario} latencyMs={0} destinationCode="EE">
      <BasketPageContent locale={locale} />
    </CartProvider>,
  );
}

describe("basket edition", () => {
  for (const locale of LOCALES) {
    for (const scenario of [null, "filled"] as const) {
      it(`${locale} ${scenario ?? "empty"} basket reads edition copy`, () => {
        const html = basket(scenario, locale);
        expect(editionsMarkedIn(html)).toEqual([locale]);
        const catalogue = resolveCatalogue(undefined, destination, locale);
        const exempt = [
          ...Object.values(catalogue).filter((value): value is string => typeof value === "string"),
          mockCatalogue.name,
          formatAmount(mockCatalogue.price.amount, "EUR", locale),
          formatAmount(mockCatalogue.price.amountWithTax, "EUR", locale),
          destinationNameIn(destination, locale),
        ];
        expect(unmarkedText(html, exempt)).toEqual([]);
      });
    }
  }

  it("keeps English price output and formats every edition by its declared tag", () => {
    for (const locale of LOCALES) {
      expect(formatAmount(700, "EUR", locale)).toBe(
        new Intl.NumberFormat(LOCALE_DEFINITIONS[locale].numberFormatTag, {
          style: "currency", currency: "EUR",
        }).format(7),
      );
    }
    expect(formatAmount(700, "EUR", "en")).toBe("€7.00");
  });

  it("keeps the country code while showing the Estonian destination name", () => {
    const html = renderToStaticMarkup(<DestinationSelector destinationCode="EE" locale="et" />);
    expect(html).toContain(`value="EE"`);
    expect(html).toContain(`>${destinationNameIn(destination, "et")}</option>`);
  });
});
