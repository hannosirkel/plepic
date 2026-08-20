/**
 * Proof: the homepage strip, and the quotations the game page carries.
 *
 * The strip is chosen, not accumulated. Two or three items is a type
 * constraint, not a guideline — see {@link ProofStripItems}. The items left out
 * are listed with their reasons in {@link proofStrip.rejected}, because an
 * editorial choice that nobody can see the reasoning for gets re-litigated at
 * every review.
 */

import type { ProofStrip, Quotation } from "./schema.js";

/**
 * Three items, each doing a different job.
 *
 * A visitor arrives with three objections, in this order: is this publisher
 * real, will the components be cheap, and how is this different from the small
 * boxes I already own. The strip answers them in that order and then stops.
 *
 * The Kickstarter figures — funded in two hours, 4,606% of goal — sit in the
 * *detail* of the first item, never in a headline. That is the operator's
 * instruction and it is also the right reading of them: their provenance is
 * thinner than the rest, and a percentage that size invites the reader to
 * suspect the arithmetic rather than the game. What they are genuinely good for
 * is that a visitor can go and look. So the item carries a link to the campaign,
 * and the model refuses to let it not: E14 and E15 are `supportingOnly`, and a
 * source with `checkableAt` obliges the item that cites it to link there.
 */
/**
 * Paul Grogan on the card design — one string, two presentations.
 *
 * It is quoted on the product page as a {@link Quotation} and, since the
 * operator's decision of 2026-08-20, heads the homepage proof strip as well.
 * Those two renderings differ (the strip wraps it in typographic quotation
 * marks; the quotation list does not), which is exactly how the same sentence
 * would end up pasted twice and then drift by a word. It is declared once.
 *
 * "an artwork" is a correction the operator approved on 2026-08-20; the source
 * transcript reads "a artwork". Nothing else about the wording is changed.
 */
export const cardDesignQuote =
  "The look of the cards from an artwork and graphic design point of view – it’s very clear, very functional while also looking pretty. Which is a fine balance to get in games.";

export const proofStrip: ProofStrip = {
  items: [
    {
      source: "E5",
      supporting: ["E14", "E15"],
      headline: "Funded by over 2,000 backers",
      detail:
        "It hit its target in two hours and closed at 4,606% of it. Then the game was printed, boxed and posted, and the backers got their copies.",
      link: {
        label: "See the campaign",
        target: { kind: "external", to: "kickstarter-campaign" },
        accessibleLabel: "See the Lunar Base Kickstarter campaign",
      },
    },
    {
      source: "E3",
      // Concatenated rather than interpolated, on purpose. `content.test.ts`
      // reads these files as text, comments included: a template
      // interpolation looks exactly like a substitution placeholder it must
      // find a declaration for, and its leading sigil is also the
      // currency-symbol guard's needle. Both guards fired on the first
      // revision of this line, and again on the comment that explained why —
      // which is the guards working, not overreaching.
      headline: "“" + cardDesignQuote + "”",
      detail: "Paul Grogan, Gaming Rules!",
    },
    {
      source: "E2",
      headline: "“Easily a filler that could take over the whole night.”",
      detail: "Hairy Game Lords",
    },
  ],
  rejected: [
    {
      source: "E7",
      reason:
        "Around 100 copies each through retail chains in Finland and Estonia. Verified, and it does the same job as the Brætspilscaféen item — third-party retail sell-through — with less of it: the chains cannot be named, so the visitor is asked to take an unnamed number on trust. Two retail figures in a three-item strip reads as padding. It stays on /about, in the timeline, where a run of dates earns it.",
    },
    {
      source: "E1",
      reason:
        "Rodney Smith's top-10 pick at AireCon is the biggest name in the set, and it is the one item a cold visitor cannot check: the video has been removed and cannot be linked, so it stands on our word. A headline figure has to be checkable. It is also the item a designer is most likely to reach for a badge graphic to decorate, which the manifest forbids. It runs as a quotation on the game page, worded as what it is — a pick in a top-10 video.",
    },
    {
      source: "E6",
      reason:
        "Around 50 copies through a Danish board game café, which also hosted a making-of talk and its own tournament. Verified, and it headed this strip until 2026-08-20, when the operator replaced it with E3. Third-party retail sell-through is the strongest *kind* of proof here, but the café cannot be introduced to a cold visitor in a headline — the item spent its detail line explaining who Brætspilscaféen is before the number meant anything. It survives in the publisher story's per-paragraph sourcing.",
    },
    {
      source: "E4",
      reason:
        "The best-written quotation we have, and far too long for a strip. It leads the reviews section on the game page instead, where it has room to land.",
    },
    {
      source: "E9",
      reason:
        "Player count — and with it playing time and setup time, E10 and E11 — is true and useful, but it is our own specification, not third-party validation. In a proof strip beside a review it would borrow credibility it has not earned. It belongs next to the box, in the specification list, which is where it is.",
    },
  ],
};

/**
 * Quotations for the game page, in the order they appear.
 *
 * Every one is verbatim and attributed. E4 leads because it is the one that
 * describes the experience rather than the object. E1 carries its context
 * inline, so the claim a visitor reads is the claim we can support.
 */
export const quotations: readonly Quotation[] = [
  {
    source: "E4",
    attribution: "Tabletop Games Blog",
    text: "Lunar Base is a really lovely little game. It gives you enough to do and think about, without being too taxing and it plays so quickly that it certainly doesn't outstay its welcome. It's one of the few games I own that plays up to 6 players as well, so it's great for when you have a get together with friends or family, while not being a party game.",
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "This game has a lot of depth to it, the box is tiny! It's very portable but there's so much bang for your buck here.",
  },
  {
    source: "E1",
    attribution: "Rodney Smith, Watch It Played",
    text: "This thing really blew my mind…it's all in this tiny little box. And the artwork is great! I was just really impressed.",
    context: "One of his top ten picks at AireCon.",
  },
  {
    source: "E3",
    attribution: "Paul Grogan, Gaming Rules!",
    text: cardDesignQuote,
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "The replayability is great. It's so well produced for such a small game. A joy to play!",
  },
];
