/**
 * Publisher copy: who Plepic is, the story, the team, the newsletter.
 *
 * The register to hold: deliberately small and independent, not provisional.
 * Nothing here asks a visitor to buy so that more games can exist.
 */

import type {
  CallToAction,
  ListItem,
  Prose,
  Section,
  Statement,
} from "./schema.js";

/**
 * The homepage hero sentence. One sentence, confident, past tense, no request.
 *
 * "Six people" and "three years" are E8. "Near Tallinn" is E8. "One game" is
 * the frozen Task 1 catalogue: there is exactly one product.
 */
export const publisherSentence: Statement = {
  text: "Plepic Games is a small independent publisher near Tallinn. We have published one game, and we took three years over it.",
  source: "E8",
};

/** The short form, for the footer, the About lede and social metadata. */
export const publisherShort: Statement = {
  text: "A small independent board game publisher near Tallinn. Six people, one game, three years of work.",
  source: "E8",
};

/**
 * The publisher story. Homepage story section and the spine of /about.
 *
 * Paragraph by paragraph: origin (E8), what the three years were actually
 * spent on (E8), what happened next (E5, E6), and why the company stays this
 * size. The last paragraph is the one doing the real work — it is the
 * difference between "small because we have not grown yet" and "small on
 * purpose".
 */
export const publisherStory: Section = {
  anchor: "story",
  heading: "Six people, one game, three years",
  body: [
    "Lunar Base started in 2017. Six of us, near Tallinn, with a setting we liked — the Moon, carved up between organisations that each wanted it for a completely different reason — and no idea yet what the game actually was.",
    "It took three years to find out, and most of that work was subtraction. Rules that were clever but slowed the table down came out. Features that read well on paper and were no fun in play came out and stayed out. What survived is ninety cards that set up in about a minute and finish in about thirty.",
    "Then it went to Kickstarter, was funded by over two thousand backers, and was printed, boxed and posted. Since then it has been on shop shelves. A board game café in Denmark has sold around fifty copies, had us in to talk about how the game was made, and run a Lunar Base tournament of its own.",
    "We are still six people. That is not a stage we are passing through on the way to something larger — being this small is exactly what let us throw away three years of work, a piece at a time, until the game was good.",
  ],
  source: "E8",
};

/**
 * Per-paragraph sourcing for the story above, so the editorial gate can check
 * it line by line instead of trusting the section-level id.
 */
export const publisherStorySources: readonly Statement[] = [
  { text: "2017, six people, near Tallinn.", source: "E8" },
  { text: "Three years of iteration, scope reduced until the game was fun.", source: "E8" },
  { text: "Funded on Kickstarter by over two thousand backers, then delivered.", source: "E5" },
  {
    text: "Around fifty copies sold at a Danish board game café, which hosted a making-of talk and a tournament.",
    source: "E6",
  },
  { text: "Still six people.", source: "E8" },
];

/**
 * The compact timeline for /about.
 *
 * Every entry is a completed, dated-or-orderable past event. No entry implies
 * anything is still under way. There is deliberately no year against the
 * Kickstarter row: the campaign year is not in the evidence manifest, and an
 * approximately-right year is still an invented one.
 */
export const timeline: readonly ListItem[] = [
  {
    term: "2017",
    detail: "Six of us start work on a card game about colonising the Moon.",
    source: "E8",
  },
  {
    term: "Three years of playtesting",
    detail:
      "Most of it spent removing things. The version that survived is the one people kept asking to play again.",
    source: "E8",
  },
  {
    term: "Kickstarter",
    detail: "Funded by over two thousand backers, then printed, boxed and posted.",
    source: "E5",
  },
  {
    term: "Into shops",
    detail:
      "Retail chains in Finland and Estonia sold around a hundred copies each over twelve months.",
    source: "E7",
  },
  {
    term: "Brætspilscaféen, Denmark",
    detail:
      "Around fifty copies sold, a talk about how the game was made, and a Lunar Base tournament hosted by the café.",
    source: "E6",
  },
];

/**
 * The team section.
 *
 * Names and roles are **not written here**, because they are not in the
 * evidence manifest and this repository is public. The manifest records one
 * genuine group photograph of six people and no roster. The plan asks /about to
 * carry names and roles in HTML; supplying them is an operator input, tracked
 * in the content document's open-inputs list. Until they arrive the section
 * ships with the photograph and the headcount, both of which are evidenced.
 */
export const team: Section = {
  anchor: "team",
  heading: "The six",
  body: [
    "That is all of us. We are not a studio with a roster — we are six people who kept turning up to the same table for three years.",
  ],
  source: "E8",
};

/**
 * The newsletter proposition.
 *
 * Every clause of the old site's version described a product that had not
 * shipped yet; it is quoted and replaced line by line in the content document.
 * This version offers a reason to subscribe that survives the product already
 * existing, and says plainly how rarely it will be used. Single opt-in, so the
 * promise has to be modest enough that no confirmation step is needed to
 * justify it.
 */
export const newsletter = {
  heading: "Hear from us rarely",
  body: [
    "We send an email when there is genuinely something worth an email: a new game, a reprint, or somewhere new to play Lunar Base. No countdowns, no diaries, no monthly filler.",
    "One click to leave, and your address goes nowhere else.",
  ] satisfies Prose,
  fieldLabel: "Email address",
  submitLabel: "Subscribe",
  consentNote:
    "By subscribing you agree to receive occasional email from us. You can unsubscribe from any message.",
  successMessage: "You are subscribed. We will write only when there is something worth sending.",
  errorMessage: "That did not subscribe you. Please check the form and try again.",
  postPurchaseHeading: "Hear from us after your order",
  postPurchaseBody:
    "This choice does not affect your order. Subscribe only if you want occasional Plepic Games news.",
  postPurchaseConsentLabel: "Yes, subscribe this email address to occasional news.",
} as const;

/** Homepage hero calls to action, in order of intended emphasis. */
export const homepageCallsToAction: readonly CallToAction[] = [
  {
    label: "Explore Lunar Base",
    emphasis: "primary",
    target: { kind: "route", to: "lunarBase" },
  },
  {
    label: "Buy for {price}",
    emphasis: "secondary",
    target: { kind: "route", to: "lunarBase", anchor: "buy" },
    accessibleLabel: "Buy Lunar Base for {price}",
  },
];
