/**
 * The evidence registry.
 *
 * Every figure, quotation and factual statement on this site keys to an entry
 * here, and every entry here keys to the operator's ignored evidence manifest.
 * The manifest is the authority; this file is its public index, so the
 * editorial gate is discharged by checking a list rather than by memory.
 *
 * The rule the manifest states, restated because it is the one that matters:
 * **nothing may appear on the site that is not in it.** Not a plausible figure,
 * not a remembered review, not a retailer name, not a score, not an award.
 * Adding an id here without an entry in the manifest is a fabrication with
 * extra steps.
 */

import type { CommercialTermId, Source, SourceId } from "./schema.js";

export const SOURCES: Readonly<Record<SourceId, Source>> = {
  E1: {
    id: "E1",
    kind: "review",
    attribution: "Rodney Smith, Watch It Played",
    summary:
      "Lunar Base was one of Rodney Smith's top-10 board game picks at AireCon.",
    presentation: ["quotation", "mention"],
    unverifiableByVisitor: true,
    caution:
      "A pick in a top-10 video, not an award. Never style it as a laurel, a medal or a badge. The video has been removed and cannot be linked, so this claim stands on the operator's word alone and must never be the site's headline proof.",
  },
  E2: {
    id: "E2",
    kind: "review",
    attribution: "Hairy Game Lords",
    summary:
      "Four quoted passages on portability, production, replayability and graphic design.",
    presentation: ["quotation"],
  },
  E3: {
    id: "E3",
    kind: "review",
    attribution: "Paul Grogan, Gaming Rules!",
    summary:
      "Quoted passages on repeat plays and on the clarity of the card design.",
    presentation: ["quotation"],
    caution:
      "Strong voice, weak proof to a visitor who has never heard of the game. Secondary position only, never the proof strip.",
  },
  E4: {
    id: "E4",
    kind: "review",
    attribution: "Tabletop Games Blog",
    summary:
      "One long passage on weight, pace and playing well at six players.",
    presentation: ["quotation"],
  },
  E5: {
    id: "E5",
    kind: "commercial-fact",
    summary:
      "Funded on Kickstarter with over 2,000 backers; funded and delivered.",
    presentation: ["figure", "statement"],
    caution:
      "No exact funding total in any currency, no percentage of goal, no backer count more precise than 'over 2,000', and no funding duration. None of those are evidenced. Past tense only.",
  },
  E6: {
    id: "E6",
    kind: "commercial-fact",
    attribution: "Brætspilscaféen, Denmark",
    summary:
      "Around 50 copies sold at a Danish board game café, which also hosted a making-of talk and a Lunar Base tournament.",
    presentation: ["figure", "statement"],
    caution:
      "Brætspilscaféen is the only retailer the site may name. No other retailer name is evidenced.",
  },
  E7: {
    id: "E7",
    kind: "commercial-fact",
    summary:
      "Around 100 copies each through retail chains in Finland and Estonia over twelve months.",
    presentation: ["figure", "statement"],
    caution: "The chains are not named anywhere, because their names are not evidenced.",
  },
  E8: {
    id: "E8",
    kind: "publisher-record",
    summary:
      "Lunar Base was designed over three years near Tallinn by six people.",
    presentation: ["statement"],
    caution:
      "Six, not seven. The evidence manifest and the only genuine team photograph both show six. Any headcount other than six is unevidenced.",
  },
  "official-wording": {
    id: "official-wording",
    kind: "official-wording",
    summary:
      "The publisher's own approved descriptions of the game, its win conditions, its replayability and its game-night use case.",
    presentation: ["statement", "quotation"],
    caution: "Prefer verbatim. Paraphrase loses the approval.",
  },
  "rulebook-victory-conditions": {
    id: "rulebook-victory-conditions",
    kind: "rulebook",
    summary:
      "The four victory conditions and their exact thresholds, as printed in the rulebook.",
    presentation: ["statement"],
  },
  components: {
    id: "components",
    kind: "rulebook",
    summary:
      "The exact contents of the box: 90 cards in four types, 6 Credit Counters, the rulebook.",
    presentation: ["statement", "figure"],
  },
  rulebook: {
    id: "rulebook",
    kind: "rulebook",
    summary:
      "The authoritative public rulebook, verified byte-identical to the operator's master and served from this site.",
    presentation: ["statement"],
  },
  E14: {
    id: "E14",
    kind: "commercial-fact",
    summary: "The campaign funded in two hours.",
    presentation: ["figure", "statement"],
    supportingOnly: true,
    checkableAt: "kickstarter-campaign",
    caution:
      "Provenance is thinner than the other commercial facts and the manifest says so: the figure appears in the plan's own text, not in the pitch deck, the retail letter, the origin story or the campaign-era copy, and the operator confirmed it against the Kickstarter page. That page refuses automated fetches, so nobody here has machine-verified it. Support a claim with it; never head one with it, and never state it without the campaign link beside it.",
  },
  E15: {
    id: "E15",
    kind: "commercial-fact",
    summary: "The campaign reached 4,606% of its goal.",
    presentation: ["figure", "statement"],
    supportingOnly: true,
    checkableAt: "kickstarter-campaign",
    caution:
      "Same provenance and the same restriction as E14. A percentage is the easiest number on this site to mistake for a headline; it is not one.",
  },
  E9: {
    id: "E9",
    kind: "official-wording",
    summary: "2-6 players.",
    presentation: ["statement", "figure"],
    caution:
      "The publisher's own specification, not third-party proof. E9 to E11 are the only player-count, playtime and setup figures the site may state.",
  },
  E10: {
    id: "E10",
    kind: "official-wording",
    summary: "About 30 minutes per game.",
    presentation: ["statement", "figure"],
  },
  E11: {
    id: "E11",
    kind: "official-wording",
    summary: "About a minute to set up.",
    presentation: ["statement", "figure"],
  },
  E12: {
    id: "E12",
    kind: "commercial-fact",
    summary: "Packaged 12 by 12 by 4 centimetres, 200 grams.",
    presentation: ["statement", "figure"],
  },
  E13: {
    id: "E13",
    kind: "commercial-fact",
    summary:
      "One advertised price worldwide, inclusive of tax. Delivered from configuration and never written into a content file, which is why the figure does not appear in this summary.",
    presentation: ["statement"],
  },
};

/**
 * The merchant's own commitments, and where each was decided.
 *
 * Kept beside the evidence registry and deliberately apart from it: these are
 * promises we are making, not facts anybody checked. The type system keeps them
 * out of the proof strip; this registry keeps them accountable.
 */
export const COMMERCIAL_TERMS: Readonly<
  Record<CommercialTermId, { readonly summary: string; readonly decidedIn: string }>
> = {
  "price-presentation": {
    summary:
      "One advertised price for every visitor in every country, inclusive of tax, with tax computed from the confirmed delivery address rather than added on top.",
    decidedIn: "Task 1, frozen commercial model",
  },
  "checkout-contract": {
    summary:
      "The order is an offer; the contract exists on dispatch confirmation. The final button says it carries an obligation to pay, and the goods, price, shipping, total, address and delivery estimate are all on that screen.",
    decidedIn: "Task 1 commercial model, and EU distance selling",
  },
  "stock-policy": {
    summary: "Stock is unlimited and unmanaged, so availability is a phrase and never a count.",
    decidedIn: "Task 1, frozen commercial model",
  },
  "dispatch-window": {
    summary: "Dispatched within 3 business days of payment clearing.",
    decidedIn: "Task 1, frozen commercial model",
  },
  "delivery-estimates": {
    summary: "3 to 7 business days inside the EU, 7 to 21 business days elsewhere.",
    decidedIn: "Task 1, frozen commercial model",
  },
  "shipping-charge": {
    summary:
      "Shipping is charged per order, calculated at checkout from the delivery address, and shown before payment.",
    decidedIn: "Task 1, frozen commercial model",
  },
  "duties-outside-eu": {
    summary:
      "Import duties and handling outside the EU are borne by the recipient, stated as one line and never calculated.",
    decidedIn: "Task 1, frozen commercial model",
  },
  "withdrawal-terms": {
    summary:
      "14 days from delivery to withdraw and 14 more to return, with the refund covering the goods and the standard outbound delivery charge.",
    decidedIn: "EU distance selling; restated here as our undertaking",
  },
  "return-postage": {
    summary: "The buyer bears the cost of returning the goods.",
    decidedIn: "Statutory default, pending operator confirmation",
  },
};

/**
 * Claims that are **not** evidenced and therefore may never appear.
 *
 * The funding duration and the percentage of goal used to be on this list. They
 * came off it when the manifest gained E14 and E15: the first revision refused
 * them correctly against the manifest as it then stood, and the manifest was
 * what changed. What stays barred is what the manifest still bars — the exact
 * funding total in any currency, and any backer count tighter than "over 2000".
 * Neither has a number to match on, so neither appears below; the list holds
 * only phrases a writer might actually type.
 *
 * `content.test.ts` fails the build if any of these strings appears in a
 * content file.
 */
export const NOT_PUBLISHABLE = [
  "out of 10",
  "score of",
  "award",
  "laurel",
  "medal",
  "print and play",
  "print-and-play",
  "google drive",
] as const;

/**
 * Campaign-state language.
 *
 * The distinction the plan draws is tense, not subject: "funded by over 2,000
 * backers" is proof, "sign up and we will let you know when the game is ready"
 * is a live campaign for a product that shipped years ago. The old site was
 * written entirely in the second voice. These phrases carry it, so they are
 * banned mechanically rather than by vigilance.
 *
 * "startup" is on the list on purpose. The operator's own retailer letter opens
 * "we are a starting-up board game publisher", and that is precisely the
 * provisional register the publisher introduction has to stop using.
 */
export const CAMPAIGN_STATE_PHRASES = [
  "coming soon",
  "pre-order",
  "preorder",
  "launching soon",
  "stretch goal",
  "kickstarter exclusive",
  "back this project",
  "back the project",
  "sign up to get the latest",
  "game development news",
  "development milestones",
  "when the game is ready",
  "be the first",
  "campaign is live",
  "in development",
  "we are working on",
  "startup",
  "start-up",
  "starting-up",
] as const;
