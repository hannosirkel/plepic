/**
 * Versand und Lieferung — the German edition of `../shipping.ts`.
 *
 * A translation, not a revision. Everything the English page decided binds
 * this one:
 *
 * - Every estimate is the commercial model the English page records. The
 *   figure itself is never written here; it resolves from the catalogue, which
 *   is why the callout's `lead` is the two placeholders and no German phrase.
 * - **The advertised figure is net.** Estonian VAT is added for a delivery
 *   address in the European Union and added nowhere else, and the VAT section
 *   says so in both directions.
 * - The parcel machine method is free and is offered for a delivery address
 *   in Estonia, Latvia or Lithuania; the three countries are named one by one,
 *   as in the English.
 * - The last paragraph but one of the VAT section is load-bearing: the
 *   destination set on the site decides which price is *shown* and never what
 *   is *charged*.
 *
 * ## Words chosen here that later German copy has to agree with
 *
 * - **„Standardversand“ and „Omniva-Paketautomat“** name the two delivery
 *   methods. The glossary fixes „Paketautomat“. When the German interface copy
 *   gives the methods their checkout names, those names and these agree, or
 *   this page changes with them.
 * - **„Lieferziel“** is the destination the price is quoted for; the privacy
 *   page's cookie row uses the same word.
 * - **„Arbeitstage“, not „Werktage“**, for business days. A „Werktag“ counts
 *   Saturday in German law, which would promise a shorter time than the
 *   English page does.
 * - **„Mehrwertsteuer“** is the word a consumer reads on a price. The imprint
 *   keeps „Umsatzsteuer-Identifikationsnummer“, the fixed name of that number.
 * - **„Rücktritt“** for cancelling after a missed further deadline, kept apart
 *   from „Widerruf“ on the returns page.
 *
 * Route, anchors, `covers`, sources, section order, the callout's shape and
 * every placeholder token are identical to the English page; only prose is
 * German.
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

export const shipping: LegalPage = {
  route: "legalShipping",
  title: "Versand und Lieferung",
  description:
    "Wohin wir versenden, wie lange es bis zum Versand und bis zur Lieferung dauert, wie die Versandkosten berechnet werden und wie die Steuer zu dem Preis hinzukommt, den Sie sehen.",
  indexable: true,
  sections: ["delivery", "vat"],
  covers: ["delivery-terms", "dispatch-estimate", "vat-presentation"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "delivery",
      heading: "Wohin wir versenden und wie lange es dauert",
      covers: ["delivery-terms", "dispatch-estimate"],
      body: [
        "Wir versenden in jedes Land.",
        "Der Standardversand steht für jede Adresse zur Verfügung, an die wir versenden: zu einem Pauschalpreis für eine Lieferadresse in einem EU-Mitgliedstaat und zu einem höheren Pauschalpreis für eine Lieferadresse an jedem anderen Ort, jeweils an der Kasse berechnet. Liegt Ihre Lieferadresse in Estland, Lettland oder Litauen, können Sie stattdessen einen Omniva-Paketautomaten wählen, und diese Versandart ist kostenlos.",
        "Bestellungen werden innerhalb von 3 Arbeitstagen nach Zahlungseingang versandt. Nach dem Versand dauert die Lieferung innerhalb der Europäischen Union in der Regel 3 bis 7 Arbeitstage und die Lieferung in den Rest der Welt in der Regel 7 bis 21 Arbeitstage.",
        "Das sind Schätzungen des Versanddienstleisters, keine Garantien. Zollkontrollen, Streiks und die zwei Wochen vor Weihnachten verschieben sie alle. Ist ein Paket erheblich überfällig, schreiben Sie uns an {merchantContactAddress}, und wir gehen der Sache nach.",
        "Kommt ein Paket einfach nie an, können Sie uns eine weitere angemessene Frist setzen und, wenn wir auch diese versäumen, gegen volle Erstattung vom Vertrag zurücktreten.",
        "Die Versandkosten fallen pro Bestellung an und werden an der Kasse berechnet, sobald Sie eine Lieferadresse eingegeben haben. Sie sehen den genauen Betrag, bevor Sie zahlen; es gibt keinen Schritt nach der Zahlung, bei dem sich die Kosten ändern.",
        "Für Bestellungen, die in Länder außerhalb der Europäischen Union versandt werden, können bei der Ankunft Einfuhrzölle, Steuern und Bearbeitungsgebühren des Versanddienstleisters anfallen. Diese werden vom Bestimmungsland erhoben, sind vom Empfänger zu zahlen und werden nicht von uns eingezogen. Wir berechnen sie nicht und können sie nicht für Sie schätzen.",
      ],
      source: "delivery-estimates",
    },
    {
      anchor: "vat",
      heading: "Wie der Preis angegeben wird",
      covers: ["vat-presentation"],
      callout: {
        lead: "{price} · {priceTaxQualifier}",
        detail:
          "Der Versand wird an der Kasse berechnet, und bei Lieferung innerhalb der Europäischen Union kommt darauf Mehrwertsteuer hinzu. Steuern und Zölle von Ländern außerhalb der EU, falls welche anfallen, sind nicht enthalten.",
      },
      body: [
        "Der Preis des Spiels vor Steuern beträgt {priceNet}. Dieser Betrag ist derselbe, wo auch immer Sie sich befinden; was sich ändert, ist die Steuer, die hinzukommt.",
        "Bei Lieferung an eine Adresse in der Europäischen Union schlagen wir estnische Mehrwertsteuer in Höhe von {vatRate} auf. Der Preis der Ware beträgt dann {priceGross} – {priceNet} zuzüglich {priceVat} Mehrwertsteuer – und das ist der Betrag, den Sie zahlen.",
        "Bei Lieferung an jeden anderen Ort fällt keine EU-Mehrwertsteuer an, und es wird keine aufgeschlagen. Der Preis der Ware beträgt {priceNet}, und das ist der Betrag, den Sie zahlen.",
        "Der Versand wird auf dieselbe Weise berechnet. Der Tarif wird vor Steuern angegeben; bei Lieferung innerhalb der Europäischen Union kommt estnische Mehrwertsteuer in Höhe von {vatRate} hinzu, bei Lieferung an jeden anderen Ort nicht. Sie sehen den genauen Betrag, einschließlich einer etwa darin enthaltenen Steuer, bevor Sie zahlen.",
        "Was davon für Sie gilt, ergibt sich aus der Lieferadresse, die Sie an der Kasse bestätigen. Bevor Sie eine eingegeben haben, richtet sich der angezeigte Betrag nach dem auf dieser Website eingestellten Lieferziel, das Sie ändern können; es entscheidet nie darüber, was Ihnen berechnet wird.",
        "Gewerbliche Käufer: Der angezeigte Preis ist ein Verbraucherpreis. Wo estnische Mehrwertsteuer hinzukommt, wird ihr Betrag an der Kasse gesondert ausgewiesen, bevor Sie zahlen. Wenn Sie für Ihre eigene Buchhaltung eine Rechnung benötigen, in der die steuerliche Behandlung angegeben ist, schreiben Sie uns vor der Bestellung an {merchantContactAddress}.",
      ],
      source: "price-presentation",
    },
  ],
};
