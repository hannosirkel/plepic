/**
 * The OMX registration body: everything `createFulfillment` (Task 10) needs
 * to hand Omniva a single shipment, and nothing this function cannot decide
 * on its own from the order, the fulfilment and the frozen commerce models.
 *
 * **Pure, and deliberately so.** It touches no network, reads no environment
 * and calls no clock — every branch below is reachable from a plain object
 * literal, which is what lets `tests/omniva-shipment.test.ts` exercise all of
 * them without a stub OMX server. `client.ts` (Task 10) is the one place that
 * actually calls Omniva; this file only decides what to say.
 *
 * ## Every field here is conditional, and the condition is the point
 *
 * The OMX API manual v1.7 is explicit that an attribute with no value must
 * not exist in the message *at all* — not `null`, not `""`, not present with
 * `undefined`. So every optional key below is added with a conditional
 * spread (`...(condition ? { key: value } : {})`) rather than written as
 * `key: condition ? value : undefined`. `JSON.stringify` happens to drop
 * `undefined` values too, which would make the wrong version *look* right in
 * a test that only inspects the serialised JSON — and `Object.is(actual,
 * undefined)`, which is what Vitest's `toBeUndefined()` runs, is exactly as
 * blind: it passes identically for a missing key and for one set to
 * `undefined`. `tests/omniva-shipment.test.ts` asserts key *presence* with
 * `toHaveProperty`/`not.toHaveProperty` wherever that distinction is the
 * point, for this reason.
 *
 * ## Two country sets decide two different things, and they are not the same set
 *
 * {@link PARCEL_MACHINE_COUNTRY_CODES} (EE, LT, LV) decides whether
 * `deliveryChannel` or `servicePackage` is sent — OMX makes the former
 * mandatory there and the latter mandatory everywhere else.
 * {@link PHONE_OPTIONAL_COUNTRY_CODES} (EE, FI, LT, LV) decides whether a
 * receiver phone is mandatory at all — Finland is in this set and out of
 * the other one, which is `shipping-model.ts`'s own reason for keeping the
 * two constants apart rather than naming either of them after a region.
 * {@link EU_MEMBER_STATE_CODES} decides a third, unrelated thing: whether a
 * `customs` block is sent at all.
 *
 * ## Why this always sends `contactPhone`, never `contactMobile`, and never refuses a phoneless locker order
 *
 * This file briefly required a phone for every `PARCEL_MACHINE` registration
 * and sent it as `contactMobile` rather than `contactPhone`. Both were
 * retracted by the operator, 2026-08-29, directly: *"Make the phone field
 * optional. Shipments work without phone and email only, Omniva sends parcel
 * codes there too."* Three live probes against `test-omx.omniva.eu` back
 * that instruction and shape what this file does instead:
 *
 * 1. **A locker registration with no phone at all genuinely succeeds.** An
 *    Estonian `PARCEL_MACHINE` registration carrying only `contactEmail`
 *    (always sent — see `receiverAddressee` below) answered `200 OK` with a
 *    barcode (`CC405869806EE`). The OMX manual's own rule agrees:
 *    `receiverAddressee/contactEmail` is "mandatory if: … Delivery channel
 *    is PARCEL_MACHINE and contactMobile is missing" — email is the
 *    documented fallback, not a workaround. So this file does **not** refuse
 *    a phoneless parcel-machine registration: OMX notifies the buyer by
 *    email in that case, which is the outcome the operator chose over
 *    blocking the order for a number nobody's carrier strictly needs.
 * 2. **`contactMobile` type-validates a Baltic number and refuses a fixed
 *    line; `contactPhone` does not.** Sending the identical landline
 *    `+37266012345` to the same locker as `contactMobile` answered `200`
 *    with `resultCode: "ERROR"` and a `failedShipments` entry naming the
 *    field (`Invalid mobile phone number: +37266012345`); the same number as
 *    `contactPhone` answered `200 OK` (`CC405869797EE`). So switching a
 *    volunteered phone to `contactMobile` would turn a buyer's helpfulness
 *    (typing their landline) into a paid order refused at fulfilment. This
 *    file always sends a supplied phone as `contactPhone` for exactly that
 *    reason — the trade-off is that Omniva's pickup notice for a locker
 *    order goes out by email rather than SMS, which is the outcome the
 *    operator explicitly chose over risking that refusal. A future reader
 *    who wants SMS notice back should read this paragraph before switching
 *    to `contactMobile`: the type-validation above is the price of it, and
 *    it is not optional the way requiring a phone is — OMX enforces it
 *    server-side regardless of what this file wants.
 * 3. **Outside the four phone-optional countries, OMX itself requires the
 *    field, independent of this file's own refusal below.** A courier order
 *    to Germany and to the United States, both with no phone, each answered
 *    `200` with `resultCode: "ERROR"` and `failedShipments` entries reading
 *    `contactPhone - contact.number.must.exist; contactMobile -
 *    contact.number.must.exist`. This is live confirmation of the rule
 *    {@link PHONE_OPTIONAL_COUNTRY_CODES} already encoded from the manual,
 *    not a new one — it is why the `phoneRequired` refusal below stays
 *    exactly as it was, and why "the phone is optional" is true only for a
 *    parcel machine, never for a courier order outside those four countries.
 *
 * `client.ts`'s `registerShipment` throws OMX's `failedShipments[0]`
 * `messageCode`/`message` verbatim and unwrapped, with no `catch` around the
 * call in `service.ts` — confirmed by reading both files, not assumed — so
 * whichever of the messages above actually fires reaches the operator
 * reading a failed fulfilment exactly as OMX phrased it, not a generic "OMX
 * refused" summary.
 */

// Extensionless: see the comment on `index.ts`'s import of `./service`. Both
// of these are reached through the same MikroORM type-generation path.
import {
  EU_MEMBER_STATE_CODES,
  PARCEL_MACHINE_COUNTRY_CODES,
  PHONE_OPTIONAL_COUNTRY_CODES,
} from "../../commerce/shipping-model";
import { PRODUCT } from "../../commerce/product-model";

/**
 * The merchant side of every OMX registration, read from the environment by
 * `config.ts` (Task 10) into exactly this shape.
 *
 * Declared here rather than in `config.ts`, per controller ruling R3:
 * `shipment.ts` is the pure module that defines what a registration needs,
 * and `config.ts` merely reads an environment into that shape — the
 * dependency runs from the config to the shipment builder, never the other
 * way, so the type that describes the shape lives on the builder's side.
 *
 * `street` is the only optional field: OMX requires sender `deliverypoint`
 * (the city), `postcode` and `country`, and documents the street as
 * optional. `phone` and `email` are mandatory for the same reason the
 * receiver's are — see {@link PHONE_OPTIONAL_COUNTRY_CODES} — but the
 * merchant's own destination-independent phone is supplied once, here,
 * rather than looked up per shipment.
 *
 * `deliverypoint` is spelled exactly as OMX's manual spells it — one word,
 * lowercase `p` — deliberately not renamed to `deliveryPoint` to match its
 * camelCase neighbours. It is the field name the wire format sends, and
 * `tests/omniva-shipment.test.ts` asserts the full `senderAddressee` object
 * with `toEqual` for exactly this reason: a typo here fails every
 * registration the moment `client.ts` (Task 10) sends it, and nothing about
 * TypeScript's structural typing would catch a wrong string key at compile
 * time.
 */
export interface OmnivaSenderConfig {
  readonly personName: string;
  readonly street?: string;
  readonly deliverypoint: string;
  readonly postcode: string;
  readonly country: string;
  readonly phone: string;
  readonly email: string;
}

/** One line item, exactly as Medusa's order and fulfilment carry it. */
interface RegistrationOrderItem {
  readonly title: string;
  readonly quantity: number;
  /**
   * Grams, or `null` when the Medusa variant carries none. `null` is refused
   * rather than defaulted — see {@link requireWeightGrams}.
   */
  readonly weightGrams: number | null;
  /** Net of tax, per unit — what `customs.shipmentItems[].financialValue` wants. */
  readonly unitPriceNet: number;
}

/** Everything `buildShipmentRegistration` needs to build one OMX shipment. */
export interface ShipmentRegistrationInput {
  readonly customerCode: string;
  /** The Medusa fulfilment id. Becomes `partnerShipmentId`; see its length check below. */
  readonly fulfillmentId: string;
  /** The channel the buyer's chosen method registers as. */
  readonly deliveryChannel: "PARCEL_MACHINE" | "COURIER";
  /** The chosen machine's ZIP. Required when {@link deliveryChannel} is `"PARCEL_MACHINE"`. */
  readonly parcelMachineZip?: string;
  readonly sender: OmnivaSenderConfig;
  readonly order: {
    readonly email: string;
    readonly shippingAddress: {
      readonly firstName: string;
      readonly lastName: string;
      readonly address1: string;
      readonly postalCode: string;
      readonly city: string;
      readonly countryCode: string;
      readonly phone: string | null;
    };
    readonly items: readonly RegistrationOrderItem[];
  };
}

/**
 * OMX bounds `partnerShipmentId` at `string(30)`. A Medusa fulfilment id is
 * `ful_` plus a 26-character ULID — exactly 30 — but that arithmetic is not
 * asserted anywhere Medusa promises to keep it true, so this builder checks
 * the actual length rather than trusting it to survive a Medusa upgrade.
 */
const PARTNER_SHIPMENT_ID_MAX_LENGTH = 30;

/** OMX accepts at most 8 `customs.shipmentItems` entries per shipment. */
const MAX_CUSTOMS_ITEMS = 8;

/** OMX bounds `contentDescription` at `string(1500)`. See its truncation below for why. */
const MAX_CONTENT_DESCRIPTION_LENGTH = 1500;

/** Kilograms, rounded to three decimals — the precision OMX's `measurement.weight` takes. */
function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * An item's weight in grams, or a refusal naming the item.
 *
 * **Refuses rather than defaults.** A `null` weight means the Medusa variant
 * was never given one; substituting a placeholder would register a real
 * parcel at a fictitious weight, which is a carrier billing dispute an
 * operator discovers after the parcel has shipped, not a rendering bug they
 * can shrug off.
 */
function requireWeightGrams(item: RegistrationOrderItem): number {
  if (item.weightGrams === null) {
    throw new Error(
      `"${item.title}" has no recorded weight; refusing to register an Omniva shipment at a weight nobody measured`,
    );
  }
  return item.weightGrams;
}

/**
 * The JSON body for one OMX shipment registration.
 *
 * Touches no network — see this file's header. Every refusal below names the
 * field and, where useful, the offending value, because the reader is an
 * operator deciding what to do about one stuck order in the Medusa Admin, not
 * a developer with a stack trace.
 */
export function buildShipmentRegistration(input: ShipmentRegistrationInput): unknown {
  const { order, sender } = input;
  const { shippingAddress, items } = order;
  const countryCode = shippingAddress.countryCode.trim().toUpperCase();

  if (input.fulfillmentId.length > PARTNER_SHIPMENT_ID_MAX_LENGTH) {
    throw new Error(
      `OMX bounds partnerShipmentId at ${PARTNER_SHIPMENT_ID_MAX_LENGTH} characters; ` +
        `"${input.fulfillmentId}" is ${input.fulfillmentId.length}`,
    );
  }

  // measurement.weight: the sum of every line's weight * quantity, refusing
  // before anything else is computed from an item OMX cannot be told a real
  // weight for.
  const totalWeightGrams = items.reduce(
    (sum, item) => sum + requireWeightGrams(item) * item.quantity,
    0,
  );
  const weightKilograms = roundToThreeDecimals(totalWeightGrams / 1000);

  // contentDescription: the order's *distinct* item titles — two units of the
  // same game is one description, not two. Truncated, not refused, above the
  // manual's string(1500): this is free text describing what is in the box,
  // not an identifier a mismatch could corrupt, and refusing a paid order
  // because its product titles happen to be long would be a worse outcome
  // than the carrier seeing a shortened description.
  const contentDescription = Array.from(new Set(items.map((item) => item.title)))
    .join(", ")
    .slice(0, MAX_CONTENT_DESCRIPTION_LENGTH);

  // The receiver address always carries `country` — mandatory per the
  // manual regardless of address form — plus either `offloadPostcode` alone
  // or `street`/`postcode`/`deliverypoint` alone, never both: a street
  // address alongside an offloadPostcode is two destinations for one
  // parcel. Which of the two applies follows the delivery channel the buyer
  // actually chose, not the destination country: a courier order to a
  // parcel-machine country still ships to a street.
  //
  // **`deliverypoint`, not `city`.** OMX's manual (line 519-526) names the
  // field `deliverypoint` for exactly this address form -- "City, small
  // town, village, rural municipality, county" -- and there is no `city`
  // field anywhere in the OMX schema. This branch used to send `city`; OMX's
  // real test environment answered with `500` and `Unrecognized field
  // "city" (class ...OffLoadSupportedAddressDto), not marked as ignorable`.
  // Sending `deliverypoint` for an otherwise-identical request answered
  // `200 OK` with `resultCode: "OK"` and a barcode. This is not a manual
  // discrepancy the way client.ts's `barcodes` and `fileData` are -- the
  // manual was right all along -- it was a plain slip in this branch, caught
  // only by calling the real API rather than by reading. The sender branch a
  // few lines below (`senderAddressee.address.deliverypoint`) always had
  // this right; see its own docstring on {@link OmnivaSenderConfig}.
  //
  // A parcel machine registration requires a chosen machine's ZIP. Refusing
  // its absence here, rather than letting it through, matters because the
  // alternative is not "no destination" but a silently wrong one:
  // `offloadPostcode: undefined` would be dropped by the eventual
  // JSON.stringify, leaving an address with no offloadPostcode AND no street
  // — a parcel addressed nowhere at all, which is worse than refusing it at
  // fulfilment.
  let receiverAddress: Record<string, unknown>;
  if (input.deliveryChannel === "PARCEL_MACHINE") {
    if (typeof input.parcelMachineZip !== "string" || input.parcelMachineZip.trim().length === 0) {
      throw new Error(
        "A parcel machine registration requires parcelMachineZip, and none was supplied",
      );
    }
    receiverAddress = { offloadPostcode: input.parcelMachineZip, country: countryCode };
  } else {
    receiverAddress = {
      street: shippingAddress.address1,
      postcode: shippingAddress.postalCode,
      deliverypoint: shippingAddress.city,
      country: countryCode,
    };
  }

  // contactPhone: sent, trimmed, when present, and mandatory outside the
  // four countries OMX exempts -- see this file's header
  // ("Why this always sends `contactPhone`...") for why that requirement
  // does NOT extend to a phoneless PARCEL_MACHINE registration: OMX itself
  // accepts `contactEmail` alone there (live-confirmed `200 OK`), so this
  // file does not add a refusal OMX's own rule does not ask for. Checked
  // here, on the *destination*, and not conflated with
  // PARCEL_MACHINE_COUNTRY_CODES — Finland is phone-optional and carries no
  // parcel machines at all. The same trimmed value backs both the presence
  // check and the emitted key, so a phone of all whitespace is treated as
  // absent in both places rather than refused here and sent blank there.
  const phoneRequired = !PHONE_OPTIONAL_COUNTRY_CODES.includes(countryCode);
  const trimmedPhone = shippingAddress.phone?.trim() ?? "";
  if (phoneRequired && trimmedPhone.length === 0) {
    throw new Error(
      `OMX requires a receiver phone number for deliveries to ${countryCode}, ` +
        "and this order's shipping address has none",
    );
  }

  // Always `contactPhone`, never `contactMobile` -- see this file's header
  // for why: `contactMobile` type-validates a Baltic number and refuses a
  // fixed line, live-confirmed, and this file would rather a buyer's
  // volunteered landline reach OMX successfully (and Omniva notify by email)
  // than have that same helpfulness turn a paid parcel-machine order into a
  // fulfilment refusal.
  const receiverAddressee: Record<string, unknown> = {
    personName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
    contactEmail: order.email,
    ...(trimmedPhone.length > 0 ? { contactPhone: trimmedPhone } : {}),
    address: receiverAddress,
  };

  // senderAddressee: from configuration. deliverypoint (city), postcode and
  // country are mandatory per the manual; street is optional, so it is only
  // added when the config actually carries one. `country` is normalised the
  // same way the receiver's is — a config value typed as `string` carries no
  // guarantee of case, and OMX's alpha-2 codes are upper case.
  const senderAddressee = {
    personName: sender.personName,
    contactPhone: sender.phone,
    contactEmail: sender.email,
    address: {
      deliverypoint: sender.deliverypoint,
      postcode: sender.postcode,
      country: sender.country.trim().toUpperCase(),
      ...(sender.street ? { street: sender.street } : {}),
    },
  };

  // customs: only outside the EU, capped at 8 items and refused rather than
  // truncated above that, because silently dropping a line item is a
  // customer's paid-for game that never gets declared.
  const requiresCustoms = !EU_MEMBER_STATE_CODES.includes(countryCode);
  let customs: Record<string, unknown> | undefined;
  if (requiresCustoms) {
    if (items.length > MAX_CUSTOMS_ITEMS) {
      throw new Error(
        `OMX accepts at most ${MAX_CUSTOMS_ITEMS} customs items per shipment; this order has ${items.length}`,
      );
    }
    customs = {
      goodsCategoryCode: PRODUCT.customs.goodsCategoryCode,
      shipmentItems: items.map((item) => ({
        description: item.title,
        numberOfPieces: item.quantity,
        weight: roundToThreeDecimals((requireWeightGrams(item) * item.quantity) / 1000),
        financialValue: item.unitPriceNet,
        tariffNumber: PRODUCT.customs.tariffNumber,
        originCountry: PRODUCT.customs.originCountry,
      })),
    };
  }

  // deliveryChannel is mandatory in EE/LV/LT and must not exist elsewhere;
  // servicePackage is the reverse. OMX refuses an attribute that is present
  // with no value, which is why exactly one of these two branches ever
  // contributes a key, and the other contributes none at all.
  const isParcelMachineCountry = PARCEL_MACHINE_COUNTRY_CODES.includes(countryCode);

  const shipment: Record<string, unknown> = {
    partnerShipmentId: input.fulfillmentId,
    mainService: "PARCEL",
    ...(isParcelMachineCountry
      ? { deliveryChannel: input.deliveryChannel }
      : { servicePackage: { code: "ECONOMY" } }),
    contentDescription,
    measurement: { weight: weightKilograms },
    receiverAddressee,
    senderAddressee,
    ...(customs ? { customs } : {}),
  };

  return {
    customerCode: input.customerCode,
    shipments: [shipment],
  };
}
