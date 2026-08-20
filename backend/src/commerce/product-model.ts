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
 */

import { SHIPPING_CURRENCY } from "./shipping-model.js";

/** The box the one copy ships in. Grams and millimetres. */
export interface ProductPackaging {
  readonly weightGrams: number;
  readonly lengthMillimetres: number;
  readonly widthMillimetres: number;
  readonly heightMillimetres: number;
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
};
