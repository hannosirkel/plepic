/**
 * `CheckoutPageContent.tsx`'s address and phone validation, driven directly —
 * the pure functions `src/components/shop/checkout-address.ts` extracts, for
 * exactly the reason its own doc comment gives: `storefront/` has no jsdom
 * for that component, so a decision that only lived inside it could only be
 * reached by a static render, which never runs an effect and so never
 * exercised the delivery-method `<select>` this split fixes.
 *
 * ## The defect this file is written to catch again
 *
 * Task 8 made a phone number mandatory outside Estonia, Finland, Lithuania
 * and Latvia. The regression an operator then reported was that the same
 * completeness check gated *both* the postal address and the phone: outside
 * those four countries, a delivery method could not be loaded or chosen
 * until a valid, `+`-prefixed phone number was typed, and an ordinary local
 * format such as `030 1234567` left a buyer blocked with no way through. The
 * phone has no bearing on which delivery methods exist or what they cost —
 * OMX only needs one at fulfilment — so `isPostalAddressComplete` must stay
 * `true` with the postal fields alone, and the phone requirement must live
 * only in `isPhoneComplete` (which feeds `orderMayBePlaced`'s
 * `phoneIncomplete`, tested in `tests/shop-pages.test.tsx`).
 *
 * Each assertion below was checked killable the way the fix report states:
 * reverting `isPostalAddressComplete` to the pre-fix `validate(values)`
 * (unfiltered) turns "postal complete outside the four, with no phone
 * typed" false again, which is exactly the case
 * "loads once the postal address is complete, regardless of the phone"
 * exists to pin.
 */
import { describe, expect, it } from "vitest";

import {
  EMPTY_ADDRESS,
  FIELDS,
  guestAddress,
  isPhoneComplete,
  isPostalAddressComplete,
  phoneRequiredForCountryName,
  validate,
  type AddressValues,
} from "../src/components/shop/checkout-address.js";

/** Not one of the four OMX exempts. */
const PHONE_REQUIRING_COUNTRY = "Germany";
/** One of the four OMX exempts. */
const PHONE_EXEMPT_COUNTRY = "Estonia";

/** A complete postal address for `country`, with `phone` left out entirely unless given. */
function postalAddress(country: string, phone?: string): AddressValues {
  const base: Record<string, string> = {
    fullName: "Name",
    streetAddress: "Street and number",
    postalCode: "00000",
    city: "Town",
    country,
    email: "example@example.com",
  };
  if (phone !== undefined) base.phone = phone;
  return base;
}

describe("FIELDS and EMPTY_ADDRESS", () => {
  it("starts every field empty, with no invented value", () => {
    for (const field of FIELDS) {
      expect(EMPTY_ADDRESS[field.name]).toBe("");
    }
  });
});

describe("guestAddress", () => {
  it("carries every postal field and the phone, defaulting anything missing to \"\"", () => {
    expect(guestAddress({})).toEqual({
      fullName: "",
      streetAddress: "",
      postalCode: "",
      city: "",
      country: "",
      email: "",
      phone: "",
    });
  });

  it("passes given values through unchanged", () => {
    const address = postalAddress(PHONE_REQUIRING_COUNTRY, "+49 30 1234567");
    expect(guestAddress(address)).toEqual({
      fullName: "Name",
      streetAddress: "Street and number",
      postalCode: "00000",
      city: "Town",
      country: PHONE_REQUIRING_COUNTRY,
      email: "example@example.com",
      phone: "+49 30 1234567",
    });
  });
});

describe("phoneRequiredForCountryName", () => {
  it("is false for an empty or unchosen country", () => {
    expect(phoneRequiredForCountryName("")).toBe(false);
    expect(phoneRequiredForCountryName("   ")).toBe(false);
  });

  it("is false for the four OMX exempts, and true otherwise", () => {
    for (const country of ["Estonia", "Finland", "Lithuania", "Latvia"]) {
      expect(phoneRequiredForCountryName(country), country).toBe(false);
    }
    expect(phoneRequiredForCountryName(PHONE_REQUIRING_COUNTRY)).toBe(true);
  });

  /*
   * Not reachable through the served `<select>`, which only ever offers a
   * value out of `deliveryCountries` — see this function's own doc comment,
   * which gives the same argument `zoneForCountryName` in `src/lib/cart.ts`
   * makes about the shipping zone. "Nothing to ask about yet" rather than a
   * guess, so this is `false`, not a defensive `true`.
   */
  it("asks for nothing from a country this site does not recognise — that state is unreachable from the form", () => {
    expect(phoneRequiredForCountryName("Nowhereland")).toBe(false);
  });
});

describe("validate — the full error set, postal fields and phone together", () => {
  it("flags every empty postal field", () => {
    const errors = validate(EMPTY_ADDRESS);
    for (const field of FIELDS) {
      expect(errors[field.name], field.name).toBeDefined();
    }
    // No country chosen: the phone question is not reached at all.
    expect(errors.phone).toBeUndefined();
  });

  it("does not ask for a phone where OMX does not require one", () => {
    const errors = validate(postalAddress(PHONE_EXEMPT_COUNTRY));
    expect(errors).toEqual({});
  });

  it("flags a missing phone where OMX requires one", () => {
    const errors = validate(postalAddress(PHONE_REQUIRING_COUNTRY));
    expect(errors.phone).toBeDefined();
  });

  it("flags a phone with no leading +", () => {
    const errors = validate(postalAddress(PHONE_REQUIRING_COUNTRY, "030 1234567"));
    expect(errors.phone).toBeDefined();
  });

  it("accepts a +-prefixed phone, and only that", () => {
    const errors = validate(postalAddress(PHONE_REQUIRING_COUNTRY, "+49 30 1234567"));
    expect(errors.phone).toBeUndefined();
  });
});

describe("isPostalAddressComplete — the fix: independent of the phone", () => {
  it("is false for the empty address", () => {
    expect(isPostalAddressComplete(EMPTY_ADDRESS)).toBe(false);
  });

  it("is true for a complete postal address in a country OMX exempts from a phone", () => {
    expect(isPostalAddressComplete(postalAddress(PHONE_EXEMPT_COUNTRY))).toBe(true);
  });

  /**
   * The regression itself, pinned directly: a country outside the four,
   * postal fields all filled, **no phone typed at all**. Before the fix this
   * was `false`, which is what left the delivery method `<select>` unable to
   * load or ever become selectable.
   */
  it("is true for a complete postal address in a country OMX requires a phone for, even with no phone given", () => {
    expect(isPostalAddressComplete(postalAddress(PHONE_REQUIRING_COUNTRY))).toBe(true);
  });

  it("stays true even for a phone this form would reject — presence of a postal address is all it asks", () => {
    expect(isPostalAddressComplete(postalAddress(PHONE_REQUIRING_COUNTRY, "030 1234567"))).toBe(
      true,
    );
  });

  it("is false if any single postal field is missing, phone or no phone", () => {
    const address = postalAddress(PHONE_REQUIRING_COUNTRY, "+49 30 1234567");
    const withoutCity = Object.fromEntries(
      Object.entries(address).filter(([name]) => name !== "city"),
    );
    expect(isPostalAddressComplete(withoutCity)).toBe(false);
  });
});

describe("isPhoneComplete — the other half: where the requirement actually lives now", () => {
  it("is true wherever OMX does not require a phone, regardless of what was typed", () => {
    expect(isPhoneComplete(postalAddress(PHONE_EXEMPT_COUNTRY))).toBe(true);
    expect(isPhoneComplete(postalAddress(PHONE_EXEMPT_COUNTRY, "not a phone number"))).toBe(true);
  });

  it("is false where OMX requires a phone and none, or an invalid one, was given", () => {
    expect(isPhoneComplete(postalAddress(PHONE_REQUIRING_COUNTRY))).toBe(false);
    expect(isPhoneComplete(postalAddress(PHONE_REQUIRING_COUNTRY, "030 1234567"))).toBe(false);
  });

  it("is true once a +-prefixed phone is given where one is required", () => {
    expect(isPhoneComplete(postalAddress(PHONE_REQUIRING_COUNTRY, "+49 30 1234567"))).toBe(true);
  });

  /**
   * The two halves are independent: a postal address can be complete while
   * the phone is not, and that combination is exactly the state
   * `orderMayBePlaced`'s `phoneIncomplete` refusal exists for.
   */
  it("can be false while isPostalAddressComplete is true, for the same values", () => {
    const address = postalAddress(PHONE_REQUIRING_COUNTRY);
    expect(isPostalAddressComplete(address)).toBe(true);
    expect(isPhoneComplete(address)).toBe(false);
  });
});
