/**
 * Legal notice — merchant identity and registered address.
 *
 * Everything identifying the merchant is a placeholder resolved from
 * configuration. That is not squeamishness about a public repository: a
 * registered name, address, company number and VAT number are per-deployment
 * facts that must be correct in production and must not be present at all in
 * the test environment's index. None of them is currently supplied, so this
 * page cannot be approved — see `reviewStatus`.
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
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "contact",
      heading: "Who you are buying from",
      body: [
        "This site is operated by {merchantLegalName}, registered at {merchantRegisteredAddress}.",
        "Company registration number: {merchantRegistrationNumber}. VAT identification number: {merchantVatNumber}.",
        "Email: {merchantContactAddress}. We answer in a day or two.",
        "{merchantLegalName} is the seller for every order placed on {siteName}, and the party responsible for the contract you enter at checkout.",
      ],
    },
  ],
};
