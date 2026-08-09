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

import type { Source, SourceId } from "./schema.js";

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
  "task1-commercial-model": {
    id: "task1-commercial-model",
    kind: "commercial-fact",
    summary:
      "The commercial model frozen in Task 1: one price worldwide with tax included, unmanaged stock, packaged size and weight, dispatch and delivery estimates, buyer-borne duties outside the EU.",
    presentation: ["statement", "figure"],
    caution:
      "Commercial terms, not review evidence. These belong on the purchase, shipping and legal surfaces — never in the proof strip, where they would read as third-party validation.",
  },
};

/**
 * Claims that are **not** evidenced and therefore may never appear.
 *
 * The first two are the sharp ones: the plan itself suggests "funded in two
 * hours" and "4,606% of goal" as proof-strip candidates, and neither figure
 * is in the evidence manifest. The manifest's exclusion list is explicit that
 * the funding total, the percentage and any tighter backer count are not
 * publishable. The plan also instructs that every such figure is a candidate
 * pending verification against the manifest — this is that verification, and
 * both figures fail it.
 *
 * `content.test.ts` fails the build if any of these strings appears in a
 * content file.
 */
export const NOT_PUBLISHABLE = [
  "4,606",
  "4606",
  "funded in two hours",
  "two hours",
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
