/**
 * Returns — the right of withdrawal, its deadline, who pays return postage, and
 * where the parcel goes.
 *
 * The deadlines here are the statutory ones for distance selling to consumers
 * in the EU, not a policy we invented, which is why they are written as
 * entitlements rather than as concessions. The return address and who bears
 * return postage are commercial inputs the operator still has to confirm; until
 * they do, this page stays a draft.
 */

import type { LegalPage } from "../schema.js";

export const returns: LegalPage = {
  route: "legalReturns",
  title: "Returns and right of withdrawal",
  description:
    "Your 14-day right to withdraw from the order, how to exercise it, who pays return postage, where to send the parcel, and how the refund works.",
  indexable: true,
  sections: ["withdrawal", "returns-process"],
  covers: [
    "withdrawal-process",
    "withdrawal-deadline",
    "return-postage-liability",
    "return-address",
  ],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "withdrawal",
      heading: "You have 14 days to change your mind",
      body: [
        "If you are buying as a consumer, you may withdraw from the contract without giving any reason.",
        "The withdrawal period is 14 days from the day you, or somebody you nominated other than the carrier, take physical possession of the goods.",
        "To withdraw, tell us so before the 14 days are up. Email {merchantContactAddress} with your order number and a sentence saying you are withdrawing — that is enough. You may use the model withdrawal form if you prefer, but you are not obliged to. Simply sending the parcel back without telling us also works, but a message is faster and lets us watch for the return.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "returns-process",
      heading: "Sending it back, and getting your money",
      body: [
        "Send the goods back within 14 days of telling us you are withdrawing. The return address is {returnAddress}.",
        "You pay the cost of returning the parcel. Please use a service with tracking, because the goods are your responsibility until they reach us, and choose the cheapest one that does — we do not ask for anything more than that.",
        "We refund what you paid for the goods, plus the standard outbound delivery charge, within 14 days of being told you are withdrawing. If you chose a faster or more expensive delivery option than our standard one, we refund the standard cost rather than the premium. We may hold the refund until the goods reach us, or until you show us proof of postage, whichever happens first.",
        "The refund goes back by the same means you paid, and costs you nothing.",
        "You may unwrap the game and look at it — that is what you would do in a shop. If the components come back damaged or incomplete because of handling beyond checking what the game is, we may reduce the refund by the loss in value.",
        "None of this affects your separate legal rights if the goods arrive faulty, damaged or not as described. If a card is missing or the box arrived crushed, write to {merchantContactAddress} and we will put it right; do not use the withdrawal process for that.",
      ],
      source: "return-postage",
    },
  ],
};
