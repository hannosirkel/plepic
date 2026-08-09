/**
 * The page registry: every route, its title, its description, whether it may be
 * indexed, and the sections it contains.
 *
 * This is where the per-page SEO surface starts. Titles and descriptions are
 * unique by test, not by discipline, and the section lists are the anchors a
 * page must actually render — including the two odd legacy fragment names that
 * existing backlinks carry.
 */

import { legalPages } from "./legal/index.js";
import type { Page } from "./schema.js";

export const marketingPages: readonly Page[] = [
  {
    route: "home",
    title: "Plepic Games",
    description:
      "A small independent board game publisher near Tallinn. Six people, one game, three years of work — and it is on the table in about a minute.",
    indexable: true,
    sections: ["proof", "story", "newsletter"],
  },
  {
    route: "lunarBase",
    title: "Lunar Base — a 2-6 player strategy card game",
    description:
      "Build the most powerful moon base. Four ways to win, agents that get in your rivals' way, 90 cards, about 30 minutes, and a box that fits in a bag.",
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
    route: "about",
    title: "About Plepic Games",
    description:
      "Six of us started a card game about the Moon in 2017 and spent three years taking things out of it. This is what happened next.",
    indexable: true,
    sections: ["story", "team", "timeline"],
  },
  {
    route: "support",
    title: "Lunar Base support and rules",
    description:
      "The full rulebook, the questions that come up most often at a table, the component list, the tutorial video, and a way to reach us.",
    indexable: true,
    sections: ["rules-faq", "components", "contact"],
  },
  {
    route: "rulebook",
    title: "Lunar Base rulebook",
    description:
      "The complete Lunar Base rulebook, as printed in the box, readable and searchable.",
    indexable: true,
    sections: [],
  },
  {
    route: "cart",
    title: "Basket",
    description: "What you are about to buy, and what it will cost delivered.",
    indexable: false,
    sections: ["buy"],
  },
  {
    route: "checkout",
    title: "Checkout",
    description: "Delivery address, shipping and payment.",
    indexable: false,
    sections: ["checkout-acknowledgement"],
  },
];

/** Every page on the site, marketing and legal alike. */
export const pages: readonly Page[] = [...marketingPages, ...legalPages];
