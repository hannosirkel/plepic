/**
 * Proof — the German edition of `../proof.ts`: the homepage strip, and the
 * quotations the game page carries.
 *
 * This file is a translation, not a revision. The choice of items, their
 * order, their source ids and the link target are the English module's, and
 * the reasoning for each is recorded there. Nothing is added that the English
 * edition does not say.
 *
 * Published under `/de` through `siteCopyByLocale`. The mirror and content
 * scans continue to check this file.
 *
 * The reviewers spoke and wrote in English. Each quotation here is a
 * translation of the attributed passage, keyed to the same source id;
 * attributions are names and stay as they are. Quotation marks are the German
 * ones, as `docs/working/site-translation/de.md` sets.
 */

import type { ProofStrip, Quotation } from "../schema.js";

/**
 * Paul Grogan on the card design — one string, two presentations, as in
 * English: it heads the proof strip and it is quoted on the product page.
 */
export const cardDesignQuote =
  "Das Aussehen der Karten, was Illustration und Grafikdesign angeht – es ist sehr klar, sehr funktional und sieht dabei auch noch hübsch aus. Das ist eine feine Balance, die man in Spielen hinbekommen muss.";

/**
 * Three items, in the English order. The Kickstarter figures stay in the
 * detail of the first item and never in a headline.
 */
export const proofStrip: ProofStrip = {
  items: [
    {
      source: "E5",
      supporting: ["E14", "E15"],
      headline: "Von über 2.000 Unterstützerinnen und Unterstützern finanziert",
      detail:
        "Das Ziel war nach zwei Stunden erreicht, am Ende standen 4.606 % davon. Dann wurde das Spiel gedruckt, verpackt und verschickt, und die Unterstützerinnen und Unterstützer bekamen ihre Exemplare.",
      link: {
        label: "Kampagne ansehen",
        target: { kind: "external", to: "kickstarter-campaign" },
        accessibleLabel: "Die Kickstarter-Kampagne von Lunar Base ansehen",
      },
    },
    {
      source: "E3",
      // Concatenated rather than interpolated, for the reason the English
      // module gives: the content scans read this file as text.
      headline: "„" + cardDesignQuote + "“",
      detail: "Paul Grogan, Gaming Rules!",
    },
    {
      source: "E2",
      headline: "„Locker ein Lückenfüller, der den ganzen Abend für sich einnehmen könnte.“",
      detail: "Hairy Game Lords",
    },
  ],
  // An editorial record, rendered nowhere. It is translated so the German
  // edition carries the same reasons; the dates keep their written form.
  rejected: [
    {
      source: "E7",
      reason:
        "Je rund 100 Exemplare über Handelsketten in Finnland und Estland. Belegt, aber die Ketten dürfen nicht genannt werden, sodass die Besucherin oder der Besucher eine Zahl ohne Namen auf Treu und Glauben hinnehmen müsste – schwächer als der Eintrag zum Brætspilscaféen, der dieselbe Aufgabe erfüllt. Früher hielt er sich auf /about, in der Zeitleiste, wo eine Reihe von Daten ihn rechtfertigte; der Betreiber hat diese Seite am 2026-08-20 stillgelegt und die Zeitleiste gestrichen, sodass E7 jetzt nirgends auf der Website erscheint. Der Eintrag bleibt im Manifest, statt gelöscht zu werden, weil die Zahl belegt ist und ein späterer Abschnitt sie rechtfertigen könnte; heute stellt ihn aber nichts dar, und niemand sollte aus dieser Liste etwas anderes schließen.",
    },
    {
      source: "E1",
      reason:
        "Rodney Smiths Top-10-Empfehlung auf der AireCon ist der größte Name der Sammlung, und zugleich der eine Eintrag, den jemand ohne Vorwissen nicht nachprüfen kann: Das Video wurde entfernt und lässt sich nicht verlinken, er stützt sich also allein auf unser Wort. Eine Zahl in einer Überschrift muss nachprüfbar sein. Es ist auch der Eintrag, zu dessen Verzierung ein Designer am ehesten nach einer Plakette greift, und das verbietet das Manifest. Er läuft als Zitat auf der Spielseite, benannt als das, was er ist – eine Empfehlung in einem Top-10-Video.",
    },
    {
      source: "E6",
      reason:
        "Rund 50 Exemplare über ein dänisches Brettspielcafé, das außerdem einen Making-of-Vortrag und ein eigenes Turnier ausrichtete. Belegt, und bis zum 2026-08-20 stand der Eintrag an der Spitze dieser Leiste; dann ersetzte ihn der Betreiber durch E3. Der Abverkauf im Handel durch Dritte ist hier die stärkste *Art* von Beleg, aber das Café lässt sich jemandem ohne Vorwissen nicht in einer Überschrift vorstellen – der Eintrag verbrauchte seine Detailzeile damit, zu erklären, wer Brætspilscaféen ist, bevor die Zahl etwas bedeutete. Er lebt in den absatzweisen Quellenangaben der Verlagsgeschichte weiter.",
    },
    {
      source: "E4",
      reason:
        "Das am besten geschriebene Zitat, das wir haben, und viel zu lang für eine Leiste. Es eröffnet stattdessen den Abschnitt mit den Rezensionen auf der Spielseite, wo es Platz hat, zu wirken.",
    },
    {
      source: "E9",
      reason:
        "Die Spielerzahl – und mit ihr Spieldauer und Aufbauzeit, E10 und E11 – ist wahr und nützlich, aber sie ist unsere eigene Angabe, keine Bestätigung durch Dritte. In einer Belegleiste neben einer Rezension würde sie sich eine Glaubwürdigkeit leihen, die sie nicht verdient hat. Sie gehört neben die Schachtel, in die Liste der Spielangaben, und dort steht sie.",
    },
  ],
};

/**
 * Quotations for the game page, in the English order. Every one is
 * attributed, and E1 carries its context inline.
 */
export const quotations: readonly Quotation[] = [
  {
    source: "E4",
    attribution: "Tabletop Games Blog",
    text: "Lunar Base ist ein wirklich schönes kleines Spiel. Es gibt dir genug zu tun und zu überlegen, ohne zu anstrengend zu sein, und es spielt sich so schnell, dass es einem bestimmt nicht zu lang wird. Außerdem ist es eines der wenigen Spiele, die ich besitze, die sich mit bis zu 6 Personen spielen lassen – ideal also für ein Treffen mit Freunden oder Familie, ohne ein Partyspiel zu sein.",
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "Dieses Spiel hat richtig viel Tiefe, und die Schachtel ist winzig! Es lässt sich bestens mitnehmen, und trotzdem bekommt man hier enorm viel für sein Geld.",
  },
  {
    source: "E1",
    attribution: "Rodney Smith, Watch It Played",
    text: "Das Ding hat mich wirklich umgehauen … das alles steckt in dieser winzig kleinen Schachtel. Und die Illustrationen sind großartig! Ich war einfach richtig beeindruckt.",
    context: "Eine seiner Top-Ten-Empfehlungen auf der AireCon.",
  },
  {
    source: "E3",
    attribution: "Paul Grogan, Gaming Rules!",
    text: cardDesignQuote,
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "Der Wiederspielwert ist großartig. Für ein so kleines Spiel ist es so gut produziert. Eine Freude, es zu spielen!",
  },
];
