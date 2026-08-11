/**
 * Õigusteave — the Estonian edition of `../imprint.ts`.
 *
 * This file is a translation, not a revision. The English page carries two
 * qualified-reader reviews and is the drafting source; anything believed wrong
 * there is a finding to report against the English, never a thing to fix here
 * first. Structure, anchors, `covers`, route ids and every placeholder
 * token are byte-identical to the English page — only prose is Estonian.
 *
 * `reviewStatus` is `draft-pending-operator-input` and is not this file's to
 * change: the qualified reader's acceptance of the Estonian text is an
 * operator act, recorded outside this repository.
 */

import type { LegalPage } from "../../schema.js";

export const imprint: LegalPage = {
  route: "legalImprint",
  title: "Õigusteave",
  description:
    "Kellelt sa ostad: Plepic Gamesi taga seisva kaupleja registreeritud nimi, aadress ja äriühingu andmed.",
  indexable: true,
  sections: ["contact"],
  covers: ["merchant-identity", "registered-address"],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "contact",
      heading: "Kellelt sa ostad",
      covers: ["merchant-identity", "registered-address"],
      body: [
        "Seda saiti haldab {merchantLegalName}, registrijärgne aadress {merchantRegisteredAddress}.",
        "Kantud Eesti äriregistrisse registrikoodiga {merchantRegistrationNumber}.",
        "Käibemaksukohustuslasena registreerimise number: {merchantVatNumber}.",
        "E-post: {merchantContactAddress}. Telefon: {merchantPhoneNumber}.",
        "{merchantLegalName} on iga sellel saidil esitatud tellimuse müüja ja pool, kes vastutab lepingu eest, mille sa tellimuse vormistamisel sõlmid.",
      ],
    },
  ],
};
