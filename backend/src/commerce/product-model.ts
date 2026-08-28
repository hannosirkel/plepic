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
 * code, the manufacturing origin, and why that origin's format was believed
 * to be an exception to every other country code in this codebase until the
 * live carrier proved otherwise. Nothing reads this block yet; a later task
 * builds the customs declaration from it.
 */

// Extensionless on purpose, unlike the rest of `src/commerce/` (see
// `tax-model.ts`'s own `./shipping-model.js` import for the ordinary form) --
// this file is reachable from `medusa-config.ts` through ts-node by way of
// `modules/omniva/service.ts`, which `../config/runtime.ts`'s own header
// documents as evaluated literally, unable to map a `.js` suffix back onto
// the `.ts` file beside it. A `.js` here fails `medusa build` with "Cannot
// find module" for the same reason `runtime.ts` gives, and it did: this
// import shipped with a `.js` suffix for as long as nothing on this branch
// rebuilt the image, and only broke once something did.
// `tests/omniva-extensionless-imports.test.ts` guards this specific file
// from regressing the same way a second time.
import { SHIPPING_CURRENCY } from "./shipping-model";

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
 * `9504400000` is HS 9504.40 — playing cards. `CN` is where the game is
 * manufactured, and OMX makes it mandatory for United States destinations
 * specifically, because the landed cost cannot be calculated without it.
 */
export interface ProductCustoms {
  /** HS code, digits only. */
  readonly tariffNumber: string;
  /**
   * Country of manufacture, ISO 3166-1 **alpha-2** — confirmed against the
   * live carrier, 2026-08-28, not read off the manual.
   *
   * The OMX API manual for customers, v1.7, gives `customs.shipmentItems[].originCountry`
   * as `string(3)`, which every other reader of this codebase (including a
   * prior version of this very comment) took to mean ISO 3166-1 **alpha-3**.
   * **The manual is wrong.** Registering a US-bound shipment with
   * `originCountry: "CHN"` against `test-omx.omniva.eu` answers `200` with
   * `resultCode: "ERROR"` and a `failedShipments` entry carrying
   * `{jakarta.validation.constraints.Size.message}: shipment.customs.shipmentItems[0].originCountry
   * - size must be between {min} and {max}` — the same request with
   * `originCountry: "CN"`, nothing else changed, answers `200` with
   * `resultCode: "OK"` and a barcode. `string(3)` in the manual bounds the
   * field's *length*, not its standard, and two of that bound's three
   * characters are simply unused by every alpha-2 code.
   *
   * This is the third place in this module where the manual and the live API
   * disagree — see `../modules/omniva/client.ts`'s header for the other two
   * (`barcodes`, `fileData`) and the same warning: a future reader with the
   * manual open, seeing `string(3)`, will otherwise "correct" this field
   * straight back to alpha-3 and reintroduce a refusal on every non-EU order.
   * `tests/commerce-product-seed.test.ts` asserts the alpha-2 shape for
   * exactly this reason, and `tests/omniva-create-fulfillment.test.ts`'s stub
   * OMX refuses an alpha-3 `originCountry` the way the real API does.
   *
   * Every other country code in this repository — `EU_MEMBER_STATE_CODES`,
   * `PARCEL_MACHINE_COUNTRY_CODES`, `DELIVERABLE_COUNTRY_CODES` in
   * `./shipping-model.js`, every delivery address Medusa carries — is also
   * ISO 3166-1 alpha-2, so this field is no longer the exception it was
   * believed to be; it is simply consistent with the rest of this codebase.
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
    originCountry: "CN",
    goodsCategoryCode: "SALE_OF_GOODS",
  },
};
