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
 * The homepage hero sentence, supplied by the operator on 2026-08-20.
 *
 * "Three years" and the six-person group are E8; the Kickstarter is E5. "Across
 * continents" is the operator's own account of how the group worked and is not
 * in the evidence manifest — it is a claim about ourselves, which is the one
 * class of statement we are the primary source for, so it stands on the
 * operator's word rather than on a manifest entry.
 *
 * It keeps the register the previous sentence set: past tense, no request to
 * buy, small on purpose rather than provisional.
 */
export const publisherSentence: Statement = {
  text: "Plepic Games is a group of board game enthusiasts who created Lunar Base — a Kickstarted card game perfected for over three years and across continents.",
  source: "E8",
};

/** The short form, for the footer, the About lede and social metadata. */
export const publisherShort: Statement = {
  text: "A small independent board game publisher near Tallinn. Six people, one game, three years of work.",
  source: "E8",
};

/**
 * The publisher story, replaced with the operator's own text on 2026-08-20.
 *
 * The heading is unchanged and is doing real work: the operator supplied one
 * paragraph and named the section by its heading, so the heading is the
 * locator rather than part of the replacement. It also still states the fact
 * the paragraph opens with, which keeps a reader who skims headings on the
 * same story as one who reads them.
 *
 * The four sourced paragraphs it replaces are still sourced line by line in
 * {@link publisherStorySources} — which now over-covers rather than under-
 * covers, because the retail sell-through sentence (E6) is no longer in the
 * body. That is deliberate. The manifest entry is what makes the claim
 * re-usable, and losing the sentence from one section is not a reason to
 * unrecord the evidence behind it.
 *
 * `origin-story` is an external target, not a URL: this file may carry no
 * absolute address, and the published account lives off-site.
 */
export const publisherStory: Section = {
  anchor: "story",
  heading: "Six people, one game, three years",
  body: [
    "Lunar Base began in 2017 when six friends in Estonia set themselves a simple challenge: create a portable card game they would genuinely want to play together. What started as a rough homemade prototype grew through years of experimentation, playtesting, balancing, artwork and world-building into a fast, compact strategy game about humanity’s race to colonize the Moon. Along the way the team grew, ideas were tested and discarded, and countless small improvements shaped the game into its final form—culminating in a successful Kickstarter campaign that transformed a project between friends into a published board game played around the world.",
  ],
  source: "E8",
  links: [
    {
      label: "Origin story",
      target: { kind: "external", to: "origin-story" },
      accessibleLabel: "Read the Lunar Base origin story",
    },
  ],
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
  body: ["*Finally*, enjoying the perfume of fresh print"],
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
    "We send an email when there is genuinely something worth an email: a new game, a reprint, or Lunar Base played on the Moon.",
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
