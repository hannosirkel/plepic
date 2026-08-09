/**
 * Terms of sale — including, specifically, what the buyer acknowledges at
 * checkout. That last part is a required element and is written to match the
 * checkout screen exactly; if the button label or the consent line changes in
 * the storefront, this page changes in the same commit.
 */

import type { LegalPage } from "../schema.js";

export const terms: LegalPage = {
  route: "legalTerms",
  title: "Terms of sale",
  description:
    "The terms you agree to when you order: how the contract is formed, what you confirm at checkout, payment, and what happens if something goes wrong.",
  indexable: true,
  sections: ["checkout-acknowledgement", "delivery"],
  covers: ["checkout-acknowledgement"],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "checkout-acknowledgement",
      heading: "What you confirm at checkout",
      body: [
        "Placing an order is an offer to buy. The contract exists when we send you a dispatch confirmation, not when you press the button, and not when the payment is authorised.",
        "The final button on the checkout page is labelled to say that pressing it places an order with an obligation to pay. Immediately above it you see, on one screen: the goods, the price of the goods, the shipping charge, the total, the delivery address and the delivery estimate.",
        "By placing the order you confirm that you have read and accept these terms and the privacy notice, that you are buying as described on this site, and that you are at least 18 years old or ordering with the agreement of somebody who is.",
        "You will receive a confirmation by email containing the order, the total paid and these terms. Keep it — it is your copy of the contract.",
        "We accept payment by card through our payment processor. We never see or store your card number. If the payment fails or is later reversed, the order does not proceed.",
        "Sold to consumers, and to businesses on the same terms. Nothing on this page reduces the statutory rights of a consumer.",
      ],
      source: "task1-commercial-model",
    },
    {
      anchor: "delivery",
      heading: "Availability, price and mistakes",
      body: [
        "We sell one product. If we cannot supply it — the print run is out, or the parcel cannot be delivered to your country — we tell you and refund you in full. We are not obliged to source a substitute.",
        "The price is the one displayed when you place the order. If a price is displayed wrongly through an obvious error and you could reasonably have realised it was an error, we are not obliged to sell at that price; we will tell you and either cancel the order or ask you to confirm at the correct price.",
        "If something has gone wrong with an order, write to {merchantContactAddress} first. We would much rather fix it than have you argue with a card issuer.",
        "These terms are governed by the law of the country in which {merchantLegalName} is established, and nothing in them removes the protection of the mandatory consumer law of the country you live in.",
      ],
    },
  ],
};
