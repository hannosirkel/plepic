/**
 * Terms of sale — including, specifically, what the buyer acknowledges at
 * checkout. That last part is a required element and is written to match the
 * checkout screen exactly; if the button label or the consent line changes in
 * the storefront, this page changes in the same commit.
 *
 * **M4 of the second qualified read** added the out-of-court dispute
 * resolution section. Article 6(1)(t) CRD requires it where a mechanism
 * applies, and one squarely does for an Estonian trader: the Consumer Disputes
 * Committee (tarbijavaidluste komisjon) at the TTJA, free of charge.
 *
 * **There is deliberately no ODR-platform link.** Regulation 524/2013 was
 * repealed by Regulation (EU) 2024/3228 and the platform was dismantled in
 * July 2025. Its absence is correct, and the second read flagged it as exactly
 * the thing a checklist reviewer would wrongly "fix". Do not add one.
 *
 * **The access method is a link, not a hostname.** The section carries a `Link`
 * to the `consumer-disputes-committee` external target; the URL comes from
 * deployment configuration, because `content/` may name no host. Do not write
 * the address into this file, and do not delete the link.
 *
 * **The button-label sentence, updated 2026-08-29.** It used to quote the
 * Article 8(2) CRD wording the button carried verbatim: `"is labelled to say
 * that pressing it places an order with an obligation to pay"`. The operator
 * replaced the button's own label with "Pay now" — one of the European
 * Commission's own compliant formulations, see `content/shop.ts`'s
 * `COMPLIANT_ORDER_BUTTON_LABELS` — so the sentence now names the actual label
 * rather than paraphrasing the article, which is what keeps it a true
 * description of the screen rather than a claim the checkout no longer makes.
 *
 * **The link is an enhancement, and the sentence stands without it — decided by
 * the operator with the qualified reviewer's manual verification, 2026-08-10.**
 * Naming the Consumer Disputes Committee, without an access method, satisfies
 * Article 6(1)(t) CRD. The first revision of this page treated the URL as part
 * of the obligation and put it in the legally-required gap set, so an
 * unconfigured deployment marked this page **incomplete** over a link. That was
 * the right call under the assumption the access method was mandatory and is
 * wrong now: an optional enhancement must not make a legally complete page
 * announce itself as incomplete. An unconfigured URL now degrades quietly — the
 * link line is not rendered, the paragraph above it is untouched, and nothing
 * enters the page notice. The merchant identity set keeps the opposite,
 * unchanged, loud treatment, because there the missing value *is* the
 * disclosure; see `storefront/src/components/mockups/link-target.ts` for where
 * that line is drawn.
 */

import type { LegalPage } from "../schema.js";

export const terms: LegalPage = {
  route: "legalTerms",
  title: "Terms of sale",
  description:
    "The terms you agree to when you order: how the contract is formed, what you confirm at checkout, payment, what happens if something goes wrong, and where to take a dispute.",
  indexable: true,
  sections: ["checkout-acknowledgement", "delivery", "dispute-resolution"],
  covers: ["checkout-acknowledgement", "dispute-resolution"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "checkout-acknowledgement",
      heading: "What you confirm at checkout",
      covers: ["checkout-acknowledgement"],
      body: [
        "Placing an order is an offer to buy. The contract exists when we send you a dispatch confirmation, not when you press the button, and not when the payment is authorised.",
        "The final button on the checkout page is labelled \"Pay now\" — one of the unambiguous formulations the European Commission's guidance accepts for a button that places an order with an obligation to pay. Immediately above it you see, on one screen: the goods, the price of the goods, the shipping charge, the total, the delivery address and the delivery estimate.",
        "By placing the order you confirm that you have read and accept these terms and the privacy notice, that you are buying as described on this site, and that you are at least 18 years old or ordering with the agreement of somebody who is.",
        "You will receive a confirmation by email containing the order, the total paid and these terms. Keep it — it is your copy of the contract.",
        "We accept cards, Apple Pay, Google Pay and PayPal through Stripe when Stripe makes them available for your device and location. We never see or store your card number. If the payment fails or is later reversed, the order does not proceed.",
        "Sold to consumers, and to businesses on the same terms. Nothing on this page reduces the statutory rights of a consumer.",
      ],
      source: "checkout-contract",
    },
    {
      anchor: "delivery",
      heading: "Availability, price and mistakes",
      covers: [],
      body: [
        "We sell one product. If we cannot supply it — the print run is out, or the parcel cannot be delivered to your country — we tell you and refund you in full. We are not obliged to source a substitute.",
        "The price is the one displayed when you place the order. If a price is displayed wrongly through an obvious error and you could reasonably have realised it was an error, we are not obliged to sell at that price; we will tell you and either cancel the order or ask you to confirm at the correct price.",
        "If something has gone wrong with an order, write to {merchantContactAddress} first. We would much rather fix it than have you argue with a card issuer.",
        "These terms are governed by the law of the country in which {merchantLegalName} is established, and nothing in them removes the protection of the mandatory consumer law of the country you live in.",
      ],
    },
    {
      anchor: "dispute-resolution",
      heading: "If writing to us does not settle it",
      covers: ["dispute-resolution"],
      body: [
        "If we cannot sort it out between us and you live in the European Union, you may refer the dispute to the Consumer Disputes Committee at the Estonian Consumer Protection and Technical Regulatory Authority. The procedure is free of charge. Nothing here limits your right to go to court instead.",
      ],
      links: [
        {
          label: "How to reach the Consumer Disputes Committee",
          target: { kind: "external", to: "consumer-disputes-committee" },
        },
      ],
    },
  ],
};
