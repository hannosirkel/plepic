/**
 * Õigusteave — the Estonian edition of `../imprint.ts`.
 *
 * This file is a translation, not a revision. The English page carries two
 * qualified-reader reviews and is the drafting source; anything believed wrong
 * there is a finding to report against the English, never a thing to fix here
 * first. Structure, anchors, `covers`, route ids and every placeholder
 * token are byte-identical to the English page — only prose is Estonian.
 *
 * `reviewStatus` is `operator-approved`. It records one thing: the operator
 * has approved this page **as served**, which became possible when the
 * deployment manifests began supplying all seven `MERCHANT_*` values, so the
 * tokens below resolve to the registered identity rather than to visible gaps.
 * It does **not** record the qualified reader's acceptance of the Estonian
 * text. That remains an operator act recorded outside this repository, it has
 * no field here, and none should be added: a status that means two things is a
 * status that can be true for only one of them and read as both.
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
  reviewStatus: "operator-approved",
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
