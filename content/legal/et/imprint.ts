/**
 * Õigusteave — the Estonian edition of `../imprint.ts`.
 *
 * This file is a translation, not a revision. The English page carries two
 * qualified-reader reviews and is the drafting source; anything believed wrong
 * there is a finding to report against the English, never a thing to fix here
 * first. Structure, anchors, `covers`, route ids and every placeholder
 * token are byte-identical to the English page — only prose is Estonian.
 *
 * `reviewStatus` is `operator-approved`, and it records **both** things. The
 * page **as served**, which became possible when the deployment manifests began
 * supplying all seven `MERCHANT_*` values, so the tokens below resolve to the
 * registered identity rather than to visible gaps. And the **qualified
 * reader's acceptance of the Estonian text**, which the operator confirmed as
 * given on 2026-08-20 and recorded in the project's decision log, which lives
 * outside this repository; it is no longer an act recorded only outside this
 * repository, and earlier revisions of this comment saying otherwise — first
 * that it was not this file's to record, then that this field explicitly did
 * not represent it — were describing a state that has since changed.
 *
 * It is not a standing approval of whatever this page may later say. A change
 * to its substance needs its own reading, exactly as the ones recorded above
 * did.
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
