/**
 * Shipping — delivery terms, dispatch estimates, and how prices are presented
 * with respect to VAT.
 *
 * Every estimate here is the commercial model Task 1 froze. The price itself is
 * a placeholder because a price written into a legal page is a price that goes
 * stale silently, which on this particular page is a misrepresentation rather
 * than a typo.
 *
 * ## The VAT section was rewritten on 2026-08-18, and the reason is arithmetic
 *
 * Everything below this heading describes the page as it stood while the
 * advertised figure **contained** the tax. It does not any more. The advertised
 * figure is the price **before** tax; Estonian VAT is added for a delivery
 * address in the European Union and is added nowhere else, so the price of the
 * goods is one figure inside the EU and a lower one outside it. That makes the
 * previous
 * section's central claims false in both directions at once — *"included means
 * contained within that figure rather than added to it"* is the opposite of
 * what happens inside the EU, and *"it is the same figure for every visitor, in
 * every country"* is the opposite of what happens between the two.
 *
 * The replacement wording below is the operator's, supplied whole, and it is
 * structured around the fact that there is no longer one figure to talk about:
 * `{priceNet}` is the invariant, `{priceGross}` and `{priceVat}` are what the
 * EU adds to it, `{vatRate}` is the rate, and `{price}` — the only one of the
 * five that moves — is whichever of the two the reader's own destination
 * attracts. All five resolve from `storefront/src/lib/catalogue.ts` against two
 * amounts Medusa computed; nothing on this site multiplies by a rate.
 *
 * **The last paragraph is load-bearing and is not a hedge.** The destination
 * selector defaults to the United States, so a European reader who has not
 * touched it is shown the lower figure. The operator made that choice knowing
 * it, on the condition that no figure is ever shown without its destination
 * beside it — which is what `{priceTaxQualifier}` in the callout does — and
 * that the page says plainly that the setting decides which price is *shown*
 * and never what is *charged*. That sentence is the second half of the
 * condition.
 *
 * The business-buyer paragraph survives, corrected: it used to say the price
 * had "any tax that is due contained within it", which is now false, and it now
 * says where the VAT amount appears instead. The delivery section is untouched.
 *
 * ## What follows is the record of the previous revision, kept as history
 *
 * It is left in place because the reasoning it records — why an unqualified
 * "VAT included" was struck off, why the qualification is composed in one place
 * and read by every surface, why the callout is two parts and not one string —
 * is all still binding. Only the *words* it settled have been superseded.
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
 * - **The same wording reaches the product page**, because it resolves from
 *   one place. `storefront/src/lib/catalogue.ts` composes the qualification
 *   the purchase panel and the hero render beside the figure
 *   (`priceTaxQualifier`, the emphasised half of this callout's own line) and
 *   the one the basket and checkout summaries render under a summary
 *   (`priceQualifiers`) out of those same words. A legal page saying *"where
 *   applicable"* over a product page saying *"VAT included"* flatly would move
 *   the contradiction Minor 2 removed up one level, to the more prominent
 *   page.
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
    "Where we ship, how long dispatch and delivery take, how shipping is charged, and how tax is added to the price you see.",
  indexable: true,
  sections: ["delivery", "vat"],
  covers: ["delivery-terms", "dispatch-estimate", "vat-presentation"],
  reviewStatus: "operator-approved",
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
        lead: "{price} · {priceTaxQualifier}",
        detail:
          "Shipping is calculated at checkout, and VAT is added to it for delivery inside the European Union. Non-EU taxes and duties, if any, are not included.",
      },
      body: [
        "The price of the game before tax is {priceNet}. That figure is the same wherever you are; what changes is the tax added to it.",
        "For delivery to an address in the European Union we add Estonian value added tax at {vatRate}. The price of the goods is then {priceGross} — {priceNet} plus {priceVat} of VAT — and that is the figure you pay.",
        "For delivery anywhere else no EU VAT is due and none is added. The price of the goods is {priceNet}, and that is the figure you pay.",
        "Shipping is charged the same way. The rate is quoted before tax; for delivery inside the European Union Estonian VAT at {vatRate} is added to it, and for delivery anywhere else it is not. You see the exact amount, with any tax in it, before you pay.",
        "Which of these applies to you is worked out from the delivery address you confirm at checkout. Before you have entered one, the figure shown is chosen from the destination set on this site, which you can change; it never decides what you are charged.",
        "Business buyers: the price shown is a consumer price. Where Estonian VAT is added, the amount of it is shown separately at checkout, before you pay. If you need an invoice with the tax treatment stated for your own accounting, write to us at {merchantContactAddress} before ordering.",
      ],
      source: "price-presentation",
    },
  ],
};
