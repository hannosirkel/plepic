/**
 * The site chrome's reader-facing strings, per published edition.
 *
 * The Estonian edition exists to discharge a language obligation: an
 * Estonian consumer reads their terms in Estonian. Serving that page inside
 * chrome labelled in English — "Returns", "Privacy", "Menu" — half-serves
 * it, and serving the incompleteness notice in English is worse than
 * cosmetic: that notice and its gap markers are interpolated into the
 * Estonian legal sentences themselves and are the disclosure that tells the
 * reader the notice is incomplete. So every string the chrome around a page
 * renders comes from this table, keyed by the locale being served.
 *
 * Total over `Locale`, exactly like every other registry in the locale
 * dimension: a new edition does not compile until its chrome strings are
 * written down, rather than inheriting English labels nobody decided on.
 *
 * **What is not in this table:** the publisher tagline in the footer, which
 * is marketing copy and comes from the edition's site copy
 * (`content/editions.ts`) — an edition that has none yet omits the tagline
 * rather than showing English marketing copy, see `SiteFooter.tsx`. **What stays as it is on every edition:**
 * proper nouns (Plepic Games, Lunar Base, Instagram, Facebook), and the
 * stored consent tokens (`granted`/`declined`), which are data, not copy.
 */

import type { Locale, RouteId } from "../../../content/routes.js";

/** The five legal routes, as the footer names them. */
export type LegalRouteId = Extract<
  RouteId,
  "legalImprint" | "legalTerms" | "legalShipping" | "legalReturns" | "legalPrivacy"
>;

export interface ChromeStrings {
  /** `aria-label` of the wordmark link back to the homepage. */
  readonly brandHomeLabel: string;
  /** `aria-label` of the primary `<nav>`. */
  readonly primaryNavLabel: string;
  /** The About link. */
  readonly navAbout: string;
  /** The Support link. */
  readonly navSupport: string;
  /** The narrow-viewport disclosure control. */
  readonly menuLabel: string;
  /** The close control inside the narrow-viewport navigation sheet. */
  readonly closeMenuLabel: string;
  /** The header's basket affordance. */
  readonly basketLabel: string;
  /** `aria-label` of the footer's legal `<nav>`. */
  readonly legalNavLabel: string;
  /** The footer's five legal links, labelled as their edition's pages are titled. */
  readonly legalLinkLabels: Readonly<Record<LegalRouteId, string>>;
  /** `aria-label` of the language selector's `<nav>`. */
  readonly languageNavLabel: string;
  /**
   * `aria-label` of the footer's social `<nav>`.
   *
   * Only rendered when every advertised social destination resolves to a URL;
   * see `src/components/SiteFooter.tsx` for why a partly-resolved row stays
   * plain text outside a landmark.
   */
  readonly socialNavLabel: string;
  /** The visible note on a page whose `reviewStatus` is still a draft. */
  readonly draftNote: string;
  /** The incompleteness notice's heading. */
  readonly noticeHeading: string;
  /**
   * The incompleteness notice's body, from the reader-facing labels of the
   * missing disclosures. A function rather than a template string because
   * each language inflects around the count.
   */
  readonly noticeBody: (missing: readonly string[]) => string;
}

export const CHROME_STRINGS: Readonly<Record<Locale, ChromeStrings>> = {
  en: {
    brandHomeLabel: "Plepic Games, home",
    primaryNavLabel: "Primary",
    navAbout: "About",
    navSupport: "Support",
    menuLabel: "Menu",
    closeMenuLabel: "Close menu",
    basketLabel: "Basket",
    legalNavLabel: "Legal",
    legalLinkLabels: {
      legalImprint: "Imprint",
      legalTerms: "Terms",
      legalShipping: "Shipping",
      legalReturns: "Returns",
      legalPrivacy: "Privacy",
    },
    languageNavLabel: "Language",
    socialNavLabel: "Social",
    draftNote: "Draft, pending the operator’s approval.",
    noticeHeading: "This notice is incomplete.",
    noticeBody: (missing) =>
      missing.length === 1
        ? `This detail has not been configured for this deployment, and it is marked in the ` +
          `text below: ${missing.join(", ")}. Until it is supplied, this page is not a ` +
          `complete legal notice and should not be relied on as one.`
        : `These details have not been configured for this deployment, and they are marked ` +
          `in the text below: ${missing.join(", ")}. Until they are supplied, this page is ` +
          `not a complete legal notice and should not be relied on as one.`,
  },
  de: {
    brandHomeLabel: "Plepic Games, Startseite",
    primaryNavLabel: "Hauptnavigation",
    navAbout: "Über uns",
    navSupport: "Hilfe",
    menuLabel: "Menü",
    closeMenuLabel: "Menü schließen",
    basketLabel: "Warenkorb",
    legalNavLabel: "Rechtliche Informationen",
    legalLinkLabels: {
      legalImprint: "Impressum",
      legalTerms: "Verkaufsbedingungen",
      legalShipping: "Versand und Lieferung",
      legalReturns: "Rücksendungen und Widerrufsrecht",
      legalPrivacy: "Datenschutz",
    },
    languageNavLabel: "Sprache",
    socialNavLabel: "Soziale Medien",
    draftNote: "Entwurf; die Freigabe durch den Betreiber steht noch aus.",
    noticeHeading: "Dieser rechtliche Hinweis ist unvollständig.",
    noticeBody: (missing) =>
      missing.length === 1
        ? `Diese Angabe wurde für diese Bereitstellung noch nicht konfiguriert und ist im ` +
          `folgenden Text gekennzeichnet: ${missing.join(", ")}. Solange sie fehlt, ist ` +
          `dieser rechtliche Hinweis unvollständig und Sie sollten sich nicht darauf verlassen.`
        : `Diese Angaben wurden für diese Bereitstellung noch nicht konfiguriert und sind im ` +
          `folgenden Text gekennzeichnet: ${missing.join(", ")}. Solange sie fehlen, ist ` +
          `dieser rechtliche Hinweis unvollständig und Sie sollten sich nicht darauf verlassen.`,
  },
  et: {
    brandHomeLabel: "Plepic Games, avaleht",
    /*
     * A whole noun, not the bare adjective "Peamine": the label composes
     * with the announced role for an English ear ("Primary" + navigation),
     * but a screen-reader user hears the Estonian label on its own, and an
     * adjective with no head noun hangs in the air.
     */
    primaryNavLabel: "Peamenüü",
    navAbout: "Meist",
    /*
     * "Klienditugi", not "kasutajatugi": this is a shop, so the person is a
     * customer, and Estonian e-commerce says klienditugi. Kasutajatugi is
     * software vocabulary.
     */
    navSupport: "Klienditugi",
    menuLabel: "Menüü",
    closeMenuLabel: "Sulge menüü",
    basketLabel: "Ostukorv",
    legalNavLabel: "Juriidiline teave",
    legalLinkLabels: {
      legalImprint: "Õigusteave",
      legalTerms: "Müügitingimused",
      legalShipping: "Saatmine",
      legalReturns: "Tagastamine",
      legalPrivacy: "Privaatsus",
    },
    languageNavLabel: "Keel",
    socialNavLabel: "Sotsiaalmeedia",
    draftNote: "Mustand, ootab haldaja heakskiitu.",
    noticeHeading: "See teade on puudulik.",
    noticeBody: (missing) =>
      missing.length === 1
        ? `Seda andmevälja ei ole selle keskkonna jaoks seadistatud ja see on allpool ` +
          `tekstis tähistatud: ${missing.join(", ")}. Kuni see on esitamata, ei ole see ` +
          `leht täielik õiguslik teade ja sellele ei saa sellisena tugineda.`
        : `Neid andmevälju ei ole selle keskkonna jaoks seadistatud ja need on allpool ` +
          `tekstis tähistatud: ${missing.join(", ")}. Kuni need on esitamata, ei ole see ` +
          `leht täielik õiguslik teade ja sellele ei saa sellisena tugineda.`,
  },
};

/**
 * The name of each edition's language, written in that language: a reader
 * looking for their language must be able to recognise it without reading
 * the page's. `LanguageSelector` renders one per listed edition, and marks
 * it with `lang` so a screen reader pronounces it as its speakers do.
 */
export const LANGUAGE_SWITCHER_LABELS: Readonly<Record<Locale, string>> = {
  en: "English",
  de: "Deutsch",
  et: "Eesti",
};
