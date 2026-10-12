/**
 * Impressum — the German edition of `../imprint.ts`.
 *
 * This file is a translation, not a revision. The English page carries two
 * qualified-reader reviews and is the drafting source; anything believed wrong
 * there is a finding to report against the English, never a thing to fix here
 * first. Route, anchors, `covers`, section order and every placeholder token
 * are identical to the English page — only prose is German. The company name,
 * the addresses and the register's Estonian name stay as they are.
 *
 * **Staged, not published.** The German edition is in neither `LOCALES` nor
 * `legalPagesByLocale` yet, so no visitor can reach this page; registering it
 * is a later task of the same plan. Until then `content/mirror.test.ts` and
 * the scans of `content/content.test.ts` read this file from disk.
 *
 * `reviewStatus` is `operator-approved`: the operator approved every
 * translation of the site-translation job in advance on 2026-10-10, legal
 * pages included. The field records that advance approval. No separate reading
 * of this German wording is recorded here, and the approval is not a standing
 * one for whatever this page may later say: a change to its substance needs
 * its own reading.
 *
 * The page addresses the reader as „Sie“, as
 * `docs/working/site-translation/de.md` sets for legal pages. „Kasse“ is the
 * glossary's word for the checkout and is used wherever the English says so.
 */

import type { LegalPage } from "../../schema.js";

export const imprint: LegalPage = {
  route: "legalImprint",
  title: "Impressum",
  description:
    "Bei wem Sie kaufen: der eingetragene Name, die Anschrift und die Unternehmensangaben des Händlers, der hinter Plepic Games steht.",
  indexable: true,
  sections: ["contact"],
  covers: ["merchant-identity", "registered-address"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "contact",
      heading: "Bei wem Sie kaufen",
      covers: ["merchant-identity", "registered-address"],
      body: [
        "Diese Website wird von {merchantLegalName} betrieben, eingetragene Anschrift: {merchantRegisteredAddress}.",
        "Eingetragen im estnischen Handelsregister (äriregister) unter der Nummer {merchantRegistrationNumber}.",
        "Umsatzsteuer-Identifikationsnummer: {merchantVatNumber}.",
        "E-Mail: {merchantContactAddress}. Telefon: {merchantPhoneNumber}.",
        "{merchantLegalName} ist der Verkäufer bei jeder Bestellung, die auf dieser Website aufgegeben wird, und die Partei, die für den Vertrag verantwortlich ist, den Sie an der Kasse schließen.",
      ],
    },
  ],
};
