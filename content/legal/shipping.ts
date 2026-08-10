/**
 * Shipping — delivery terms, dispatch estimates, and how prices are presented
 * with respect to VAT.
 *
 * Every estimate here is the commercial model Task 1 froze. The price itself is
 * a placeholder because a price written into a legal page is a price that goes
 * stale silently, which on this particular page is a misrepresentation rather
 * than a typo.
 *
 * Two changes come from the second qualified read of 2026-08-09:
 *
 * - **Minor 2** — *"that figure is inclusive of value added tax"* was untrue
 *   for exports, where no EU VAT is due at all. The replacement wording is true
 *   of both cases, and it also survives the day the distance-sales OSS
 *   threshold is crossed without needing an edit. Its *substance* is still
 *   here; its *phrasing* was superseded on 2026-08-10 — see below.
 * - **Minor 3** — "estimates, not guarantees" was one-sided. Article 18 CRD
 *   gives the buyer a cancellation right after a further reasonable deadline,
 *   and the page now says so.
 *
 * **The VAT section quotes `{price}`, not `{priceLine}`, and that is the whole
 * point of Minor 2.** `{priceLine}` resolved through the catalogue to the
 * price *plus* "VAT included" — the unqualified claim Minor 2 exists to
 * remove, because it is untrue of an export. The first revision applied the
 * reader's replacement sentence and left `{priceLine}` interpolating the
 * original claim one line above it, so the section that discharges
 * `vat-presentation` made two contradictory statements about tax. It now makes
 * one, and it is the qualified one.
 *
 * ## The price presentation is the operator's own wording, 2026-08-10
 *
 * The `callout` below is supplied text, reproduced exactly, and its shape is
 * part of the answer: an emphasised line carrying the figure and the tax
 * qualification, and a plain line carrying what is *not* in the figure. It
 * replaced a paragraph that quoted `{price}` mid-sentence.
 *
 * Two things about it are load-bearing.
 *
 * - **`{price}` is still the placeholder.** The figure itself is never written
 *   here; it resolves from `storefront/mock/catalogue.json` through
 *   `storefront/src/lib/catalogue.ts`, and `content.test.ts` fails on a
 *   currency symbol or an amount in this file either way.
 * - **The same wording reaches the product page**, because the catalogue's
 *   `priceQualifiers` — which the purchase panel and the hero render — carries
 *   the identical qualification. A legal page saying *"where applicable"* over
 *   a product page saying *"VAT included"* flatly would move the contradiction
 *   Minor 2 removed up one level, to the more prominent page.
 *
 * ## The duplication the first revision left, and how it was removed
 *
 * That first revision kept the callout *and* Minor 2's replacement sentence
 * verbatim, one line apart, on the reasoning that one was the presentation and
 * the other was the rule:
 *
 * > **Callout:** {price} · VAT included where applicable
 * > **Body:** *"Where VAT is due on your order, it is contained within that
 * > figure rather than added to it; where it is not due, the price is the
 * > same."*
 *
 * The operator read both and answered **"unify to my wording"** on 2026-08-10.
 * They do restate one qualification twice — the callout's *"where
 * applicable"* and the sentence's *"where it is due … where it is not due"*
 * are the same conditional in two vocabularies, and a reader meeting them a
 * line apart has to work out whether the second is narrowing the first.
 *
 * **Unifying is not deleting, and what the sentence carried beyond the
 * callout is still on the page.** Minor 2's substance was two things the
 * callout compresses into two words, and both survive in the body's second
 * paragraph:
 *
 * - **How the tax sits in the figure** — *"Included means contained within
 *   that figure rather than added to it."* This is the inclusive-pricing
 *   claim, which "included" alone does not make: it says the figure is not a
 *   net price with tax to follow. It now reads as a gloss on the operator's
 *   own word rather than as a second, differently-worded qualification.
 * - **That the figure is identical where no tax is due** — *"It is the same
 *   figure for every visitor, in every country, and it does not change
 *   according to where you are or where you ask us to send the parcel —
 *   including where no VAT is due at all."* The sentence was already there and
 *   already said the general case; the closing clause is what makes it say the
 *   export case Minor 2 was written for, explicitly, without reopening the
 *   conditional the callout has already stated.
 *
 * The delivery-address rule and the business-buyer paragraph are untouched.
 * Nothing else on this page, and no other legal page, was edited on this
 * decision.
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
      covers: ["delivery-terms", "dispatch-estimate"],
      body: [
        "We ship to every country.",
        "Orders are dispatched within 3 business days of payment clearing. After dispatch, delivery inside the European Union usually takes 3 to 7 business days, and delivery to the rest of the world usually takes 7 to 21 business days.",
        "Those are estimates from the carrier, not guarantees. Customs inspection, strikes and the fortnight before Christmas all move them. If a parcel is materially overdue, write to us at {merchantContactAddress} and we will chase it.",
        "If a parcel simply never comes, you can set us a further reasonable deadline and, if we miss that too, cancel for a full refund.",
        "Shipping is charged per order and is calculated at checkout once you have entered a delivery address. You see the exact amount before you pay; there is no stage after payment at which the cost changes.",
        "Orders shipped outside the European Union may attract import duties, taxes and carrier handling fees on arrival. Those are charged by the destination country, are payable by the recipient, and are not collected by us. We do not calculate them and cannot estimate them for you.",
      ],
      source: "delivery-estimates",
    },
    {
      anchor: "vat",
      heading: "How the price is presented",
      covers: ["vat-presentation"],
      callout: {
        lead: "{price} · VAT included where applicable",
        detail:
          "Shipping calculated at checkout. Non-EU taxes and duties, if any, are not included.",
      },
      body: [
        "That is the price shown on the product page and in the basket, and it is the price a consumer pays for the goods.",
        "Included means contained within that figure rather than added to it. It is the same figure for every visitor, in every country, and it does not change according to where you are or where you ask us to send the parcel — including where no VAT is due at all. Where tax is due, which tax applies is worked out from the confirmed delivery address at checkout.",
        "Shipping is the only amount added at checkout, and it is shown to you before you commit to the order.",
        "Business buyers: the displayed price is a consumer price, with any tax that is due contained within it. If you need an invoice with the tax treatment stated for your own accounting, write to us at {merchantContactAddress} before ordering.",
      ],
      source: "price-presentation",
    },
  ],
};
