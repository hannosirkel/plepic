/**
 * The one product this shop sells, declared here and nowhere else.
 *
 * **Lunar Base, EUR 25.00 net, one physical copy, fulfilled by hand.** Frozen by
 * the operator, like the shipping rates in {@link ./shipping-model.js} and the
 * VAT rate in {@link ./tax-model.js}, and for the same reason: a WooCommerce
 * export is the *old* shop's catalogue, and a figure that happened to differ
 * would silently reprice every order the new site takes. `npm run seed:product`
 * applies this from the predeploy Job, before any pod serves traffic and without
 * anybody staging an archive.
 *
 * ## The price is net
 *
 * {@link ProductModel.amountMinor} is EUR 25.00 **before** VAT. An EU buyer pays
 * EUR 31.00 for the goods; a buyer anywhere else pays EUR 25.00. That is the
 * operator's decision and it is what the legacy shop does — see
 * {@link ./tax-model.js} for the rate, the citation and the threshold reasoning,
 * and `src/commerce/configuration.ts` for the two price preferences that make
 * Medusa compute it.
 *
 * ## Stock is a statement, not a count
 *
 * `manageInventory` is `false`, so no inventory level is created and none is
 * needed. `storefront/src/lib/store-product.ts` resolves availability as
 * `!manageInventory || canBackorder || stock > 0`, which makes an unmanaged
 * variant `InStock` unconditionally. This is deliberate: there is one physical
 * copy and it is fulfilled by hand, so a decrementing count would be a number
 * nobody maintains and a false promise the first time it drifted.
 *
 * ## There is no media here
 *
 * The product page renders assets committed to `storefront/public`; the one
 * reader of Medusa's `images` — `productImageUrlsFromStore` — feeds a gallery
 * that page does not use. So this declares no thumbnail and no image, and
 * `./seed-product.ts` is careful to *omit* those keys rather than send empty
 * ones, which would clear media an operator had uploaded in the Admin.
 *
 * ## The packaging drives no money
 *
 * Both shipping rates are flat by destination zone, so the weight and the box
 * are recorded for the Admin and for a courier label rather than consulted by
 * any price. They are declared anyway because a product with no dimensions is a
 * product no fulfillment provider can quote if one is ever introduced.
 *
 * ## The customs facts, frozen 2026-08-26
 *
 * {@link ProductModel.customs} is the same kind of fact as the packaging: a
 * property of the physical thing rather than of any order, declared here so
 * there is exactly one place to freeze it. OMX requires all three whenever a
 * shipment's destination is outside the EU and refuses the registration if
 * they are absent or malformed — see {@link ProductCustoms} for the tariff
 * code, the manufacturing origin and why the origin is written in a different
 * standard's format from every other country code in this codebase. Nothing
 * reads this block yet; a later task builds the customs declaration from it.
 */

import { SHIPPING_CURRENCY } from "./shipping-model.js";

/** The box the one copy ships in. Grams and millimetres. */
export interface ProductPackaging {
  readonly weightGrams: number;
  readonly lengthMillimetres: number;
  readonly widthMillimetres: number;
  readonly heightMillimetres: number;
}

/**
 * What a customs declaration says about this product.
 *
 * Operator-frozen, 2026-08-26, and declared here beside the weight and the box
 * because it is the same kind of fact: a property of the thing in the parcel
 * rather than of any order. OMX requires all three whenever the destination is
 * outside the EU, and refuses the registration if they are absent or
 * malformed. Nothing consumes this block yet — a later task builds the
 * customs declaration from it.
 *
 * `9504400000` is HS 9504.40 — playing cards. `CHN` is where the game is
 * manufactured, and OMX makes it mandatory for United States destinations
 * specifically, because the landed cost cannot be calculated without it.
 */
export interface ProductCustoms {
  /** HS code, digits only. */
  readonly tariffNumber: string;
  /**
   * Country of manufacture, ISO 3166-1 **alpha-3** — OMX's format.
   *
   * Every other country code in this repository — `EU_MEMBER_STATE_CODES`,
   * `PARCEL_MACHINE_COUNTRY_CODES`, `DELIVERABLE_COUNTRY_CODES` in
   * `./shipping-model.js`, every delivery address Medusa carries — is
   * ISO 3166-1 **alpha-2**. This one field is the exception, because it feeds
   * OMX rather than Medusa, and OMX's own customs API takes alpha-3. Writing
   * "CN" here by habit is the trap this comment exists to catch: it is a
   * different standard's code for the same country, not a typo of this one,
   * so nothing that checks alpha-2 codes elsewhere in this codebase would
   * ever flag it.
   */
  readonly originCountry: string;
  readonly goodsCategoryCode: "SALE_OF_GOODS";
}

export interface ProductModel {
  /**
   * The product handle, and the natural key every upsert addresses it by.
   *
   * Unlike the configuration's display-name keys, this one is not what the Admin
   * shows, so renaming the product in the Admin does not create a second one.
   */
  readonly handle: string;
  /** What the Admin and the storefront show. */
  readonly title: string;
  /** The single variant's SKU, and the key its price and stock are addressed by. */
  readonly sku: string;
  readonly currency: string;
  /** Minor units, **net of tax**. */
  readonly amountMinor: number;
  readonly packaging: ProductPackaging;
  /** `false`: stock is a statement, never a count. See this file's header. */
  readonly manageInventory: boolean;
  /** What a customs declaration says about this product. See {@link ProductCustoms}. */
  readonly customs: ProductCustoms;
}

/** Operator-frozen. */
export const PRODUCT: ProductModel = {
  handle: "lunar-base",
  title: "Lunar Base",
  sku: "PPG01000",
  currency: SHIPPING_CURRENCY,
  amountMinor: 2500,
  packaging: {
    weightGrams: 300,
    lengthMillimetres: 120,
    widthMillimetres: 120,
    heightMillimetres: 40,
  },
  manageInventory: false,
  customs: {
    tariffNumber: "9504400000",
    originCountry: "CHN",
    goodsCategoryCode: "SALE_OF_GOODS",
  },
};
