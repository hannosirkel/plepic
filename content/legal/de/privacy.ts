/**
 * Datenschutz — the German edition of `../privacy.ts`.
 *
 * A translation, not a revision. Everything the second qualified read and the
 * operator decided about the English page binds this one:
 *
 * - Meta is described as it is: a joint controller („gemeinsam
 *   Verantwortliche“) for the collection and transmission, never as one
 *   processor among many. The section heading says „umgeht“, not
 *   „verarbeitet“, for the same reason the English says "handles".
 * - Purpose **and** legal basis per operation; third-country transfers and
 *   their safeguard — the „Datenschutzrahmen EU-USA“, with
 *   „Standardvertragsklauseln“ where it does not cover a transfer.
 * - The cookie table is the operator's own content of 2026-08-10: durations
 *   hedged („Bis zu …“, „Unterschiedlich“), consent status stated in the two
 *   sentences beneath. The two non-cookie browser stores are prose above the
 *   table, one sentence each, in the same order as the English page.
 * - Single opt-in for the newsletter is a recorded, accepted operator
 *   deviation and is not "fixed" here.
 *
 * The stored consent answer is the literal word `granted` or `declined`, so
 * the sentence names those two words and glosses each in German, as the
 * Estonian page does. `local storage` and `session storage` follow their
 * German names in brackets, because those are the names a browser shows.
 *
 * „Rechtsgrundlagen“ is the word of the General Data Protection Regulation
 * for "legal bases". The glossary reads the English "bases" as the game term
 * Base; `content/glossary/index.ts` carries the exception and its reason.
 *
 * Company names, cookie names, anchors, `covers`, the table's shape and every
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
 * The two paragraphs about the online game, of 2026-10-13, are such a change:
 * the TypeSafe paragraph in `processors` and „Wenn Sie Lunar Base online
 * spielen“ in `contact`. `../privacy.ts` records where their facts come from
 * and what they leave open. Nobody qualified has read this German wording. A
 * game is „Partie“ where one sitting is meant and „Spiel“ for the product, a
 * seat is „Platz“, and the server's memory is „Arbeitsspeicher“, so that it
 * cannot be read as the browser's „Sitzungsspeicher“ two sentences later.
 */

import type { LegalPage } from "../../schema.js";

export const privacy: LegalPage = {
  route: "legalPrivacy",
  title: "Datenschutz",
  description:
    "Was wir erheben, warum, auf welcher Rechtsgrundlage, wer damit umgeht, wohin es gelangt und wie Sie die Einwilligung in die Analyse verweigern oder widerrufen.",
  indexable: true,
  sections: ["consent", "processors", "contact"],
  covers: [
    "analytics-lawful-basis",
    "third-party-processors",
    "third-country-transfers",
    "processing-lawful-bases",
  ],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "consent",
      heading: "Gemessen wird nur, wenn Sie zustimmen",
      covers: ["analytics-lawful-basis"],
      body: [
        "Bei Ihrem ersten Besuch werden Sie gefragt, ob wir messen dürfen, wie die Website genutzt wird. Bevor Sie antworten, läuft nichts, was Sie misst, und Ablehnen ist ein einziger Klick, der Sie keine Funktion kostet.",
        "Die Rechtsgrundlage für die Analyse und für das Pixel zur Werbemessung ist Ihre Einwilligung und nichts anderes. Sie können sie jederzeit über den Link in der Fußzeile widerrufen, der dieselbe Auswahl erneut öffnet. Der Widerruf beendet die künftige Messung; er löscht nicht rückwirkend, was bereits erhoben wurde.",
        "Die Teile der Website, die keine Messung sind – das Spiel kaufen, uns kontaktieren, die Regeln lesen –, brauchen keine Einwilligung und bleiben von Ihrer Antwort unberührt.",
        "Ihre Antwort auf die Frage zur Messung speichert diese Website im lokalen Speicher (local storage) Ihres Browsers und nicht als Cookie. Sie bleibt gespeichert, bis Sie Ihre Browserdaten löschen oder die Antwort ändern, und sie hält nichts fest außer dem Wort granted (erteilt) oder declined (abgelehnt).",
        "Eine opake Kennung für Ihren Warenkorb speichert diese Website im Sitzungsspeicher (session storage) Ihres Browsers und nicht als Cookie. Sie bleibt nur gespeichert, bis Sie den Tab schließen, und sie hält keine Produktdetails, Mengen, E-Mail-Adresse oder Lieferadresse fest.",
      ],
      table: {
        caption: "Cookies, die diese Website setzen kann",
        columns: ["Cookie", "Anbieter", "Zweck", "Speicherdauer"],
        rows: [
          ["_ga, _ga_*", "Google Analytics", "Analyse und Messung der Website-Nutzung", "Bis zu 2 Jahre"],
          ["_fbp", "Meta", "Werbemessung und Analyse", "Bis zu 3 Monate"],
          [
            "Sicherheits-Cookies von Cloudflare",
            "Cloudflare",
            "Sicherheit, Steuerung des Datenverkehrs und Schutz vor schädlichem Datenverkehr",
            "Unterschiedlich",
          ],
          [
            "plepic_destination",
            "Plepic Games",
            "Merkt sich das Lieferziel, für das Sie sich den Preis anzeigen lassen wollten, damit der Betrag, den Sie sehen, der für dieses Land ist",
            "Bis zu 1 Jahr",
          ],
        ],
        notes: [
          "Cookies von Google Analytics und Meta werden nur mit Ihrer Einwilligung verwendet. Die Sicherheits-Cookies von Cloudflare sind für den Betrieb und die Sicherheit der Website unbedingt erforderlich und bedürfen keiner Einwilligung.",
          "Das Lieferziel-Cookie wird nur gesetzt, wenn Sie das Lieferziel selbst ändern, und es enthält nichts außer dem zweibuchstabigen Code des Landes, das Sie gewählt haben. Es hält nichts über Sie fest und wird nicht für Messung oder Werbung verwendet.",
        ],
      },
    },
    {
      anchor: "processors",
      heading: "Wer sonst noch mit Ihren Daten umgeht",
      covers: ["third-party-processors", "third-country-transfers"],
      body: [
        "Das sind die Unternehmen, die mit Daten umgehen, wenn Sie diese Website nutzen, und es sind alle.",
        "Cloudflare stellt das DNS dieser Website bereit, terminiert ihre Verschlüsselung und liefert die Sicherheitsabfrage, die das Kontakt- und das Newsletter-Formular vor automatisiertem Missbrauch schützt. Cloudflare verarbeitet daher bei jeder Seite, die Sie laden, Ihre IP-Adresse und die Metadaten der Anfrage. Das ist nicht optional: So wird die Website überhaupt erst ausgeliefert.",
        "Stripe wickelt Zahlungen ab. Wenn Sie zahlen, gehen Ihre Kartendaten direkt an Stripe, und wir erhalten sie nie. Den Zahlungsdatensatz führt Stripe.",
        "Google Analytics misst, wie die Website genutzt wird – erst nachdem Sie eingewilligt haben und nie in unserer Testumgebung.",
        "Wenn Sie einwilligen, sendet diese Website ein Signal zur Werbemessung an Meta, damit wir sehen können, ob unsere Werbung wirkt. Meta nutzt das Empfangene auch für eigene Zwecke und in eigener Verantwortung; für die Erhebung und Übermittlung dieser Daten sind wir und Meta gemeinsam Verantwortliche. Vor Ihrer Einwilligung wird nichts gesendet.",
        "Brevo versendet den Newsletter und speichert die Adresse, die Sie uns dafür genannt haben, bis Sie sich abmelden.",
        "E-Mails zu Bestellungen und Kontaktanfragen werden über unseren eigenen Mailserver versandt. Sie werden nicht an einen Anbieter für Massen-E-Mails weitergegeben.",
        "TypeSafe betreibt Jev, einen Computergegner, den das Online-Spiel Lunar Base anbietet. Wenn die Person, die eine Partie anlegt, Jev wählt, sendet der Spielserver an TypeSafe, was Jevs Platz von dieser Partie sehen kann: seine Karten, die Punktestände, die letzten Züge und die anstehende Entscheidung, einmal für jede Entscheidung, die Jev trifft. Die Spielenden erscheinen darin nur als Platznummern. Es wird kein Spielername und keine IP-Adresse gesendet.",
        "Google, Meta, Stripe und Cloudflare sind US-Unternehmen, und ihre Nutzung bedeutet, dass einige Daten in den Vereinigten Staaten verarbeitet werden. Jedes von ihnen nimmt am Datenschutzrahmen EU-USA teil, und wo dieser eine Übermittlung nicht abdeckt, gelten Standardvertragsklauseln.",
        "Wir verkaufen keine Daten. Abgesehen von der Werbemessung, die Sie oben ablehnen können, darf kein hier genanntes Unternehmen Ihre Daten für eigene Werbung nutzen, und auf dieser Website gibt es keinen Dritten, der oben nicht genannt ist.",
      ],
    },
    {
      anchor: "contact",
      heading: "Ihre Daten und wie Sie uns dazu erreichen",
      covers: ["processing-lawful-bases"],
      body: [
        "Die Rechtsgrundlagen: Die Ausführung Ihrer Bestellung und die Beantwortung Ihrer Nachrichten sind Vertragserfüllung; die Aufbewahrung der Bestellunterlagen über sieben Jahre ist eine rechtliche Verpflichtung nach estnischem Rechnungslegungsrecht; die Auslieferung und der Schutz der Website sind unser berechtigtes Interesse; Messung und Newsletter beruhen allein auf Ihrer Einwilligung.",
        "Wenn Sie bestellen, speichern wir, was eine Bestellung braucht: Ihren Namen, Ihre Lieferadresse, Ihre E-Mail-Adresse, was Sie gekauft und was Sie gezahlt haben. Das estnische Rechnungslegungsrecht verpflichtet uns, den Datensatz sieben Jahre ab dem Ende des Geschäftsjahres aufzubewahren, in das die Bestellung fällt, und danach löschen wir ihn.",
        "Wenn Sie uns schreiben, bewahren wir die Nachricht und Ihre Adresse auf, damit wir antworten können und damit wir den Schriftwechsel wiederfinden, wenn Sie sich wegen derselben Bestellung noch einmal melden. Wir bewahren ihn zwei Jahre nach der letzten Nachricht des Schriftwechsels auf und löschen ihn dann.",
        "Wenn Sie den Newsletter abonnieren, speichern wir Ihre E-Mail-Adresse und sonst nichts. Jede Nachricht enthält einen Abmeldelink, und wenn Sie ihn nutzen, werden Sie ausgetragen.",
        "Wenn Sie Lunar Base online spielen, fragt das Spiel nach einem Spielernamen und nach nichts sonst: Es gibt kein Konto und keine Anmeldung. Der Name wird den anderen Spielenden angezeigt und nur im Arbeitsspeicher des Spielservers gehalten, solange Ihre Sitzung dauert. Eine zufällige Sitzungskennung bleibt im Sitzungsspeicher (session storage) Ihres Browsers gespeichert, bis Sie den Tab schließen, damit Sie Ihren Platz behalten, wenn Sie die Seite neu laden. Der Server führt zu jeder Partie ein Protokoll, das den zufälligen Startwert der Partie und die getroffenen Entscheidungen nach Platznummer enthält, aber keinen Namen und keine IP-Adresse. Er löscht das Protokoll 30 Tage nach der Partie. Ihre IP-Adresse wird nur verwendet, um zu begrenzen, wie viele Verbindungen und neue Partien von einer Adresse kommen; der Spielserver hält sie im Arbeitsspeicher und schreibt sie in kein Protokoll.",
        "Sie können Auskunft darüber verlangen, was wir über Sie gespeichert haben, und verlangen, dass wir es berichtigen, dass wir es löschen oder dass wir seine Verwendung aussetzen; Sie können eine Kopie verlangen oder der Art widersprechen, wie wir es verwenden. Schreiben Sie an {merchantContactAddress}, und ein Mensch wird es lesen.",
        "Wenn wir dabei etwas falsch machen, können Sie sich bei Ihrer nationalen Datenschutzbehörde beschweren. In Estland ist das die Andmekaitse Inspektsioon.",
        "Verantwortlicher ist {merchantLegalName}, {merchantRegisteredAddress}.",
      ],
    },
  ],
};
