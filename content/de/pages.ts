/**
 * The page registry — the German edition of `../pages.ts`: a title and a
 * description per route.
 *
 * Routes, `indexable` and the section lists are the English ones; only the
 * titles and descriptions are German. Both are unique within the edition, the
 * legal pages included, and a description stays within 160 characters.
 *
 * Published under `/de` through `pagesByLocale`, alongside the German legal pages.
 * The mirror and content scans continue to check this file.
 *
 * „Warenkorb“, „Kasse“ and „Spielanleitung“ are the words of
 * `content/glossary/de.ts`.
 */

import { legalPagesByLocale } from "../legal/index.js";
import type { Page } from "../schema.js";

export const marketingPages: readonly Page[] = [
  {
    route: "home",
    title: "Plepic Games",
    description:
      "Ein kleiner, unabhängiger Brettspielverlag bei Tallinn. Sechs Menschen, ein Spiel, drei Jahre Arbeit – und in etwa einer Minute liegt es auf dem Tisch.",
    indexable: true,
    sections: ["proof", "story", "newsletter"],
  },
  {
    route: "lunarBase",
    title: "Lunar Base – ein Strategie-Kartenspiel für 2–6 Personen",
    description:
      "Bau die mächtigste Mondbasis. Vier Wege zum Sieg, Agenten, die deinen Rivalen in die Quere kommen, 90 Karten, ca. 30 Minuten und eine Schachtel für die Tasche.",
    indexable: true,
    sections: [
      "aboutgame",
      "how-it-plays",
      "victory-paths",
      "in-the-box",
      "travels-well",
      "video_trailer",
      "reviews",
      "shipping-and-returns",
      "buy",
    ],
  },
  {
    route: "support",
    title: "Lunar Base: Hilfe und Regeln",
    description:
      "Die vollständige Spielanleitung, die häufigsten Fragen vom Spieltisch, die Liste des Spielmaterials, das Erklärvideo und ein Weg, uns zu erreichen.",
    indexable: true,
    sections: ["rules-faq", "components", "contact"],
  },
  {
    route: "rulebook",
    title: "Spielanleitung zu Lunar Base",
    description:
      "Die vollständige Spielanleitung zu Lunar Base, wie sie gedruckt in der Schachtel liegt, lesbar und durchsuchbar.",
    indexable: true,
    sections: [],
  },
  {
    route: "cart",
    title: "Warenkorb",
    description: "Was du gleich kaufst und was es einschließlich Lieferung kostet.",
    indexable: false,
    sections: ["buy"],
  },
  {
    route: "checkout",
    title: "Kasse",
    description: "Lieferadresse, Versand und Zahlung.",
    indexable: false,
    sections: ["checkout-acknowledgement"],
  },
];

/** Every page of the German edition, marketing and legal alike. */
export const pages: readonly Page[] = [...marketingPages, ...legalPagesByLocale["de"]];
