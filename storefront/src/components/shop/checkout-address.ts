/**
 * The checkout form's address and phone validation, as pure functions over
 * `values` — no React, no DOM, no effect.
 *
 * Extracted out of `CheckoutPageContent.tsx` on 2026-08-29, fixing an
 * operator-reported defect: `storefront/` has no jsdom for that component
 * (see its own doc comment, and the handover at
 * `docs/working/2026-08-26-omniva-shipping-handover.md`), so a decision that
 * only exists as a closure inside it can only be exercised by a static
 * render, which never runs an effect and therefore never drove the delivery
 * method `<select>` this file's split was written to fix. Pulling the
 * decision out into functions of plain values is what let
 * `tests/checkout-address.test.ts` call it directly, the same reasoning
 * `src/lib/cart.ts`'s `quantityFieldReducer` doc comment gives for the
 * basket's own control.
 *
 * ## Why `validate` returns one error set but two things are "complete"
 *
 * Task 8 added a phone number, required outside Estonia, Finland, Lithuania
 * and Latvia because OMX needs one to register a shipment there. The defect
 * an operator then reported was that the phone number's error — folded into
 * the same `validate()` this module still returns — was also used to decide
 * whether the *postal* address was complete, and that boolean gated the
 * delivery method `<select>`: outside those four countries, nobody could
 * load or choose a delivery method until they had also typed a valid,
 * `+`-prefixed phone number, and an ordinary local format such as
 * `030 1234567` left them blocked with no way through.
 *
 * The phone has no bearing on which delivery methods exist or what they
 * cost — OMX needs it at *fulfilment*, not at method selection — so
 * "complete" has to mean two different things depending on who is asking:
 * {@link isPostalAddressComplete} for whether the delivery methods may load,
 * and {@link isPhoneComplete} for whether the order may be placed
 * (`orderMayBePlaced` in `../../lib/cart.js`, which is where that refusal
 * belongs — see its own doc comment). Both are read off the one
 * {@link validate} error set rather than each running their own pass over
 * `values`, so the postal fields and the phone can never be validated one way
 * for the summary a buyer sees and another way for the boolean that gates the
 * page around it.
 *
 * ## The phone field is always shown, and this is deliberate policy — not "always required"
 *
 * A second operator-reported defect, 2026-08-29: a buyer choosing an Omniva
 * parcel machine was never even *shown* a phone field, because the field was
 * hidden entirely inside Estonia, Finland, Lithuania and Latvia — the same
 * four countries OMX does not strictly require one for. `CheckoutPageContent.tsx`
 * now renders the field for every destination, so a locker buyer *can*
 * volunteer a phone number if they want one. **The requirement itself did not
 * change**: `phoneRequiredForCountryName` still decides whether its absence is
 * an error, and it is still `false` for exactly those four countries — see its
 * own doc comment. Two things were considered and rejected:
 *
 * - **Requiring a phone for every parcel machine order.** Confirmed live
 *   against Omniva's test API, 2026-08-29 (see `backend/src/modules/omniva/
 *   shipment.ts`'s own header for the endpoint and the full evidence — this
 *   package does not talk to Omniva itself, so it does not repeat that
 *   hostname): an Estonian locker registration with no phone at all,
 *   `contactEmail` only, still answers `200 OK` with a barcode. Omniva's own
 *   pickup notice reaches the buyer by email in that case, so refusing an
 *   order for lacking a phone nobody's carrier actually needs would cost
 *   orders for no benefit — the same argument this module's header already
 *   makes for not asking outside these four countries at all.
 * - **Requiring a phone everywhere** (the policy this file briefly carried
 *   earlier in this task, since reverted): rejected by the operator directly
 *   — *"Make the phone field optional. Shipments work without phone and email
 *   only, Omniva sends parcel codes there too."*
 *
 * `validate` below now checks a typed phone's `+`-prefix shape **regardless**
 * of whether the country requires one — a buyer who volunteers a number gets
 * the same cheap sanity check as one who was required to give it, because a
 * malformed voluntary value is exactly the kind of thing that would otherwise
 * reach OMX unchecked and fail a paid order at fulfilment instead of at the
 * form.
 */

import { checkout } from "../../../../content/shop.js";
import type { AddressFieldCopy } from "../../../../content/shop.js";
import { destinationForCountryName } from "../../lib/destination.js";
import { phoneRequiredForCountry } from "../../lib/store-checkout.js";

export const FIELDS: readonly AddressFieldCopy[] = checkout.address.fields;

export type AddressValues = Readonly<Record<string, string>>;

export const EMPTY_ADDRESS: AddressValues = Object.fromEntries(FIELDS.map((field) => [field.name, ""]));

/**
 * The address as `store-checkout.ts`'s `prepareGuestShipping` and
 * `addGuestShippingMethod` want it: every field present, `phone` included and
 * sent unconditionally even where it was never asked for — see
 * `GuestCheckoutAddress.phone`'s doc comment in `../../lib/store-checkout.js`
 * for why that is `addressPayload`'s decision to make, not this function's.
 */
export function guestAddress(values: AddressValues) {
  return {
    fullName: values.fullName ?? "",
    streetAddress: values.streetAddress ?? "",
    postalCode: values.postalCode ?? "",
    city: values.city ?? "",
    country: values.country ?? "",
    email: values.email ?? "",
    // "" where the field was never asked for — `addressPayload` in
    // `store-checkout.ts` sends it unconditionally either way, the same way
    // it sends every other field here.
    phone: values.phone ?? "",
  };
}

/** Deliberately permissive: enough to catch a typo, never enough to reject a real address. */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Whether the phone field is asked for, given whatever is currently typed
 * into the country field.
 *
 * `false` while no country is chosen, or the text is not one this site
 * recognises: `phoneRequiredForCountry` needs an ISO code, and an
 * unrecognised country name has none to give it. That state is not reachable
 * from the served `<select>` either way — see `zoneForCountryName`'s doc
 * comment in `../../lib/cart.js` for the same argument about the shipping
 * zone — so this is "nothing to ask about yet", not a guess dressed up as
 * one.
 *
 * One function, every call site in `CheckoutPageContent.tsx` and this module
 * alike, so the render, the validation and the reset can never disagree
 * about which countries need a phone number.
 */
export function phoneRequiredForCountryName(countryName: string): boolean {
  const trimmed = countryName.trim();
  if (trimmed.length === 0) return false;
  const destination = destinationForCountryName(trimmed);
  return destination !== null && phoneRequiredForCountry(destination.code);
}

/**
 * Every field error at once — the postal fields in {@link FIELDS} and, where
 * it is asked for, the phone. This is the **full** form: the error summary
 * and the submit-time refusal both need every one of these, keyed by field
 * name, and `phone` is the one key not drawn from {@link FIELDS}.
 *
 * Read {@link isPostalAddressComplete} and {@link isPhoneComplete} for the
 * two narrower questions this file's doc comment explains are answered from
 * this same set rather than a second validation pass.
 */
export function validate(values: AddressValues): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};

  for (const field of FIELDS) {
    const value = (values[field.name] ?? "").trim();
    if (value.length === 0) {
      // "Enter country" is an instruction nobody can follow in front of a
      // dropdown, so a chosen field asks to be chosen.
      const prefix =
        field.control === "country"
          ? checkout.errors.missingSelectionPrefix
          : checkout.errors.missingFieldPrefix;
      errors[field.name] = `${prefix}${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.type === "email" && !isPlausibleEmail(value)) {
      errors[field.name] = checkout.errors.invalidEmail;
    }
  }

  /*
   * Not one of `FIELDS`: this one is not asked of everybody the same way, so
   * it is not validated as though it were. The storefront's whole job here is
   * presence (where required) and a leading `+` — see `phoneRequiredForCountry`'s
   * doc comment for why the rest (a real national number, no special-tariff
   * range, no Baltic fixed line) is OMX's to refuse at fulfilment.
   *
   * **Shape is checked whenever anything is typed, required or not.**
   * The field is shown for every destination (see this file's header), so a
   * buyer in a phone-optional country can volunteer a number nobody asked
   * for; if they do, it gets the same `+`-prefix check as a required one,
   * because a malformed voluntary value would otherwise reach OMX unchecked.
   * Presence is checked only where {@link phoneRequiredForCountryName} says
   * OMX needs one.
   */
  const phone = (values.phone ?? "").trim();
  if (phone.length > 0 && !phone.startsWith("+")) {
    errors.phone = checkout.errors.invalidPhone;
  } else if (phone.length === 0 && phoneRequiredForCountryName(values.country ?? "")) {
    errors.phone = `${checkout.errors.missingFieldPrefix}${checkout.address.phone.label.toLowerCase()}.`;
  }

  return errors;
}

/**
 * Whether the **postal** address alone is complete — country, street,
 * postcode, city, name, email — with no regard to the phone at all.
 *
 * This is `addressComplete` in `CheckoutPageContent.tsx`: it gates the
 * delivery-method fetch, the delivery `<select>`'s disabled state, the
 * shipping zone and every Article 8(2) disclosure that depends on knowing
 * the address. It has to ignore the phone entirely, because the delivery
 * methods that exist and what they cost never depended on it — OMX only
 * needs a phone number at fulfilment — and gating the postal address on it
 * anyway is exactly the defect this function replaces: outside Estonia,
 * Finland, Lithuania and Latvia, where a phone is asked for, the delivery
 * method could not be loaded or chosen until a valid, `+`-prefixed number was
 * typed, and an ordinary local format left a buyer blocked with no way
 * through.
 *
 * Filters `validate(values)`'s keys rather than running a second pass over
 * `values` restricted to {@link FIELDS}, so the postal fields can never be
 * validated one way here and another way in the error summary — the same
 * reasoning this file's own doc comment gives for {@link isPhoneComplete}.
 */
export function isPostalAddressComplete(values: AddressValues): boolean {
  const errors = validate(values);
  return Object.keys(errors).some((key) => key !== "phone") === false;
}

/**
 * Whether the phone requirement is satisfied: not given and not required, or
 * given in the shape this form checks.
 *
 * **Not the same as "empty is always fine outside the four countries".**
 * Since the field is shown for every destination (see this file's header),
 * an unrequired phone can still be *typed* — and if it is, it must still
 * start with `+`, the same as a required one: `validate` checks shape
 * whenever anything is present, regardless of whether presence itself was
 * required. So this is `true` for an empty phone anywhere, `true` for a
 * `+`-prefixed phone anywhere, and `false` for a non-empty, non-`+`-prefixed
 * phone anywhere — the phone-optional countries only relax *presence*, never
 * shape.
 *
 * This is **not** part of {@link isPostalAddressComplete} — see this file's
 * doc comment for why the two questions are asked separately — and it is not
 * asked at all by the delivery-method fetch or the `<select>`. It exists for
 * `orderMayBePlaced` (`../../lib/cart.js`), negated into that function's
 * `phoneIncomplete`: the phone stays required to *place* an order wherever
 * OMX requires one for fulfilment, even though it stopped gating which
 * delivery methods a buyer can see or choose.
 */
export function isPhoneComplete(values: AddressValues): boolean {
  return validate(values).phone === undefined;
}
