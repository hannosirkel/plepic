/**
 * Verkaufsbedingungen — the German edition of `../terms.ts`.
 *
 * A translation, not a revision. Everything the English page decided binds
 * this one:
 *
 * - The out-of-court dispute resolution section names the Consumer Disputes
 *   Committee at the Estonian authority, and **there is deliberately no
 *   ODR-platform link**: the platform was dismantled in July 2025. Do not add
 *   one.
 * - The access method is a `Link` to the `consumer-disputes-committee`
 *   external target, resolved from deployment configuration. No address is
 *   written into this file.
 * - The checkout section is written to match the checkout screen.
 *   `storefront/src/components/shop/checkout-terms.ts` reads four of its
 *   paragraphs by their position, so each of them stands on its own.
 *
 * ## The button-label sentence quotes the label the checkout carries today
 *
 * The German checkout button and this page both say „Jetzt bezahlen“.
 *
 * Route, anchors, `covers`, section order, the link target and every
 * placeholder token are identical to the English page; only prose is German.
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
 *
 * The page addresses the reader as „Sie“. „Verbraucher“ is the statutory word
 * and is kept in that form. The two Estonian bodies have no official German
 * names; they are described in German.
 */

import type { LegalPage } from "../../schema.js";

export const terms: LegalPage = {
  route: "legalTerms",
  title: "Verkaufsbedingungen",
  description:
    "Die Bedingungen, denen Sie mit Ihrer Bestellung zustimmen: wie der Vertrag zustande kommt, was Sie an der Kasse bestätigen, die Zahlung, was geschieht, wenn etwas schiefgeht, und wohin Sie sich mit einer Streitigkeit wenden können.",
  indexable: true,
  sections: ["checkout-acknowledgement", "delivery", "dispute-resolution"],
  covers: ["checkout-acknowledgement", "dispute-resolution"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "checkout-acknowledgement",
      heading: "Was Sie an der Kasse bestätigen",
      covers: ["checkout-acknowledgement"],
      body: [
        "Mit Ihrer Bestellung geben Sie ein Kaufangebot ab. Der Vertrag kommt zustande, wenn wir Ihnen eine Versandbestätigung senden – nicht, wenn Sie die Schaltfläche betätigen, und nicht, wenn die Zahlung autorisiert wird.",
        "Die letzte Schaltfläche an der Kasse ist mit „Jetzt bezahlen“ beschriftet – eine der eindeutigen Formulierungen, die die Leitlinien der Europäischen Kommission für eine Schaltfläche anerkennen, mit der eine zahlungspflichtige Bestellung aufgegeben wird. Unmittelbar darüber sehen Sie auf einem Bildschirm: die Ware, den Preis der Ware, die Versandkosten, den Gesamtbetrag, die Lieferadresse und die voraussichtliche Lieferzeit.",
        "Mit dem Aufgeben der Bestellung bestätigen Sie, dass Sie diese Bedingungen und die Datenschutzerklärung gelesen haben und akzeptieren, dass Sie wie auf dieser Website beschrieben kaufen und dass Sie mindestens 18 Jahre alt sind oder mit dem Einverständnis einer Person bestellen, die es ist.",
        "Sie erhalten per E-Mail eine Bestätigung mit der Bestellung, dem gezahlten Gesamtbetrag und diesen Bedingungen. Bewahren Sie sie auf – sie ist Ihre Ausfertigung des Vertrags.",
        "Wir akzeptieren über Stripe Karten, Apple Pay, Google Pay und PayPal, sofern Stripe sie für Ihr Gerät und Ihren Standort bereitstellt. Ihre Kartennummer sehen und speichern wir nie. Schlägt die Zahlung fehl oder wird sie später rückgängig gemacht, wird die Bestellung nicht ausgeführt.",
        "Wir verkaufen an Verbraucher und zu denselben Bedingungen an Unternehmen. Nichts auf dieser Seite schränkt die gesetzlichen Rechte eines Verbrauchers ein.",
      ],
      source: "checkout-contract",
    },
    {
      anchor: "delivery",
      heading: "Verfügbarkeit, Preis und Irrtümer",
      covers: [],
      body: [
        "Wir verkaufen ein einziges Produkt. Können wir es nicht liefern – weil die Auflage vergriffen ist oder das Paket nicht in Ihr Land zugestellt werden kann –, teilen wir Ihnen das mit und erstatten Ihnen den vollen Betrag. Wir sind nicht verpflichtet, Ersatz zu beschaffen.",
        "Es gilt der Preis, der angezeigt wird, wenn Sie die Bestellung aufgeben. Wird ein Preis aufgrund eines offensichtlichen Fehlers falsch angezeigt und hätten Sie vernünftigerweise erkennen können, dass es ein Fehler war, sind wir nicht verpflichtet, zu diesem Preis zu verkaufen; wir teilen Ihnen das mit und stornieren entweder die Bestellung oder bitten Sie, sie zum richtigen Preis zu bestätigen.",
        "Ist bei einer Bestellung etwas schiefgegangen, schreiben Sie zuerst an {merchantContactAddress}. Wir bringen die Sache viel lieber in Ordnung, als dass Sie sich mit einem Kartenaussteller auseinandersetzen müssen.",
        "Diese Bedingungen unterliegen dem Recht des Landes, in dem {merchantLegalName} niedergelassen ist, und nichts darin entzieht Ihnen den Schutz der zwingenden Verbraucherschutzvorschriften des Landes, in dem Sie leben.",
      ],
    },
    {
      anchor: "dispute-resolution",
      heading: "Wenn es sich nicht klären lässt, indem Sie uns schreiben",
      covers: ["dispute-resolution"],
      body: [
        "Können wir die Sache nicht untereinander klären und leben Sie in der Europäischen Union, können Sie die Streitigkeit der Kommission für Verbraucherstreitigkeiten bei der estnischen Behörde für Verbraucherschutz und technische Aufsicht vorlegen. Das Verfahren ist kostenlos. Nichts hiervon beschränkt Ihr Recht, stattdessen vor Gericht zu gehen.",
      ],
      links: [
        {
          label: "So erreichen Sie die Kommission für Verbraucherstreitigkeiten",
          target: { kind: "external", to: "consumer-disputes-committee" },
        },
      ],
    },
  ],
};
