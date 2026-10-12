/**
 * Rücksendungen und Widerrufsrecht — the German edition of `../returns.ts`.
 *
 * A translation, not a revision. Everything the English page decided binds
 * this one:
 *
 * - **The withdrawal period is 14 days**, the statutory one. The operator
 *   decided on 2026-08-09 to leave it there; it must not be "corrected".
 * - The model withdrawal form is *provided*, not referred to. Its German
 *   wording follows the German text of Annex I(B) of the Consumer Rights
 *   Directive, cut to the same five lines the English page carries.
 * - Return-transit loss sits with the trader once the consumer shows proof of
 *   postage, and the legal guarantee of conformity is stated positively,
 *   two-month notification included.
 *
 * Two words are kept apart on purpose. „Widerruf“ is the glossary's term for
 * the right of withdrawal and is used for nothing else on this page; the
 * buyer's right to cancel after a missed delivery deadline, on the shipping
 * page, is „Rücktritt“.
 *
 * Route, anchors, `covers`, sources, section order and every placeholder token
 * are identical to the English page; only prose is German.
 *
 * Published in the German legal set. The mirror and content scans continue to
 * check this file.
 *
 * `reviewStatus` is `operator-approved`: the operator approved every
 * translation of the site-translation job in advance on 2026-10-10, legal
 * pages included. The field records that advance approval. No separate reading
 * of this German wording is recorded here, and the approval is not a standing
 * one for whatever this page may later say: a change to its substance needs
 * its own reading.
 */

import type { LegalPage } from "../../schema.js";

export const returns: LegalPage = {
  route: "legalReturns",
  title: "Rücksendungen und Widerrufsrecht",
  description:
    "Ihr 14-tägiges Recht, die Bestellung zu widerrufen, wie Sie es ausüben, das Muster-Widerrufsformular, wer die Kosten der Rücksendung trägt, wohin Sie das Paket senden und wie die Erstattung abläuft.",
  indexable: true,
  sections: ["withdrawal", "withdrawal-form", "returns-process", "legal-guarantee"],
  covers: [
    "withdrawal-process",
    "withdrawal-deadline",
    "model-withdrawal-form",
    "return-postage-liability",
    "return-address",
    "legal-guarantee-of-conformity",
  ],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "withdrawal",
      heading: "Sie haben 14 Tage Zeit, es sich anders zu überlegen",
      covers: ["withdrawal-process", "withdrawal-deadline"],
      body: [
        "Wenn Sie als Verbraucher kaufen, können Sie den Vertrag ohne Angabe von Gründen widerrufen.",
        "Die Widerrufsfrist beträgt 14 Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Ware physisch in Besitz nehmen.",
        "Um zu widerrufen, teilen Sie uns das vor Ablauf der 14 Tage mit. Schreiben Sie eine E-Mail an {merchantContactAddress} mit Ihrer Bestellnummer und einem Satz, dass Sie widerrufen – das genügt. Wenn Sie möchten, können Sie das untenstehende Muster-Widerrufsformular verwenden, Sie sind dazu aber nicht verpflichtet. Es geht auch, das Paket einfach zurückzusenden, ohne uns etwas mitzuteilen; eine Nachricht ist aber schneller, und wir können dann auf die Rücksendung achten.",
        "Die gesetzlichen 14 Tage für die Erstattung laufen ab dem Tag, an dem Sie uns den Widerruf mitteilen; ist das Paket Ihre einzige Mitteilung, beginnt die Erstattungsfrist, sobald es oder Ihr Einlieferungsbeleg bei uns eingeht.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "withdrawal-form",
      heading: "Muster-Widerrufsformular",
      covers: ["model-withdrawal-form"],
      body: [
        "Muster-Widerrufsformular (verwenden Sie es nur, wenn Sie möchten):",
        "An {merchantLegalName}, {merchantRegisteredAddress}, {merchantContactAddress}: Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren: …",
        "Bestellt am / erhalten am: …",
        "Name und Anschrift des/der Verbraucher(s): …",
        "Unterschrift (nur bei Mitteilung auf Papier), Datum.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "returns-process",
      heading: "Die Ware zurücksenden und Ihr Geld zurückerhalten",
      covers: ["return-postage-liability", "return-address"],
      body: [
        "Senden Sie die Ware innerhalb von 14 Tagen zurück, nachdem Sie uns Ihren Widerruf mitgeteilt haben. Die Rücksendeadresse lautet {returnAddress}.",
        "Die Kosten der Rücksendung des Pakets tragen Sie. Bitte nutzen Sie einen Versand mit Sendungsverfolgung und bewahren Sie Ihren Einlieferungsbeleg auf – sobald Sie ihn uns vorlegen, ist Ihre Erstattung fällig, auch wenn das Paket noch unterwegs ist – und wählen Sie den günstigsten Versand, der eine Sendungsverfolgung bietet; mehr verlangen wir nicht.",
        "Wir erstatten, was Sie für die Ware gezahlt haben, zuzüglich der Kosten des Standardversands zu Ihnen, innerhalb von 14 Tagen, nachdem uns Ihr Widerruf mitgeteilt wurde. Haben Sie eine schnellere oder teurere Versandart als unseren Standardversand gewählt, erstatten wir die Standardkosten und nicht den Aufpreis. Wir können die Erstattung zurückhalten, bis die Ware bei uns eingeht oder bis Sie uns den Einlieferungsbeleg vorlegen, je nachdem, was zuerst geschieht.",
        "Die Erstattung erfolgt über dasselbe Zahlungsmittel, mit dem Sie gezahlt haben, und kostet Sie nichts.",
        "Sie dürfen das Spiel auspacken und es sich ansehen – das würden Sie in einem Geschäft auch tun. Kommt das Spielmaterial beschädigt oder unvollständig zurück, weil Sie damit in einer Weise umgegangen sind, die über die Prüfung dessen hinausgeht, was das Spiel ist, können wir die Erstattung um den Wertverlust kürzen.",
        "Nichts davon berührt Ihre gesonderten gesetzlichen Rechte, wenn die Ware mangelhaft, beschädigt oder nicht wie beschrieben ankommt. Fehlt eine Karte oder ist die Schachtel eingedrückt angekommen, schreiben Sie an {merchantContactAddress}, und wir bringen das in Ordnung; nutzen Sie dafür nicht das Widerrufsverfahren.",
      ],
      source: "return-postage",
    },
    {
      anchor: "legal-guarantee",
      heading: "Ihre gesetzliche Gewährleistung, die von alledem unabhängig ist",
      covers: ["legal-guarantee-of-conformity"],
      body: [
        "Unabhängig vom 14-tägigen Recht, es sich anders zu überlegen, gibt Ihnen das EU-Recht eine gesetzliche Gewährleistung für die Vertragsmäßigkeit der Ware: Zwei Jahre ab Lieferung haften wir für jeden Mangel, der bei Lieferung der Ware bestand, und im ersten Jahr wird vermutet, dass ein Mangel von Anfang an vorhanden war, sofern wir nicht das Gegenteil nachweisen. Wenn etwas nicht stimmt, teilen Sie uns das innerhalb von zwei Monaten mit, nachdem Sie es bemerkt haben, und wir reparieren die Ware, ersetzen sie, mindern den Preis oder erstatten ihn, ohne dass Ihnen Kosten entstehen.",
      ],
    },
  ],
};
