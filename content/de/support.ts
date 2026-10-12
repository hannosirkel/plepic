/**
 * Support copy — the German edition of `../support.ts`: rules help, the
 * rulebook, and contact.
 *
 * This file is a translation, not a revision. Exports, anchors, source ids,
 * link targets and placeholders are those of the English module; only prose is
 * German.
 *
 * Published under `/de` through `siteCopyByLocale`. The mirror and content
 * scans continue to check this file.
 *
 * The reader is addressed as „du“. Game terms are the ones in
 * `content/glossary/de.ts`, because the rules answers are read beside the
 * rulebook: „Spielanleitung“, „Siegbedingung“, „Nachziehstapel“,
 * „Ablagestapel“, „Hauptaktion“. A term whose card label differs from the
 * German word carries that label in brackets where this module first uses it,
 * as `docs/working/site-translation/de.md` sets.
 */

import type { FaqEntry, Link, Section } from "../schema.js";

export const supportIntro: Section = {
  anchor: "rules-faq",
  heading: "Regeln und Hilfe",
  body: [
    "Die vollständige Spielanleitung steht auf dieser Website, ebenso die Fragen, die am Spieltisch am häufigsten aufkommen. Steht die Antwort nicht hier, schreib uns – sechs Menschen lesen dieses Postfach, und einer von ihnen hat die Karte entworfen, über die ihr gerade streitet.",
  ],
};

/**
 * For a reader who followed the address printed in the rulebook, which the
 * old game domain redirects here.
 */
export const printedRulebookNote: Section = {
  anchor: "rules-faq",
  heading: "Falls du über die in der Spielanleitung abgedruckte Adresse gekommen bist",
  body: [
    "Du bist hier richtig. Die alte Website des Spiels leitet dich jetzt hierher, und auf dieser Seite findest du die aktuellen Regeln, die FAQ und die Varianten.",
  ],
  source: "rulebook",
};

export const rulebookLink: Link = {
  label: "Spielanleitung lesen",
  target: { kind: "route", to: "rulebook" },
  accessibleLabel: "Die Spielanleitung zu Lunar Base lesen",
};

/**
 * Rules FAQ. Every answer is the rulebook's answer, not a house ruling.
 */
export const rulesFaq: readonly FaqEntry[] = [
  {
    question: "Zwei Personen erfüllen im selben Zug eine Siegbedingung. Wer gewinnt?",
    answer: [
      "Wer die meisten Bedingungen erfüllt hat. Haben beide gleich viele erfüllt, teilen sie sich den Sieg.",
    ],
    source: "rulebook",
  },
  {
    question: "Sollten wir die Einflusskarten (Influence) schon in unserer ersten Partie verwenden?",
    answer: [
      "Nein. Die Spielanleitung empfiehlt, sie wegzulassen, bis alle am Tisch sicher im Spiel sind, und sie dann vor dem Austeilen in den Nachziehstapel zu mischen. Sie bringen einen vierten Weg zum Sieg ins Spiel und verändern, wie sich die anderen drei anfühlen.",
    ],
    source: "rulebook",
  },
  {
    question: "Bedeuten fünf wissenschaftliche Errungenschaften fünf Karten?",
    answer: [
      "Gemeint sind fünf verschiedene Errungenschaften. Zwei gleiche Errungenschaften zählen nur einmal – das ist der Fehler, der manche die Partie kostet.",
    ],
    source: "rulebook",
  },
  {
    question: "Der Nachziehstapel ist aufgebraucht. Und jetzt?",
    answer: [
      "Mische den Ablagestapel zu einem neuen Nachziehstapel und zieh weiter.",
    ],
    source: "rulebook",
  },
  {
    question: "Wie viele Karten darf ich auf der Hand haben?",
    answer: ["So viele du möchtest. Es gibt kein Handkartenlimit."],
    source: "rulebook",
  },
  {
    question: "Wer beginnt?",
    answer: [
      "Wer in den letzten 30 Tagen die längste Reise gemacht hat. In späteren Partien beginnt die Person links von der Siegerin oder dem Sieger.",
    ],
    source: "rulebook",
  },
  {
    question: "Darf ich in meinem Zug mehr als eine Hauptaktion (Main Action) ausführen?",
    answer: [
      "Nein – eine Hauptaktion pro Zug, gewählt aus denen, die in deiner Basis (Base) verfügbar sind. Davor darfst du beliebig viele Agentenkarten spielen, sofern du sie bezahlen kannst.",
    ],
    source: "rulebook",
  },
];

export const contact: Section = {
  anchor: "contact",
  heading: "Schreib uns",
  body: [
    "Regelfragen, eine fehlende Karte, ein Laden, der das Spiel führen möchte, oder eine Bestellung, um die es still geworden ist – alles landet an derselben Stelle. Wir antworten innerhalb von ein, zwei Tagen.",
    "Du erreichst uns auch unter {merchantContactAddress}.",
  ],
};

export const contactForm = {
  nameLabel: "Dein Name",
  emailLabel: "Deine E-Mail-Adresse",
  subjectLabel: "Worum geht es?",
  messageLabel: "Nachricht",
  submitLabel: "Senden",
  successMessage: "Danke – das ist bei uns angekommen.",
  errorMessage:
    "Das Senden hat nicht geklappt. Bitte versuche es noch einmal oder schreib uns direkt an {merchantContactAddress}.",
  /**
   * Shown when a submission cannot be acted on. Distinct from `errorMessage`,
   * as in English: it invites no retry, and points at the address above.
   */
  notSentMessage:
    "Es wurde nichts gesendet. Dieses Formular erreicht unser Postfach nicht, deine Nachricht wurde also weder zugestellt noch gespeichert. Bitte schreib uns stattdessen eine E-Mail – die Adresse steht direkt darüber.",
} as const;
