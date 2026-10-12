/**
 * Publisher copy — the German edition of `../publisher.ts`.
 *
 * This file is a translation, not a revision. Exports, anchors, source ids,
 * link targets and placeholders are those of the English module; only prose is
 * German. The editorial reasoning behind each statement is recorded there and
 * is not repeated here: anything believed wrong in the English is a finding
 * against the English, never a thing to fix here first.
 *
 * **Staged, not published.** The `de` entry of `siteCopyByLocale` is still
 * `null`, so no visitor can reach this copy; registering it is a later task
 * of the same plan. Until then `content/mirror.test.ts` and the scans of
 * `content/content.test.ts` read this file from disk.
 *
 * The reader is addressed as „du“, as `docs/working/site-translation/de.md`
 * sets for marketing copy. The register is the English one: deliberately small
 * and independent, not provisional, and nothing here asks a visitor to buy so
 * that more games can exist.
 */

import type {
  CallToAction,
  Prose,
  Section,
  Statement,
} from "../schema.js";

/** The homepage hero sentence. Past tense, no request to buy. */
export const publisherSentence: Statement = {
  text: "Plepic Games ist eine Gruppe von Brettspielbegeisterten, die Lunar Base geschaffen hat – ein über Kickstarter finanziertes Kartenspiel, an dem mehr als drei Jahre lang und über Kontinente hinweg gefeilt wurde.",
  source: "E8",
};

/** The short form, for the footer, the About lede and social metadata. */
export const publisherShort: Statement = {
  text: "Ein kleiner, unabhängiger Brettspielverlag bei Tallinn. Sechs Menschen, ein Spiel, drei Jahre Arbeit.",
  source: "E8",
};

/**
 * The publisher story: one paragraph, the operator's own text in translation.
 *
 * `origin-story` is an external target, not a URL, exactly as in English.
 */
export const publisherStory: Section = {
  anchor: "story",
  heading: "Sechs Menschen, ein Spiel, drei Jahre",
  body: [
    "Lunar Base begann 2017, als sich sechs Freunde in Estland eine einfache Aufgabe stellten: ein Kartenspiel zum Mitnehmen zu entwickeln, das sie wirklich gern zusammen spielen würden. Was als grober, selbst gebastelter Prototyp begann, wuchs über Jahre des Experimentierens, Testspielens und Ausbalancierens, der Illustration und des Weltenbaus zu einem schnellen, kompakten Strategiespiel über den Wettlauf der Menschheit um die Besiedlung des Mondes heran. Auf dem Weg dorthin wuchs das Team, Ideen wurden ausprobiert und verworfen, und unzählige kleine Verbesserungen gaben dem Spiel seine endgültige Form – bis hin zu einer erfolgreichen Kickstarter-Kampagne, die aus einem Projekt unter Freunden ein veröffentlichtes Brettspiel machte, das auf der ganzen Welt gespielt wird.",
  ],
  source: "E8",
  links: [
    {
      label: "Entstehungsgeschichte",
      target: { kind: "external", to: "origin-story" },
      accessibleLabel: "Die Entstehungsgeschichte von Lunar Base lesen",
    },
  ],
};

/**
 * Per-paragraph sourcing for the story above. An editorial record, rendered
 * nowhere; it is translated so the German edition carries the same record.
 */
export const publisherStorySources: readonly Statement[] = [
  { text: "2017, sechs Menschen, bei Tallinn.", source: "E8" },
  { text: "Drei Jahre Iteration; der Umfang wurde reduziert, bis das Spiel Spaß machte.", source: "E8" },
  { text: "Auf Kickstarter von über zweitausend Unterstützerinnen und Unterstützern finanziert, dann ausgeliefert.", source: "E5" },
  {
    text: "Rund fünfzig Exemplare in einem dänischen Brettspielcafé verkauft, das einen Making-of-Vortrag und ein Turnier ausrichtete.",
    source: "E6",
  },
  { text: "Noch immer sechs Menschen.", source: "E8" },
];

/**
 * The team section. As in English, names and roles are not written here. The
 * asterisks mark emphasis and are kept around the same word.
 */
export const team: Section = {
  anchor: "team",
  heading: "Die Sechs",
  body: ["*Endlich* den Duft von frischem Druck genießen"],
  source: "E8",
};

/** The newsletter proposition: a modest promise, single opt-in. */
export const newsletter = {
  heading: "Selten Post von uns",
  body: [
    "Wir schreiben eine E-Mail, wenn es wirklich etwas gibt, das eine E-Mail wert ist: ein neues Spiel, eine Neuauflage oder eine Partie Lunar Base auf dem Mond.",
    "Ein Klick genügt zum Abmelden, und deine Adresse geht an niemanden sonst.",
  ] satisfies Prose,
  fieldLabel: "E-Mail-Adresse",
  submitLabel: "Abonnieren",
  consentNote:
    "Mit dem Abonnieren erklärst du dich einverstanden, gelegentlich E-Mails von uns zu erhalten. Du kannst dich in jeder Nachricht wieder abmelden.",
  successMessage: "Du bist angemeldet. Wir schreiben nur, wenn es etwas gibt, das sich zu schicken lohnt.",
  errorMessage: "Die Anmeldung hat nicht geklappt. Bitte prüfe das Formular und versuche es noch einmal.",
  postPurchaseHeading: "Nach deiner Bestellung von uns hören",
  postPurchaseBody:
    "Diese Entscheidung ändert nichts an deiner Bestellung. Abonniere nur, wenn du gelegentlich Neuigkeiten von Plepic Games erhalten möchtest.",
  postPurchaseConsentLabel: "Ja, diese E-Mail-Adresse für gelegentliche Neuigkeiten anmelden.",
} as const;

/** Homepage hero calls to action, in order of intended emphasis. */
export const homepageCallsToAction: readonly CallToAction[] = [
  {
    label: "Lunar Base entdecken",
    emphasis: "primary",
    target: { kind: "route", to: "lunarBase" },
  },
  {
    label: "Für {price} kaufen",
    emphasis: "secondary",
    target: { kind: "route", to: "lunarBase", anchor: "buy" },
    accessibleLabel: "Lunar Base für {price} kaufen",
  },
];
