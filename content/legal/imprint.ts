/**
 * Legal notice — merchant identity and registered address.
 *
 * Everything identifying the merchant is a placeholder resolved from
 * configuration. That is not squeamishness about a public repository: a
 * registered name, address, company number, VAT number and telephone number
 * are per-deployment facts that must be correct in production, and Global
 * Constraints put account addresses in configuration rather than in content
 * files. The operator supplied the whole set on 2026-08-09; it reaches this
 * page through the `MERCHANT_*` environment variables, and until a deployment
 * set them this page could not be approved — see `reviewStatus`. Both
 * deployments now set all seven, from `hannosirkel/deploys`,
 * `plepic/base/storefront.yaml`, with no per-environment override, so this
 * page is `operator-approved` on the only terms that mean anything: as served.
 *
 * **An unconfigured value here is not dropped.** `content/schema.ts` marks
 * every token below `legallyRequired`, and
 * `storefront/src/lib/configuration-placeholders.ts` renders a named, visible
 * gap plus a page-level notice rather than quietly removing the sentence. An
 * imprint that silently loses its registration number looks complete and is
 * not, which is worse than one that says out loud that it is broken.
 *
 * Two edits come from the second qualified read of 2026-08-09:
 *
 * - **M1** — the telephone number. Article 6(1)(c) CRD as amended by
 *   Directive (EU) 2019/2161 removed the old "where available" qualifier, so
 *   it is mandatory; transposed into VÕS § 54¹.
 * - **Minor 1** — name the register, not just the number, per Article 5(1)(d)
 *   of the e-Commerce Directive 2000/31/EC.
 */

import type { LegalPage } from "../schema.js";

export const imprint: LegalPage = {
  route: "legalImprint",
  title: "Legal notice",
  description:
    "Who you are buying from: the registered name, address and company details of the merchant behind Plepic Games.",
  indexable: true,
  sections: ["contact"],
  covers: ["merchant-identity", "registered-address"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "contact",
      heading: "Who you are buying from",
      covers: ["merchant-identity", "registered-address"],
      body: [
        "This site is operated by {merchantLegalName}, registered at {merchantRegisteredAddress}.",
        "Registered in the Estonian Commercial Register (äriregister) under number {merchantRegistrationNumber}.",
        "VAT identification number: {merchantVatNumber}.",
        "Email: {merchantContactAddress}. Telephone: {merchantPhoneNumber}.",
        "{merchantLegalName} is the seller for every order placed on this site, and the party responsible for the contract you enter at checkout.",
      ],
    },
  ],
};
