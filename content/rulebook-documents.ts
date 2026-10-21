import { LOCALES } from "./routes.js";

/**
 * Every language the rulebook PDF is published in: each site edition's
 * language, then the languages that have a rulebook and no edition.
 *
 * It lives here and not in `routes.ts` because `routes.ts` is the one source of
 * truth for what the site is published in, and a rulebook language is not that:
 * it has no URL prefix, no page, no sitemap entry, no `hreflang` alternate and
 * no selector entry. Declaring it beside the registry it keys keeps `Locale`,
 * `LOCALES` and everything derived from them untouched. The edition languages
 * come first, in `LOCALES` order, so the page lists them in a stable order.
 */
export const RULEBOOK_LANGUAGES = [...LOCALES, "fr", "es", "it"] as const;

export type RulebookLanguage = (typeof RULEBOOK_LANGUAGES)[number];

/** A published rulebook PDF under storefront/public/documents/. */
export interface RulebookDocument {
  /** BCP 47 tag: the `lang` and `hreflang` of a link to the file. */
  readonly languageTag: string;
  /**
   * The language's name in that language. Content, not a component string:
   * the storefront's `LANGUAGE_SWITCHER_LABELS` repeats the four edition names
   * (content may not import from the storefront), and
   * `storefront/tests/rulebook-page.test.tsx` holds the two equal.
   */
  readonly nativeName: string;
  readonly fileName: string;
  readonly megabytes: number;
  readonly sheetCount: number;
}

export const rulebookDocuments: Readonly<Record<RulebookLanguage, RulebookDocument>> = {
  en: { languageTag: "en", nativeName: "English", fileName: "lunar-base-rulebook.pdf", megabytes: 8.9, sheetCount: 25 },
  de: { languageTag: "de", nativeName: "Deutsch", fileName: "lunar-base-rulebook-de.pdf", megabytes: 9.4, sheetCount: 25 },
  et: { languageTag: "et", nativeName: "Eesti", fileName: "lunar-base-rulebook-et.pdf", megabytes: 9.4, sheetCount: 25 },
  tlh: { languageTag: "tlh", nativeName: "tlhIngan Hol", fileName: "lunar-base-rulebook-tlh.pdf", megabytes: 9.3, sheetCount: 25 },
  // Sizes are placeholders until the PDF build step records the real ones.
  fr: { languageTag: "fr", nativeName: "Français", fileName: "lunar-base-rulebook-fr.pdf", megabytes: 9.4, sheetCount: 25 },
  es: { languageTag: "es", nativeName: "Español", fileName: "lunar-base-rulebook-es.pdf", megabytes: 9.4, sheetCount: 25 },
  it: { languageTag: "it", nativeName: "Italiano", fileName: "lunar-base-rulebook-it.pdf", megabytes: 9.4, sheetCount: 25 },
};
