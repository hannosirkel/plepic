/**
 * Shipping — delivery terms, dispatch estimates, and how prices are presented
 * with respect to VAT.
 *
 * Every estimate here is the commercial model Task 1 froze. The price itself is
 * a placeholder because a price written into a legal page is a price that goes
 * stale silently, which on this particular page is a misrepresentation rather
 * than a typo.
 */

import type { LegalPage } from "../schema.js";

export const shipping: LegalPage = {
  route: "legalShipping",
  title: "Shipping and delivery",
  description:
    "Where we ship, how long dispatch and delivery take, how shipping is charged, and how tax is included in the price you see.",
  indexable: true,
  sections: ["delivery", "vat"],
  covers: ["delivery-terms", "dispatch-estimate", "vat-presentation"],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "delivery",
      heading: "Where we ship and how long it takes",
      body: [
        "We ship to every country.",
        "Orders are dispatched within 3 business days of payment clearing. After dispatch, delivery inside the European Union usually takes 3 to 7 business days, and delivery to the rest of the world usually takes 7 to 21 business days.",
        "Those are estimates from the carrier, not guarantees. Customs inspection, strikes and the fortnight before Christmas all move them. If a parcel is materially overdue, write to us at {merchantContactAddress} and we will chase it.",
        "Shipping is charged per order and is calculated at checkout once you have entered a delivery address. You see the exact amount before you pay; there is no stage after payment at which the cost changes.",
        "Orders shipped outside the European Union may attract import duties, taxes and carrier handling fees on arrival. Those are charged by the destination country, are payable by the recipient, and are not collected by us. We do not calculate them and cannot estimate them for you.",
      ],
      source: "delivery-estimates",
    },
    {
      anchor: "vat",
      heading: "How the price is presented",
      body: [
        "The price shown on the product page and in the basket is the price a consumer pays for the goods: {priceLine}",
        "That figure is inclusive of value added tax. It is the same figure for every visitor, in every country, and it does not change according to where you are or where you ask us to send the parcel. The applicable tax is worked out from the confirmed delivery address at checkout and is contained within the advertised price rather than added to it.",
        "Shipping is the only amount added at checkout, and it is shown to you before you commit to the order.",
        "Business buyers: the displayed price is a consumer price inclusive of tax. If you need an invoice with the tax treatment stated for your own accounting, write to us at {merchantContactAddress} before ordering.",
      ],
      source: "price-presentation",
    },
  ],
};
