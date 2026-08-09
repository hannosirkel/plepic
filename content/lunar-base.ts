/**
 * Lunar Base product copy — the single canonical set. There is exactly one
 * product page and exactly one set of product copy; anything that needs the
 * game described imports it from here.
 *
 * Where the publisher has approved wording, that wording is used verbatim.
 * Where the rulebook states a number, the rulebook's number is used exactly.
 * Nothing here is paraphrased for flow.
 */

import type {
  CallToAction,
  FaqEntry,
  ListItem,
  Section,
  Statement,
} from "./schema.js";

/**
 * The hero, in three lines, in this order. The order is the decision; the
 * wording follows from it.
 *
 * 1. {@link pitch} — what the thing is. Official wording, first sentence,
 *    verbatim. A visitor cannot be told why something is good before being told
 *    what it is, and nothing is gained by rewriting a sentence this clear.
 * 2. {@link differentiator} — why it is not the other ten small boxes. This is
 *    the objection that stops the purchase, so it goes where a visitor actually
 *    reaches it rather than into a feature list further down.
 * 3. {@link heroFacts} — two figures.
 *
 * The official wording's second sentence is deliberately **not** used. "It's
 * fast paced, medium-light weight, portable and easy to set up" is four
 * adjectives where facts belong: "medium-light weight" is jargon a general
 * buyer cannot parse, and "fast paced" is a vaguer version of a number we have.
 * Line 3 states the figures those adjectives were gesturing at. "Portable" is
 * not lost either — it becomes {@link travelsWell}, with the measurements.
 */
export const pitch: Statement = {
  text: "Lunar Base is a 2-6 player strategy card game where you compete to build the most powerful moon base.",
  source: "official-wording",
};

export const differentiator: Statement = {
  text: "Four ways to win, all live at once — and agents you can send into someone else's base to slow them down.",
  source: "official-wording",
};

/**
 * Two figures, each keyed separately, because they come from different manifest
 * entries and a single sentence carrying both would have to cite one and mean
 * two.
 */
export const heroFacts: readonly Statement[] = [
  { text: "About a minute to set up.", source: "E11" },
  { text: "About 30 minutes to play.", source: "E10" },
];

/** Official wording, verbatim. Replayability. */
export const replayability: Statement = {
  text: "The game offers replayability and complexity through 4 unique win conditions, different strategies, card combinations, and the add-on Influence cards that change up the dynamics of the gameplay.",
  source: "official-wording",
};

/** Official wording, verbatim. The game-night use case, which is the buyer. */
export const gameNightUse: Statement = {
  text: "Get it to the table as a warm up or wind down during your game nights, dealing people in/out as needed. Or enjoy it as the main event in 'best of 3 / 5' mode.",
  source: "official-wording",
};

/** The specification strip beside the box. Every figure keys to the manifest. */
export const specifications: readonly ListItem[] = [
  { term: "Players", detail: "2–6", source: "E9" },
  { term: "Playing time", detail: "About 30 minutes", source: "E10" },
  { term: "Setup", detail: "About a minute", source: "E11" },
  { term: "Weight", detail: "Medium-light", source: "official-wording" },
  { term: "Cards", detail: "90", source: "components" },
];

/**
 * How it plays, in three steps.
 *
 * These are the rulebook's three steps of a turn, in the rulebook's order, not
 * a marketing summary of them. A visitor who buys on the strength of this
 * section and then opens the box finds the same three steps printed on page 11.
 */
export const howItPlays: Section = {
  anchor: "how-it-plays",
  heading: "A turn is three steps",
  body: [
    "Play agent cards. At the start of your turn you may play as many as you can pay for — to speed your own base up, or to get in someone else's way.",
    "Perform one main action from your base. Build a module, draft, draw, discard, resell, flip a station, steal a module, steal credits. One action, chosen from what your base can actually do — which is why what you build changes what you can do next turn.",
    "Check for arriving shuttles. When the supply runs dry, everyone earns a credit for each completed yellow orb in their base, and new cards come down from Earth.",
  ],
  source: "rulebook",
};

/**
 * The four victory paths.
 *
 * Thresholds are the rulebook's exact wording. The gloss under each is what the
 * threshold means at the table, and is written to make the four read as four
 * genuinely different games rather than four scoring tracks.
 */
export const victoryPathsIntro: Statement = {
  text: "In order to win the space race, play to your station's strengths. Win by housing the most colonists, researching scientific achievements, hoarding lunar credits, or gaining the most influence.",
  source: "official-wording",
};

export const victoryPaths: readonly ListItem[] = [
  {
    term: "Collect 20 lunar Credits",
    detail:
      "Play the market. Resell what you do not need, take credits off the people who do, and never build anything you cannot afford twice.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "House 10 colonists in your Base",
    detail:
      "Build wide. Colonists come on your station and on modules, so this is the path that wants a big, well-connected base — and the one everyone can see coming.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Complete 5 different scientific achievements in your Base",
    detail:
      "Five different ones. Four achievements and a duplicate is not a win, which is the trap this path sets for the player who is not counting.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Reveal 4 Influence cards from your hand at the end of your turn",
    detail:
      "The quiet one. Influence cards are the advanced variant, so this path only exists once you shuffle them in — and it can end the game from a hand nobody has looked at.",
    source: "rulebook-victory-conditions",
  },
];

export const victoryPathsNote: Statement = {
  text: "The game ends the moment somebody meets a condition. There is no final scoring round, so the last turn is always somebody winning rather than everybody adding up.",
  source: "rulebook",
};

export const influenceVariantNote: Statement = {
  text: "The rulebook recommends leaving the Influence cards out of your first few games and shuffling them in once the table knows what it is doing.",
  source: "rulebook",
};

/** What is in the box. Exact, from the rulebook's component list. */
export const inTheBox: readonly ListItem[] = [
  { term: "6 Stations", detail: "One per player, double-sided.", source: "components" },
  { term: "26 Agents", detail: "Played at the start of your turn, for a cost.", source: "components" },
  { term: "8 Influences", detail: "The advanced variant, and the fourth way to win.", source: "components" },
  { term: "50 Modules", detail: "What your base is built out of.", source: "components" },
  { term: "6 Credit Counters", detail: "One per player, dialled to your current credits.", source: "components" },
  { term: "Rulebook", detail: "The full rules, also readable on this site.", source: "rulebook" },
];

export const inTheBoxSummary: Statement = {
  text: "A total of 90 cards — 6 Stations, 26 Agents, 8 Influences and 50 Modules — plus 6 Credit Counters and the rulebook.",
  source: "components",
};

/**
 * Why it travels well.
 *
 * The old copy claimed the box "fits in the pocket". The frozen packaged
 * dimensions are 12 × 12 × 4 cm at 200 g, which is not a pocket, so the claim
 * is replaced with the measurement and a use case that is true.
 */
export const travelsWell: Section = {
  anchor: "travels-well",
  heading: "It goes in the bag you already carry",
  body: [
    "The box is 12 by 12 by 4 centimetres and weighs 200 grams. It fits in a rucksack pocket without planning.",
    "That is the difference between a game you own and a game you play: this one comes to the pub, the cabin and the second day of a convention, and it is the box that comes back out when the big one finishes at eleven.",
  ],
  source: "E12",
};

/**
 * The six factions.
 *
 * Kept from the publisher's own campaign-era description — the subject is fine,
 * only the tense was ever the problem. Tightened, not rewritten.
 */
export const factions: readonly ListItem[] = [
  {
    term: "Shackleton",
    detail:
      "UN-backed, and building one large multinational city on the theory that a space civilisation starts by everyone living together.",
    source: "official-wording",
  },
  {
    term: "Taikotech",
    detail:
      "Convinced that profit from mining and heavy industry is what actually lifts humanity off the planet.",
    source: "official-wording",
  },
  {
    term: "Selene Labs",
    detail:
      "Buying the brightest minds available and pointing them at the door out of the solar system.",
    source: "official-wording",
  },
  {
    term: "Dark Side",
    detail:
      "Biotech and augmented-reality money, betting on transhumanism: improve the crew before you improve the ship.",
    source: "official-wording",
  },
  {
    term: "Imbrium",
    detail:
      "An industrial cartel taking the old imperial route — be the mightiest, by industry or by trade.",
    source: "official-wording",
  },
  {
    term: "The Oasis",
    detail:
      "Making the Moon a second home for all of Earth's life, animals and plants included, especially the ones running out of room down here.",
    source: "official-wording",
  },
];

/**
 * Purchase panel copy.
 *
 * Every price is a placeholder resolved from the catalogue. Availability is a
 * statement, not a number: stock is not managed, so a count would be a
 * fabrication and a low-stock nudge would be a lie.
 */
export const purchase = {
  productName: "{productName}",
  priceLine: "{priceLine}",
  taxNote: "{taxNote}",
  availability: "In stock",
  notes: [
    {
      term: "Availability",
      detail:
        "In stock, and staying that way. We do not run a stock counter, so nothing on this page will ever tell you to hurry.",
      source: "stock-policy",
    },
    { term: "Dispatch", detail: "Dispatched within 3 business days.", source: "dispatch-window" },
    {
      term: "Duties",
      detail:
        "Outside the EU, import duties and handling are charged on arrival by the destination country and are payable by the recipient.",
      source: "duties-outside-eu",
    },
  ] satisfies readonly ListItem[],
  callsToAction: [
    { label: "Add to basket", emphasis: "primary", target: { kind: "route", to: "cart" } },
    {
      label: "Shipping and returns",
      emphasis: "quiet",
      target: { kind: "route", to: "legalShipping" },
    },
  ] satisfies readonly CallToAction[],
} as const;

/** Shipping, returns and support questions asked on the product page itself. */
export const productFaq: readonly FaqEntry[] = [
  {
    question: "How much is shipping?",
    answer: [
      "It is calculated at checkout from your delivery address. The price of the game is the same everywhere: {priceLine}",
    ],
    source: "shipping-charge",
  },
  {
    question: "Where do you ship?",
    answer: [
      "Everywhere. Orders are dispatched within 3 business days. Delivery inside the EU usually takes 3 to 7 business days, and elsewhere 7 to 21.",
    ],
    source: "delivery-estimates",
  },
  {
    question: "Can I return it?",
    answer: [
      "Yes. You have 14 days from the day the parcel arrives to tell us you are withdrawing, and 14 more to send it back.",
    ],
    source: "withdrawal-terms",
  },
  {
    question: "Is there an English rulebook?",
    answer: [
      "The rulebook in the box is in English, and the same rulebook is on this site if you want to read it before you buy.",
    ],
    source: "rulebook",
  },
  {
    question: "Does it work at two players? At six?",
    answer: [
      "Both, and they are noticeably different games. At two, the supply holds five cards and there is one base across the table: it plays like a duel, and you can usually see what your opponent is reaching for.",
      "At six, the supply holds nine and there are five other bases to build against, so the agent cards have far more to aim at. Six is the top of the range it was designed for, not the edge of it.",
    ],
    source: "rulebook",
  },
];
