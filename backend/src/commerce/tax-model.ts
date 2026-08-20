/**
 * The tax model this deployment charges, declared here and nowhere else.
 *
 * **EUR 25.00 is the net price. VAT is added.** That is the operator's settled
 * decision and it is what the legacy shop does — the old site advertises a
 * figure and adds tax at checkout — so the migration keeps the buyer's
 * experience and the merchant's take unchanged rather than quietly converting
 * one into the other. The same rule applies to delivery: the EUR 7.00 EU
 * shipping rate in {@link ./shipping-model.js} is net too, and grosses with the
 * goods, so an EU buyer pays EUR 8.68 for it. Applying the operator's rule
 * uniformly is the point; a net product price beside a gross shipping price
 * would be two commercial models in one basket.
 *
 * ## The rate is 24 %, and it has been since 1 July 2025
 *
 * The Estonian Tax and Customs Board (Maksu- ja Tolliamet), *VAT rates and
 * supply exempt from tax — standard VAT rate*: *"From 1 July 2025, the standard
 * rate of VAT in Estonia is 24% instead of 22%."* The 22 % rate had itself
 * applied only since 1 January 2024, having replaced 20 %.
 * <https://www.emta.ee/en/business-client/taxes-and-payment/value-added-tax/vat-rates-and-supply-exempt-tax/standard-vat-rate>
 *
 * The date matters as much as the figure. A reader who remembers Estonian VAT
 * as 20 % or 22 % is remembering a rate that was correct within the last two
 * years, so "22" here would not look wrong to anybody — which is exactly why the
 * rise is written down beside the number rather than left to be recalled.
 *
 * ## Why one rate and not twenty-seven
 *
 * Every EU destination is charged **Estonia's domestic rate**, not the
 * destination's. Below the EUR 10,000 per-year intra-Community distance-selling
 * threshold a supplier established in one member state charges its own country's
 * VAT on B2C supplies to consumers in the others, and registers for One Stop
 * Shop only on crossing it. This shop is a single board game sold from Estonia
 * and is far below that threshold. Crossing it is a commercial event with an
 * administrative answer — an OSS registration, and destination rates — and it is
 * a change to *this file*, not something a rate table should silently
 * anticipate.
 *
 * ## No VAT outside the EU
 *
 * There is deliberately no rest-of-world tax region. An export carries no EU VAT
 * at all, and a destination with no tax region resolves, through Medusa's
 * `automatic_taxes`, to a cart with no tax line — which is the correct answer
 * rather than an omission. `content/legal/shipping.ts` already says as much:
 * *"including where no VAT is due at all"*.
 *
 * ## One definition of "the EU"
 *
 * {@link VAT_COUNTRY_CODES} is {@link EU_MEMBER_STATE_CODES} itself, re-exported
 * rather than restated. Two lists of the member states that could drift apart is
 * the same defect as two writers of one price: the shipping zone a country falls
 * in and the VAT it is charged would begin to disagree, and an order would be
 * zoned by one list and taxed by the other. There is one list, in
 * {@link ./shipping-model.js}, and an accession is a change to it alone.
 */

import { EU_MEMBER_STATE_CODES } from "./shipping-model.js";

/**
 * Estonia's standard VAT rate, as a percentage.
 *
 * 24 % since 1 July 2025, up from 22 %. See this file's header for the Estonian
 * Tax and Customs Board citation — and change both together, because the header
 * is the only thing that says which rate a reader is looking at.
 */
export const ESTONIAN_STANDARD_VAT_PERCENT = 24;

/** What the Admin shows an operator against this rate. */
export const VAT_RATE_NAME = "Estonian VAT";

/**
 * The rate's code, and the natural key its upsert addresses within a tax region.
 *
 * `src/commerce/medusa-target.ts` looks the rate up by `tax_region_id` **and**
 * `code`, so changing this string does not rename a rate — it creates a second
 * one beside the first, and Medusa would then have two default rates in one
 * region to choose between.
 */
export const VAT_RATE_CODE = "EE-VAT";

/**
 * The countries this deployment charges VAT in: the 27 EU member states.
 *
 * Re-exported from the shipping model rather than declared again. See this
 * file's header for why there may be only one such list.
 */
export const VAT_COUNTRY_CODES: readonly string[] = EU_MEMBER_STATE_CODES;

/**
 * The VAT rate a delivery address is charged, or `null` where none is due.
 *
 * `null` rather than `0`, and the difference is not pedantry: zero-rated and
 * outside-the-scope are different things to a tax authority, and this model only
 * ever means the second. A destination outside the EU is not charged 0 % EU VAT;
 * no EU VAT arises at all, and Medusa expresses that as a cart with no tax line
 * rather than as a line of zero.
 *
 * It never guesses, for the reason `shippingZoneForCountry` never guesses: the
 * country code reaching it comes from a selection over a fixed list, so anything
 * else is a value no form could have produced.
 */
export function vatPercentForCountry(countryCode: string): number | null {
  const code = countryCode.trim().toUpperCase();
  if (code.length === 0) return null;
  return VAT_COUNTRY_CODES.includes(code) ? ESTONIAN_STANDARD_VAT_PERCENT : null;
}
