import { describe, expect, it } from "vitest";

import OmnivaFulfillmentProviderService, {
  OMNIVA_COURIER_OPTION_ID,
  OMNIVA_PARCEL_MACHINE_OPTION_ID,
} from "../src/modules/omniva/service.js";
import type { OmnivaParcelMachine } from "../src/modules/omniva/locations.js";

const KRISTIINE: OmnivaParcelMachine = {
  zip: "10145", name: "Kristiine Keskus", group: "Harjumaa — Tallinn", countryCode: "EE",
};

function providerFinding(machines: readonly OmnivaParcelMachine[]) {
  const service = new OmnivaFulfillmentProviderService();
  service.locations = {
    find: async (zip: string) => machines.find((machine) => machine.zip === zip) ?? null,
    list: async () => machines,
  } as never;
  return service;
}

const ESTONIAN_CART = { shipping_address: { country_code: "ee" } };

describe("validating a parcel machine choice", () => {
  it("stores the ZIP and the name the buyer actually chose", async () => {
    const data = await providerFinding([KRISTIINE]).validateFulfillmentData(
      { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
      { parcel_machine_zip: "10145" },
      ESTONIAN_CART,
    );
    expect(data).toEqual({
      parcel_machine_zip: "10145",
      parcel_machine_name: "Kristiine Keskus",
    });
  });

  it("refuses a parcel machine method with no machine chosen", async () => {
    await expect(
      providerFinding([KRISTIINE]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID }, {}, ESTONIAN_CART,
      ),
    ).rejects.toThrow(/parcel machine/i);
  });

  it("refuses a ZIP that is not a machine", async () => {
    await expect(
      providerFinding([KRISTIINE]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
        { parcel_machine_zip: "00000" },
        ESTONIAN_CART,
      ),
    ).rejects.toThrow(/not an Omniva parcel machine/i);
  });

  /**
   * Every refusal in this file is written as a sentence for a shopper who is
   * still on the checkout page and can choose again. That only works if the
   * sentence reaches them: Medusa's HTTP error handler switches on
   * `err.type || err.name`, and a bare `Error` has neither, so it is
   * rewritten to "An unknown error occurred." and answered as a `500`. The
   * message assertions above pass either way, which is precisely why this
   * one asserts the `type` instead.
   */
  it("types its refusals so the shopper is shown the sentence, not a 500", async () => {
    await expect(
      providerFinding([KRISTIINE]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID }, {}, ESTONIAN_CART,
      ),
    ).rejects.toMatchObject({ type: "invalid_data" });
    await expect(
      providerFinding([KRISTIINE]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
        { parcel_machine_zip: "00000" },
        ESTONIAN_CART,
      ),
    ).rejects.toMatchObject({ type: "invalid_data" });
  });

  /**
   * A Latvian machine with an Estonian delivery address is a parcel the buyer
   * cannot collect. It is refused here rather than at the carrier, because here
   * the buyer is still on the page and can choose again.
   */
  it("refuses a machine in a different country from the delivery address", async () => {
    await expect(
      providerFinding([{ ...KRISTIINE, countryCode: "LV" }]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
        { parcel_machine_zip: "10145" },
        ESTONIAN_CART,
      ),
    ).rejects.toThrow(/delivery address/i);
  });

  it("passes courier data through untouched", async () => {
    const data = await providerFinding([]).validateFulfillmentData(
      { id: OMNIVA_COURIER_OPTION_ID }, { anything: "kept" }, ESTONIAN_CART,
    );
    expect(data).toEqual({ anything: "kept" });
  });
});
