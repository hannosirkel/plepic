/**
 * The glossary's term list: one closed set of ids that every language fills in.
 *
 * A term is here because a reader meets it in more than one place and must
 * meet the same word each time: on a card, in the rulebook, on the product
 * page, in the basket. The list is seeded from the rulebook and from the
 * English site copy; `glossary.test.ts` fails on an id that neither uses.
 *
 * `english` is the term as the rulebook or the site prints it. `forms` are the
 * English spellings that count as the term inside an English string, written
 * in the form syntax `schema.ts` describes. They are how the check knows that
 * a translated string owes the reader the agreed word.
 *
 * The forms are deliberately narrow where English reuses the word:
 *
 * - The six action names match with a capital only. "Draw" on a card is the
 *   action; "draw" in running text is a verb a translator may render freely.
 * - `supply` matches "Supply" and "the supply", never the bare verb, because
 *   the shop copy says "items we can supply" and means nothing about the game.
 * - `withdrawal` is the noun of the legal pages. The verb is left alone.
 */

/** How a term is treated in translation. `README.md` states the three rules. */
export const TERM_CLASSES = ["as-printed", "translated-with-original", "translated"] as const;

export type TermClass = (typeof TERM_CLASSES)[number];

export interface Term {
  readonly english: string;
  readonly class: TermClass;
  /** The English spellings that count as this term in an English string. */
  readonly forms: readonly string[];
}

export const TERMS = {
  // Card types and components. The cards carry these words in English.
  station: {
    english: "Station",
    class: "translated-with-original",
    forms: ["Station", "Stations", "station", "stations"],
  },
  agent: {
    english: "Agent",
    class: "translated-with-original",
    forms: ["Agent", "Agents", "agent", "agents"],
  },
  influence: {
    english: "Influence",
    class: "translated-with-original",
    forms: ["Influence", "Influences", "influence"],
  },
  module: {
    english: "Module",
    class: "translated-with-original",
    forms: ["Module", "Modules", "module", "modules"],
  },
  credit: {
    english: "Credit",
    class: "translated-with-original",
    forms: ["Credit", "Credits", "credit", "credits"],
  },
  creditCounter: {
    english: "Credit Counter",
    class: "translated",
    forms: ["Credit Counter", "Credit Counters", "credit counter", "credit counters"],
  },
  supply: {
    english: "Supply",
    class: "translated-with-original",
    forms: ["Supply", "the supply"],
  },
  base: {
    english: "Base",
    class: "translated-with-original",
    forms: ["Base", "Bases", "base", "bases"],
  },
  orb: {
    english: "Orb",
    class: "translated-with-original",
    forms: ["Orb", "Orbs", "orb", "orbs"],
  },
  shuttle: {
    english: "Shuttle",
    class: "translated-with-original",
    forms: ["Shuttle", "Shuttles", "shuttle", "shuttles"],
  },
  colonist: {
    english: "colonist",
    class: "translated",
    forms: ["colonist", "colonists", "Colonist", "Colonists"],
  },
  scientificAchievement: {
    english: "scientific achievement",
    class: "translated",
    forms: [
      "scientific achievement",
      "scientific achievements",
      "Scientific achievement",
      "Scientific achievements",
      "Scientific Achievement",
      "Scientific Achievements",
    ],
  },
  mainAction: {
    english: "Main Action",
    class: "translated-with-original",
    forms: ["Main Action", "Main Actions", "main action", "main actions"],
  },

  // The six action names, as the cards print them.
  draft: {
    english: "Draft",
    class: "translated-with-original",
    forms: ["Draft", "Drafts", "Drafted", "Drafting"],
  },
  draw: {
    english: "Draw",
    class: "translated-with-original",
    forms: ["Draw", "Draws", "Drew", "Drawn", "Drawing"],
  },
  discard: {
    english: "Discard",
    class: "translated-with-original",
    forms: ["Discard", "Discards", "Discarded", "Discarding"],
  },
  resell: {
    english: "Resell",
    class: "translated-with-original",
    forms: ["Resell", "Resells", "Resold", "Reselling"],
  },
  build: {
    english: "Build",
    class: "translated-with-original",
    forms: ["Build", "Builds", "Built", "Building"],
  },
  flip: {
    english: "Flip",
    class: "translated-with-original",
    forms: ["Flip", "Flips", "Flipped", "Flipping"],
  },

  // Table talk. No card carries these words, so they are translated freely.
  deck: {
    english: "deck",
    class: "translated",
    forms: ["deck", "decks", "Deck", "Decks"],
  },
  hand: {
    english: "hand",
    class: "translated",
    forms: ["hand", "hands", "Hand", "Hands"],
  },
  discardPile: {
    english: "discard pile",
    class: "translated",
    forms: ["discard pile", "discard piles", "Discard pile", "Discard Pile"],
  },
  victoryCondition: {
    english: "victory condition",
    class: "translated",
    forms: ["victory condition", "victory conditions", "Victory condition", "Victory conditions"],
  },

  // The seven Station names. Terran Outpost is the side every Station starts on.
  terranOutpost: { english: "Terran Outpost", class: "as-printed", forms: ["Terran Outpost"] },
  theOasis: { english: "The Oasis", class: "as-printed", forms: ["The Oasis"] },
  taikotech: { english: "Taikotech", class: "as-printed", forms: ["Taikotech"] },
  darkSide: { english: "Dark Side", class: "as-printed", forms: ["Dark Side"] },
  shackleton: { english: "Shackleton", class: "as-printed", forms: ["Shackleton"] },
  seleneLabs: { english: "Selene Labs", class: "as-printed", forms: ["Selene Labs"] },
  imbrium: { english: "Imbrium", class: "as-printed", forms: ["Imbrium"] },

  // The product and the publisher.
  lunarBase: { english: "Lunar Base", class: "as-printed", forms: ["Lunar Base"] },
  plepicGames: { english: "Plepic Games", class: "as-printed", forms: ["Plepic Games"] },

  // The shop.
  rulebook: {
    english: "rulebook",
    class: "translated",
    forms: ["rulebook", "rulebooks", "Rulebook", "Rulebooks"],
  },
  basket: {
    english: "basket",
    class: "translated",
    forms: ["basket", "baskets", "Basket", "Baskets"],
  },
  checkout: {
    english: "checkout",
    class: "translated",
    forms: ["checkout", "Checkout"],
  },
  parcelMachine: {
    english: "parcel machine",
    class: "translated",
    forms: ["parcel machine", "parcel machines", "Parcel machine", "Parcel machines"],
  },
  withdrawal: {
    english: "withdrawal",
    class: "translated",
    forms: ["withdrawal", "withdrawals", "Withdrawal", "Withdrawals"],
  },
} as const satisfies Readonly<Record<string, Term>>;

export type TermId = keyof typeof TERMS;

export const TERM_IDS = Object.keys(TERMS) as readonly TermId[];

/**
 * Terms the English site copy and legal set never use, and where the rulebook
 * uses each. The transcription is not in this repository, so until the English
 * rulebook text lands a reader checks these, not the test.
 */
export const RULEBOOK_ONLY_TERMS: Readonly<Partial<Record<TermId, string>>> = {
  draft: 'sheet 13, "Draft. Take 1 card from the Supply"',
  draw: 'sheet 13, "Draw. Draw 1 card from the top of the deck"',
  discard: 'sheet 13, "If you are instructed to Discard more than 1 card"',
  flip: 'sheet 15, "Flip Station. Flip the indicated Station card(s)"',
  terranOutpost: 'sheet 5, "with the Terran Outpost side showing"',
};
