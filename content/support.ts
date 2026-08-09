/**
 * Support copy: rules help, the rulebook, the component list, and contact.
 *
 * The rulebook is a route on this site, not a link to a file-sharing service.
 * That is a completion criterion of the plan and the reason the rulebook has no
 * entry in `EXTERNAL_TARGETS`: there is nowhere to point it but here.
 */

import type { FaqEntry, Link, Section } from "./schema.js";

export const supportIntro: Section = {
  anchor: "rules-faq",
  heading: "Rules and help",
  body: [
    "The full rulebook is on this site, and so are the questions that come up most often at a table. If the answer is not here, write to us — six people read that inbox and one of them designed the card you are arguing about.",
  ],
};

/**
 * The printed rulebook points readers at the old game domain for the latest
 * rules and FAQ. Copies of that box are in people's houses and the text cannot
 * be recalled, so the redirect from that hostname has to land somewhere useful
 * forever. It resolves here.
 */
export const printedRulebookNote: Section = {
  anchor: "rules-faq",
  heading: "If you came from the address printed in the rulebook",
  body: [
    "You are in the right place. The old game site now sends you here, and this page is where the current rules, the FAQ and the variants live.",
  ],
  source: "rulebook",
};

export const rulebookLink: Link = {
  label: "Read the rulebook",
  target: { kind: "route", to: "rulebook" },
  accessibleLabel: "Read the Lunar Base rulebook",
};

/**
 * Rules FAQ. Every answer is the rulebook's answer, not a house ruling.
 */
export const rulesFaq: readonly FaqEntry[] = [
  {
    question: "Two people meet a victory condition on the same turn. Who wins?",
    answer: [
      "Whoever met the most conditions. If they met the same number, the victory is shared.",
    ],
    source: "rulebook",
  },
  {
    question: "Should we use the Influence cards in our first game?",
    answer: [
      "No. The rulebook recommends leaving them out until the table is comfortable, then shuffling them into the deck before dealing. They add a fourth way to win and they change how the other three feel.",
    ],
    source: "rulebook",
  },
  {
    question: "Does five scientific achievements mean five cards?",
    answer: [
      "It means five different achievements. Two of the same achievement count once, which is the mistake that costs people the game.",
    ],
    source: "rulebook",
  },
  {
    question: "The deck ran out. Now what?",
    answer: [
      "Shuffle the discard pile to form a new deck and carry on drawing.",
    ],
    source: "rulebook",
  },
  {
    question: "How many cards can I hold?",
    answer: ["As many as you like. There is no hand limit."],
    source: "rulebook",
  },
  {
    question: "Who goes first?",
    answer: [
      "Whoever took the longest trip in the last 30 days. In later games it is the player to the left of the winner.",
    ],
    source: "rulebook",
  },
  {
    question: "Can I play more than one main action on my turn?",
    answer: [
      "No — one main action per turn, chosen from those available in your base. You may play any number of agent cards before it, if you can pay for them.",
    ],
    source: "rulebook",
  },
];

export const contact: Section = {
  anchor: "contact",
  heading: "Write to us",
  body: [
    "Rules questions, a missing card, a shop that wants to stock it, or an order that has gone quiet — all of it comes to the same place. We answer in a day or two.",
    "You can also reach us at {merchantContactAddress}.",
  ],
};

export const contactForm = {
  nameLabel: "Your name",
  emailLabel: "Your email address",
  subjectLabel: "What is this about?",
  messageLabel: "Message",
  submitLabel: "Send",
  successMessage: "Thanks — that has reached us. We answer in a day or two.",
  errorMessage:
    "That did not send. Please try again, or email us directly at {merchantContactAddress}.",
} as const;
