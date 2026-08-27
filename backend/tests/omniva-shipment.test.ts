import { describe, expect, it } from "vitest";

import { buildShipmentRegistration } from "../src/modules/omniva/shipment.js";

const SENDER = {
  personName: "Plepic Games OÜ", street: "Pihlaka tn 2", deliverypoint: "Jüri alevik",
  postcode: "75301", country: "EE", phone: "+37255550100", email: "info@example.com",
} as const;

function input(overrides: Record<string, unknown> = {}) {
  return {
    customerCode: "CUSTOMER", fulfillmentId: "ful_01JABCDEFGHJKMNPQRSTVWXYZ",
    deliveryChannel: "PARCEL_MACHINE" as const, parcelMachineZip: "10145", sender: SENDER,
    order: {
      email: "buyer@example.com",
      shippingAddress: {
        firstName: "Mari", lastName: "Tamm", address1: "Tee 1",
        postalCode: "10111", city: "Tallinn", countryCode: "EE", phone: null,
      },
      items: [{ title: "Lunar Base", quantity: 1, weightGrams: 300, unitPriceNet: 25 }],
    },
    ...overrides,
  };
}

/**
 * The shape this suite asserts against, typed rather than `any`: every field
 * the tests below read, and nothing `buildShipmentRegistration` does not
 * genuinely produce. Optional fields stay optional here — `customs` and
 * `deliveryChannel` are absent on some destinations by design — so a test
 * that expects one present narrows it with `!` at the call site instead of
 * this type lying that it is always there.
 */
interface OmxShipment {
  readonly mainService: string;
  readonly deliveryChannel?: string;
  readonly servicePackage?: { readonly code: string };
  readonly contentDescription: string;
  readonly measurement: { readonly weight: number };
  readonly receiverAddressee: {
    readonly personName: string;
    readonly contactEmail: string;
    readonly contactPhone?: string;
    readonly address: {
      readonly offloadPostcode?: string;
      readonly street?: string;
      readonly postcode?: string;
      readonly city?: string;
      readonly country?: string;
    };
  };
  readonly customs?: {
    readonly goodsCategoryCode: string;
    readonly shipmentItems: readonly {
      readonly description: string;
      readonly numberOfPieces: number;
      readonly weight: number;
      readonly financialValue: number;
      readonly tariffNumber: string;
      readonly originCountry: string;
    }[];
  };
}

function shipment(body: unknown): OmxShipment {
  return (body as { shipments: readonly OmxShipment[] }).shipments[0];
}

describe("the OMX registration body", () => {
  it("registers an Estonian parcel machine against its offloadPostcode", () => {
    const one = shipment(buildShipmentRegistration(input()));
    expect(one.mainService).toBe("PARCEL");
    expect(one.deliveryChannel).toBe("PARCEL_MACHINE");
    expect(one.receiverAddressee.address.offloadPostcode).toBe("10145");
    expect(one.receiverAddressee.contactEmail).toBe("buyer@example.com");
    expect(one.measurement.weight).toBe(0.3);
    // The buyer collects from the machine; a street address alongside an
    // offloadPostcode is two destinations for one parcel.
    expect(one.receiverAddressee.address.street).toBeUndefined();
    // servicePackage is mandatory only outside EE, LV and LT, and OMX refuses
    // an attribute that exists with no value.
    expect(one.servicePackage).toBeUndefined();
    expect(one.customs).toBeUndefined();
  });

  /**
   * `deliveryChannel` is mandatory in EE/LV/LT because the country is one of
   * the three, not because the buyer picked the parcel machine method. A
   * Latvian *courier* order proves the two are independent: the destination
   * still gets `deliveryChannel`, and the address is still a street, because
   * the buyer chose courier, not a machine.
   */
  it("sends a delivery channel, not a service package, for a Latvian courier order", () => {
    const one = shipment(buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Zane", lastName: "Ozola", address1: "Brivibas iela 10", postalCode: "LV-1010",
        city: "Riga", countryCode: "LV", phone: null,
      } },
    })));
    expect(one.deliveryChannel).toBe("COURIER");
    expect(one.servicePackage).toBeUndefined();
    expect(one.receiverAddressee.address.street).toBe("Brivibas iela 10");
    expect(one.receiverAddressee.address.offloadPostcode).toBeUndefined();
    // Latvia is phone-optional; the address carries none, and that must not refuse.
    expect(one.receiverAddressee.contactPhone).toBeUndefined();
    expect(one.customs).toBeUndefined();   // Latvia is in the EU
  });

  it("sends a service package and no delivery channel for a German courier order", () => {
    const one = shipment(buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Anna", lastName: "Klein", address1: "Weg 3", postalCode: "10115",
        city: "Berlin", countryCode: "DE", phone: "+4930123456",
      } },
    })));
    expect(one.servicePackage).toEqual({ code: "ECONOMY" });
    expect(one.deliveryChannel).toBeUndefined();
    expect(one.contentDescription).toBe("Lunar Base");
    expect(one.receiverAddressee.contactPhone).toBe("+4930123456");
    expect(one.receiverAddressee.address.postcode).toBe("10115");
    expect(one.customs).toBeUndefined();   // Germany is in the EU
  });

  it("declares customs for a destination outside the EU", () => {
    const one = shipment(buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Ann", lastName: "Lee", address1: "5th Ave", postalCode: "10001",
        city: "New York", countryCode: "US", phone: "+12125550100",
      } },
    })));
    expect(one.customs!.goodsCategoryCode).toBe("SALE_OF_GOODS");
    expect(one.customs!.shipmentItems).toEqual([{
      description: "Lunar Base", numberOfPieces: 1, weight: 0.3,
      financialValue: 25, tariffNumber: "9504400000", originCountry: "CHN",
    }]);
  });

  it("refuses more customs items than OMX accepts", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      title: `Game ${String(index)}`, quantity: 1, weightGrams: 300, unitPriceNet: 25,
    }));
    expect(() => buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, items, shippingAddress: {
        firstName: "Ann", lastName: "Lee", address1: "5th Ave", postalCode: "10001",
        city: "New York", countryCode: "US", phone: "+12125550100",
      } },
    }))).toThrow(/at most 8/i);
  });

  it("refuses an item with no weight rather than inventing one", () => {
    expect(() => buildShipmentRegistration(input({
      order: { ...input().order, items: [
        { title: "Lunar Base", quantity: 1, weightGrams: null, unitPriceNet: 25 },
      ] },
    }))).toThrow(/weight/i);
  });

  it("refuses a partner shipment id OMX would truncate", () => {
    expect(() => buildShipmentRegistration(input({
      fulfillmentId: "ful_0123456789012345678901234567890",
    }))).toThrow(/30 characters/i);
  });

  it("refuses a destination outside EE, LV, LT and FI with no phone number", () => {
    expect(() => buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Anna", lastName: "Klein", address1: "Weg 3", postalCode: "10115",
        city: "Berlin", countryCode: "DE", phone: null,
      } },
    }))).toThrow(/phone/i);
  });
});
