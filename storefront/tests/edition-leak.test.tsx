import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { siteCopyByLocale } from "../../content/editions.js";
import { pagesByLocale } from "../../content/index.js";
import { legalPagesByLocale } from "../../content/legal/index.js";
import { DEFAULT_LOCALE, LOCALES, type Locale, type RouteId } from "../../content/routes.js";
import countries from "../mock/countries.json";
import shipping from "../mock/shipping.json";
import { HomepageMockup } from "../src/components/mockups/HomepageMockup.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";
import { LegalPageContent } from "../src/components/pages/LegalPageContent.js";
import { RulebookPageContent } from "../src/components/pages/RulebookPageContent.js";
import { SupportPageContent } from "../src/components/pages/SupportPageContent.js";
import { BasketPageContent } from "../src/components/shop/BasketPageContent.js";
import { CheckoutPageContent } from "../src/components/shop/CheckoutPageContent.js";
import { CartProvider } from "../src/lib/cart-store.js";
import { NO_CONFIGURATION_VALUES } from "../src/lib/configuration-placeholders.js";
import { deliveryCountries } from "../src/lib/cart.js";
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { countryMayKeepEnglish, methodMayKeepEnglish, retainedEnglishPhrases } from "./english-leak-exemptions.js";

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&", "&quot;": "\"", "&lt;": "<", "&gt;": ">", "&#x27;": "'", "&#39;": "'",
};

function visibleText(html: string): string {
  return html.replaceAll(/<(?:script|style)\b[^>]*>[\s\S]*?<\/\s*(?:script|style)>/gi, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&(?:amp|quot|lt|gt|#x27|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replaceAll(/\s+/g, " ").trim();
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const english = siteCopyByLocale[DEFAULT_LOCALE];
if (english === null) throw new Error("The default edition needs site copy");
const englishStrings = [
  ...strings(english),
  ...strings(legalPagesByLocale[DEFAULT_LOCALE]),
].flatMap((source) => source.split(/(?<=[.!?])\s+/)
  .flatMap((sentence) => sentence.split(/\{[A-Za-z][A-Za-z0-9]*\}/)))
  .map((source) => source.replaceAll(/\s+/g, " ").trim())
  .filter((source) => source.split(/\s+/).length >= 4 && !Object.hasOwn(retainedEnglishPhrases, source));

export function leakedEnglish(html: string): string[] {
  const text = visibleText(html);
  return [...new Set(englishStrings.filter((source) => text.includes(source)))];
}

function render(route: RouteId, locale: Locale): string {
  const legal = legalPagesByLocale[locale].find((page) => page.route === route);
  if (legal !== undefined) return renderToStaticMarkup(
    <LegalPageContent page={legal} locale={locale} values={NO_CONFIGURATION_VALUES} />,
  );
  switch (route) {
    case "home": return renderToStaticMarkup(<HomepageMockup locale={locale} />);
    case "lunarBase": return renderToStaticMarkup(<LunarBaseMockup locale={locale} />);
    case "support": return renderToStaticMarkup(<SupportPageContent locale={locale} turnstileSiteKey={null} nonce={undefined} merchantContactAddress={null} />);
    case "rulebook": return renderToStaticMarkup(<RulebookPageContent locale={locale} />);
    case "cart": return renderToStaticMarkup(<CartProvider scenario={null} latencyMs={0}><BasketPageContent locale={locale} /></CartProvider>);
    case "checkout": return renderToStaticMarkup(<CartProvider scenario="filled" latencyMs={0}><CheckoutPageContent locale={locale} scenario="filled" latencyMs={0} turnstileSiteKey={null} nonce={undefined} /></CartProvider>);
    default: throw new Error(`No render fixture for ${route}`);
  }
}

function labelsInOptions(html: string): string[] {
  return [...html.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/g)].map((match) => visibleText(match[1] ?? ""));
}

export function dataLabelLeaks(html: string, locale: Locale): string[] {
  const labels = labelsInOptions(html);
  const summary = [...html.matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/g)]
    .map((match) => visibleText(match[1] ?? ""));
  const renderedLabels = [...labels, ...summary];
  const leaks: string[] = [];
  for (const country of deliveryCountries) {
    if (countryMayKeepEnglish(country, locale)) continue;
    if (renderedLabels.some((label) => label === country.name)) leaks.push(country.name);
  }
  for (const method of [shipping.method, shipping.parcelMachine]) {
    if (methodMayKeepEnglish(method.id)) continue;
    if (renderedLabels.some((label) => label === method.name || label.startsWith(`${method.name} — `))) leaks.push(method.name);
  }
  return leaks;
}

describe("published editions do not leak English copy or data labels", () => {
  it("scans every rendered route a non-default edition publishes", () => {
    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      for (const page of pagesByLocale[locale]) {
        const html = render(page.route, locale);
        expect(leakedEnglish(html), `${locale}/${page.route}`).toEqual([]);
        expect(dataLabelLeaks(html, locale), `${locale}/${page.route}`).toEqual([]);
      }
    }
  });

  /*
   * Too short for the sentence scan above, which reads four words and more.
   * The catalogue used to compose both labels in English for every edition.
   * A total table, so a new edition does not compile until its words are here.
   */
  it("words the product page's stock statement and player range in the edition's language", () => {
    const expected: Readonly<Record<Locale, { inStock: string; outOfStock: string; players: string }>> = {
      en: { inStock: "In stock", outOfStock: "Out of stock", players: "2–6 players" },
      de: { inStock: "Auf Lager", outOfStock: "Nicht auf Lager", players: "2–6 Personen" },
      et: { inStock: "Laos olemas", outOfStock: "Laost otsas", players: "2–6 mängijat" },
    };
    const paragraphs = (html: string): string[] =>
      [...html.matchAll(/<(p|li)\b[^>]*>([^<]*)<\/\1>/g)].map((match) => match[2] ?? "");

    for (const locale of LOCALES) {
      const words = expected[locale];
      const inStock = paragraphs(render("lunarBase", locale));
      // The hero and the purchase panel both state it.
      expect(inStock.filter((text) => text === words.inStock), locale).toHaveLength(2);
      expect(inStock, locale).toContain(words.players);

      const soldOut = resolveCatalogue({ ...mockCatalogue, availability: "OutOfStock" }, undefined, locale);
      const outOfStock = paragraphs(renderToStaticMarkup(<LunarBaseMockup locale={locale} catalogue={soldOut} />));
      expect(outOfStock.filter((text) => text === words.outOfStock), locale).toHaveLength(2);
      expect(outOfStock, locale).not.toContain(words.inStock);

      if (locale === DEFAULT_LOCALE) continue;
      for (const page of [inStock, outOfStock]) {
        expect(page.filter((text) => Object.values(expected[DEFAULT_LOCALE]).includes(text)), locale).toEqual([]);
      }
    }
  });

  it("rejects an English legal sentence pasted into a translated page", () => {
    const source = legalPagesByLocale[DEFAULT_LOCALE].flatMap((page) => strings(page))
      .flatMap((value) => value.split(/(?<=[.!?])\s+/))
      .find((value) => value.split(/\s+/).length >= 4 && leakedEnglish(`<p>${value}</p>`).length > 0);
    expect(source).toBeDefined();
    expect(leakedEnglish(`<p>${source}</p>`)).toContain(source);
  });

  it("rejects an English legal sentence after a placeholder is rendered", () => {
    const renderedSentence = "Registered in the Estonian Commercial Register (äriregister) under number [seadistamata: registrikood].";
    expect(leakedEnglish(`<p>${renderedSentence}</p>`))
      .toContain("Registered in the Estonian Commercial Register (äriregister) under number");
  });

  it("covers every shipping country and both method names", () => {
    expect(deliveryCountries.map((country) => country.name)).toEqual(countries.countries.map((country) => country.name));
    expect([shipping.method.name, shipping.parcelMachine.name]).toHaveLength(2);
  });

  it("rejects English labels in an Estonian checkout fixture", () => {
    expect(dataLabelLeaks("<option>Germany</option><dd>Standard delivery</dd>", "et"))
      .toEqual(["Germany", "Standard delivery"]);
    expect(dataLabelLeaks("<option>Saksamaa</option><dd>Tavapärane kohaletoimetamine</dd>", "et"))
      .toEqual([]);
    expect(dataLabelLeaks("<option>Peruu</option><option>Standard delivery — €5.00</option>", "et"))
      .toEqual(["Standard delivery"]);
  });
});
