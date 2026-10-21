/**
 * `RulebookPageContent`: the rulebook served from this site rather than
 * Google Drive.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LOCALES, LOCALE_DEFINITIONS } from "../../content/routes.js";
import { RULEBOOK_LANGUAGES, rulebookDocuments } from "../../content/rulebook-documents.js";
import { siteCopyFor } from "../../content/editions.js";
import { RulebookPageContent } from "../src/components/pages/RulebookPageContent.js";
import { LANGUAGE_SWITCHER_LABELS } from "../src/lib/chrome-strings.js";

/** The href of the page's one primary button: the edition's own rulebook. */
const primaryHref = (markup: string) => /<a\b[^>]*class="[^"]*_primary_[^"]*"[^>]*href="([^"]*)"/.exec(markup)?.[1];

describe("RulebookPageContent", () => {
  const html = renderToStaticMarkup(<RulebookPageContent />);

  it("points at the committed PDF under storefront/public/", () => {
    expect(html).toContain('href="/documents/lunar-base-rulebook.pdf"');
    expect(html).toContain('hrefLang="en"');
    expect(html).toContain("It is a 8.9 MB download");
    expect(html).not.toContain("The rulebook is in English.");
  });

  it("links the German edition's own PDF, says what the file is and how large, and no longer calls the rulebook English", () => {
    const german = renderToStaticMarkup(<RulebookPageContent locale="de" />);
    expect(german).toContain('href="/documents/lunar-base-rulebook-de.pdf"');
    expect(german).toContain('hrefLang="de"');
    expect(primaryHref(german)).toBe("/documents/lunar-base-rulebook-de.pdf");
    expect(german).toContain("Die vollständige Spielanleitung auf Deutsch");
    expect(german).toContain("Der Download ist 9,4 MB groß");
    expect(german).not.toContain("Die Spielanleitung ist auf Englisch.");
  });

  it("links the Estonian PDF and writes its size with a decimal comma", () => {
    const estonian = renderToStaticMarkup(<RulebookPageContent locale="et" />);
    expect(estonian).toContain('href="/documents/lunar-base-rulebook-et.pdf"');
    expect(estonian).toContain('hrefLang="et"');
    expect(estonian).toContain("Eestikeelne Lunar Base reegliraamat");
    expect(estonian).toContain("Faili suurus on 9,4 MB");
    expect(estonian).not.toContain("Reegliraamat on inglise keeles.");
  });

  it("links the Klingon PDF, says what the file is and how large, and no longer calls the rulebook English", () => {
    const klingon = renderToStaticMarkup(<RulebookPageContent locale="tlh" />);
    expect(klingon).toContain('href="/documents/lunar-base-rulebook-tlh.pdf"');
    expect(klingon).toContain('hrefLang="tlh"');
    expect(primaryHref(klingon)).toBe("/documents/lunar-base-rulebook-tlh.pdf");
    expect(klingon).toContain("tlhIngan Hol mIw paq naQ");
    expect(klingon).toContain("9.3");
    expect(klingon).toContain("(MB)");
    // The notice's own words, up to its first apostrophe, which the markup escapes.
    expect(klingon).not.toContain("English Hol lo");
  });

  describe("the other rulebook languages", () => {
    const listOf = (markup: string) => /<section\b[^>]*data-other-languages[^>]*>([\s\S]*?)<\/section>/.exec(markup)?.[1] ?? "";
    const sizeIn = (locale: (typeof LOCALES)[number], megabytes: number) =>
      new Intl.NumberFormat(LOCALE_DEFINITIONS[locale].numberFormatTag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(megabytes);

    it.each(LOCALES)("%s edition links every other rulebook language, with href, hreflang, lang, name and size", (locale) => {
      const markup = renderToStaticMarkup(<RulebookPageContent locale={locale} />);
      const list = listOf(markup);
      // The markup escapes an apostrophe, which Klingon copy is full of.
      const escaped = (text: string) => text.replace(/'/g, "&#x27;");
      expect(list).toContain(escaped(siteCopyFor(locale).interface.rulebook.otherLanguagesHeading));
      for (const language of RULEBOOK_LANGUAGES.filter((candidate) => candidate !== locale)) {
        const document = rulebookDocuments[language];
        const anchor = new RegExp(`<a\\b[^>]*href="/documents/${document.fileName}"[^>]*>`).exec(list)?.[0] ?? "";
        expect(anchor, `${locale} -> ${language}`).toContain(`hrefLang="${document.languageTag}"`);
        expect(anchor).toContain(`lang="${document.languageTag}"`);
        expect(anchor).toMatch(/\bclass="/);
        expect(list).toContain(`>${document.nativeName}</a>`);
        expect(list).toContain(escaped(siteCopyFor(locale).interface.rulebook.languageSize.replace("%megabytes%", sizeIn(locale, document.megabytes))));
      }
    });

    it.each(LOCALES)("%s edition shows its own rulebook as the primary button only, not in the list", (locale) => {
      const markup = renderToStaticMarkup(<RulebookPageContent locale={locale} />);
      const own = rulebookDocuments[locale].fileName;
      expect(listOf(markup)).not.toContain(own);
      expect(markup.split(`href="/documents/${own}"`).length - 1).toBe(1);
      expect(listOf(markup).match(/<a\b/g)?.length).toBe(RULEBOOK_LANGUAGES.length - 1);
    });

    it("names the three non-edition languages in their own language and writes sizes in the edition's format", () => {
      const german = listOf(renderToStaticMarkup(<RulebookPageContent locale="de" />));
      for (const name of ["Français", "Español", "Italiano", "English"]) expect(german).toContain(`>${name}</a>`);
      expect(german).toContain(`${sizeIn("de", rulebookDocuments["fr"].megabytes)} MB`);
      expect(german).toContain("8,9 MB");
    });

    it("spells each site language's name as the language selector does", () => {
      for (const locale of LOCALES) expect(rulebookDocuments[locale].nativeName).toBe(LANGUAGE_SWITCHER_LABELS[locale]);
    });
  });

  it("never links to the file-sharing host the rulebook used to live on — a completion criterion of the plan", () => {
    // Assembled rather than written literally — see support-page.test.tsx's
    // matching assertion for why.
    const fileShareHost = ["drive", "google", "com"].join(".");
    expect(html.toLowerCase()).not.toContain(fileShareHost);
    expect(html.toLowerCase()).not.toContain("google drive");
  });

  /**
   * The page shipped an inline `<object type="application/pdf">` under this
   * application's own `object-src 'none'` policy. Chromium blocked it and the
   * page painted an empty bordered box. The viewer is gone and the link is
   * the whole affordance, so this asserts the absence as well as the
   * presence — a future edit re-adding an `<object>` would ship the same
   * blocked frame again.
   */
  it("offers the rulebook as a link, and embeds no plugin object the CSP forbids", () => {
    expect(html).toContain("Open the rulebook");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("application/pdf");
  });

  /**
   * The deleted fallback's `<a>` carried no class at all, so it painted the
   * user agent's `rgb(0, 0, 238)` on this page's Lunar surface — 1.59:1,
   * against WCAG 2.2 AA's 4.5:1. Every anchor this page's own `<main>` emits
   * now carries a class, and therefore a token colour. (Site chrome is
   * excluded because `SiteFooter`'s legal links are coloured by a descendant
   * selector rather than a class, and the reviewer's contrast sweep confirmed
   * they pass.)
   */
  it("gives every anchor in its own main content a class, so none falls back to the user agent's link colour", () => {
    const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
    const anchors = main.match(/<a\b[^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.filter((anchor) => !/\bclass="/.test(anchor))).toEqual([]);
  });

  it("has exactly one <h1>", () => {
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });
});
