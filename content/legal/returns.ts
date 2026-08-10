/**
 * Returns — the right of withdrawal, its deadline, the model withdrawal form,
 * who pays return postage, where the parcel goes, and the legal guarantee of
 * conformity that sits underneath all of it.
 *
 * The deadlines here are the statutory ones for distance selling to consumers
 * in the EU, not a policy we invented, which is why they are written as
 * entitlements rather than as concessions. **The withdrawal period is 14 days.**
 * The operator considered extending it to 30 and decided on 2026-08-09 to leave
 * it at the statutory 14; it is not a drafting oversight and must not be
 * "corrected".
 *
 * Four changes come from the second qualified read of 2026-08-09:
 *
 * - **M3** — the Annex I(B) model withdrawal form is now *provided* rather than
 *   referred to. Article 6(1)(h) CRD obliges the trader to give it, and
 *   mentioning that one exists is not giving it.
 * - **M6** — *"the goods are your responsibility until they reach us"* is gone.
 *   It contradicted the Article 13(3) sentence two paragraphs below it: once a
 *   consumer shows proof of postage the refund is due, so return-transit loss
 *   sits with the trader, and Article 14(2) caps consumer liability at
 *   diminished value from excess handling. The sentence stated the opposite of
 *   the law and would have been unenforceable.
 * - **M2** — the legal guarantee of conformity is now stated positively, as
 *   Article 6(1)(l) CRD requires, including the Estonian two-month
 *   notification duty of VÕS § 220(1), which protects the merchant too.
 * - **Minor 4** — returning the parcel without a message is still accepted, and
 *   the refund clock for that case is now stated instead of left ambiguous.
 */

import type { LegalPage } from "../schema.js";

export const returns: LegalPage = {
  route: "legalReturns",
  title: "Returns and right of withdrawal",
  description:
    "Your 14-day right to withdraw from the order, how to exercise it, the model withdrawal form, who pays return postage, where to send the parcel, and how the refund works.",
  indexable: true,
  sections: ["withdrawal", "withdrawal-form", "returns-process", "legal-guarantee"],
  covers: [
    "withdrawal-process",
    "withdrawal-deadline",
    "model-withdrawal-form",
    "return-postage-liability",
    "return-address",
    "legal-guarantee-of-conformity",
  ],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "withdrawal",
      heading: "You have 14 days to change your mind",
      covers: ["withdrawal-process", "withdrawal-deadline"],
      body: [
        "If you are buying as a consumer, you may withdraw from the contract without giving any reason.",
        "The withdrawal period is 14 days from the day you, or somebody you nominated other than the carrier, take physical possession of the goods.",
        "To withdraw, tell us so before the 14 days are up. Email {merchantContactAddress} with your order number and a sentence saying you are withdrawing — that is enough. You may use the model withdrawal form below if you prefer, but you are not obliged to. Simply sending the parcel back without telling us also works, but a message is faster and lets us watch for the return.",
        "The statutory 14 days for the refund run from the day you tell us; if the parcel is your only message, the refund clock starts when it, or your proof of postage, reaches us.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "withdrawal-form",
      heading: "Model withdrawal form",
      covers: ["model-withdrawal-form"],
      body: [
        "Model withdrawal form (use only if you wish):",
        "To {merchantLegalName}, {merchantRegisteredAddress}, {merchantContactAddress}: I hereby give notice that I withdraw from my contract of sale of the following goods: …",
        "Ordered on / received on: …",
        "Name and address of consumer: …",
        "Signature (only if on paper), date.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "returns-process",
      heading: "Sending it back, and getting your money",
      covers: ["return-postage-liability", "return-address"],
      body: [
        "Send the goods back within 14 days of telling us you are withdrawing. The return address is {returnAddress}.",
        "You pay the cost of returning the parcel. Please use a tracked service and keep your proof of postage — once you show it to us, your refund is due even if the parcel is still travelling — and choose the cheapest service that offers tracking; we do not ask for anything more than that.",
        "We refund what you paid for the goods, plus the standard outbound delivery charge, within 14 days of being told you are withdrawing. If you chose a faster or more expensive delivery option than our standard one, we refund the standard cost rather than the premium. We may hold the refund until the goods reach us, or until you show us proof of postage, whichever happens first.",
        "The refund goes back by the same means you paid, and costs you nothing.",
        "You may unwrap the game and look at it — that is what you would do in a shop. If the components come back damaged or incomplete because of handling beyond checking what the game is, we may reduce the refund by the loss in value.",
        "None of this affects your separate legal rights if the goods arrive faulty, damaged or not as described. If a card is missing or the box arrived crushed, write to {merchantContactAddress} and we will put it right; do not use the withdrawal process for that.",
      ],
      source: "return-postage",
    },
    {
      anchor: "legal-guarantee",
      heading: "Your legal guarantee, which is separate from all of this",
      covers: ["legal-guarantee-of-conformity"],
      body: [
        "Separately from the 14-day right to change your mind, EU law gives you a legal guarantee of conformity: for two years from delivery we are liable for any fault that existed when the goods were delivered, and during the first year a fault is presumed to have been there from the start unless we show otherwise. If something is wrong, tell us within two months of noticing it and we will repair, replace, reduce the price or refund, at no cost to you.",
      ],
    },
  ],
};
