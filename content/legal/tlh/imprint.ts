/**
 * chut QIn — the Klingon edition of `../imprint.ts`.
 *
 * This file is a translation, not a revision. The English page carries two
 * qualified-reader reviews and is the drafting source; anything believed wrong
 * there is a finding to report against the English, never a thing to fix here
 * first. Route, anchors, `covers`, section order and every placeholder token
 * are identical to the English page — only prose is Klingon. The company name,
 * the addresses, the country's name and the register's Estonian name stay as
 * they are.
 *
 * Staged: the file is not registered in `../index.ts`, so no visitor reaches
 * it yet. The mirror test, the content scans and the Klingon word check read
 * it from disk.
 *
 * `reviewStatus` is `operator-approved`: the operator approved every
 * translation of the site-translation job in advance on 2026-10-10, legal
 * pages included. The field records that advance approval. No separate reading
 * of this Klingon wording is recorded here, and the approval is not a standing
 * one for whatever this page may later say: a change to its substance needs
 * its own reading.
 *
 * Klingon has no legal vocabulary of its own. Each term this page coins is
 * built from sourced roots and written out in `content/glossary/tlh.ts`
 * (`klingonLegalTerms`): `SIr'o' Daq` is the web site, `ngevmeH 'ap` is VAT
 * and carries the loan in brackets, `malja' tetlh` is the commercial register.
 * `Huch nobmeH Daq` is the glossary's word for the checkout.
 *
 * A placeholder takes no suffix: the storefront fills it with a name, and a
 * name is not a Klingon noun. Sentences are built so the token stands bare,
 * which is why the last paragraph names the merchant once, as its subject.
 */

import type { LegalPage } from "../../schema.js";

export const imprint: LegalPage = {
  route: "legalImprint",
  title: "chut QIn",
  description:
    "ngevwI' Dangu'meH: Plepic Games malja' loHbogh Suy pong qonlu'bogh, Daq qonlu'bogh, malja' De' je.",
  indexable: true,
  sections: ["contact"],
  covers: ["merchant-identity", "registered-address"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "contact",
      heading: "ngevwI' 'Iv",
      covers: ["merchant-identity", "registered-address"],
      body: [
        "SIr'o' Daqvam loH {merchantLegalName}. malja'vam Daq qonlu'bogh: {merchantRegisteredAddress}.",
        "Estonia malja' tetlhDaq (äriregister) qonlu'. mI': {merchantRegistrationNumber}.",
        "ngevmeH 'ap (VAT) ngu'meH mI': {merchantVatNumber}.",
        "QIn Daq: {merchantContactAddress}. ghogh HablI' mI': {merchantPhoneNumber}.",
        "SIr'o' DaqvamDaq vunlu'bogh Hoch Doch ngev {merchantLegalName}; Huch nobmeH DaqDaq mab DalajDI', mabvamvaD ngoy' je.",
      ],
    },
  ],
};
