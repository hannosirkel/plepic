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
  readonly partnerShipmentId: string;
  readonly mainService: string;
  readonly deliveryChannel?: string;
  readonly servicePackage?: { readonly code: string };
  readonly contentDescription: string;
  readonly measurement: { readonly weight: number };
  readonly receiverAddressee: {
    readonly personName: string;
    readonly contactEmail: string;
    readonly contactPhone?: string;
    readonly contactMobile?: string;
    readonly address: {
      readonly offloadPostcode?: string;
      readonly street?: string;
      readonly postcode?: string;
      // OMX's field for the receiver's city is `deliverypoint`, not `city` --
      // see shipment.ts's header on that branch. `city` is deliberately not
      // declared on this type at all, matching what `buildShipmentRegistration`
      // actually emits.
      readonly deliverypoint?: string;
      readonly country?: string;
    };
  };
  readonly senderAddressee: {
    readonly personName: string;
    readonly contactPhone: string;
    readonly contactEmail: string;
    readonly address: {
      readonly deliverypoint: string;
      readonly postcode: string;
      readonly country: string;
      readonly street?: string;
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
  it("registers an Estonian parcel machine against its offloadPostcode, with no phone at all", () => {
    const one = shipment(buildShipmentRegistration(input()));
    expect(one.mainService).toBe("PARCEL");
    expect(one.deliveryChannel).toBe("PARCEL_MACHINE");
    expect(one.receiverAddressee.address.offloadPostcode).toBe("10145");
    // `country` is mandatory on the address per the manual regardless of
    // form -- without this, every EE/LV/LT parcel machine registration would
    // be missing a required field and refused by the carrier.
    expect(one.receiverAddressee.address).toHaveProperty("country", "EE");
    expect(one.receiverAddressee.contactEmail).toBe("buyer@example.com");
    expect(one.measurement.weight).toBe(0.3);
    // The buyer collects from the machine; a street address alongside an
    // offloadPostcode is two destinations for one parcel. `toBeUndefined()`
    // cannot tell a missing key from one set to `undefined`, so the absence
    // is asserted on the key itself.
    expect(one.receiverAddressee.address).not.toHaveProperty("street");
    // servicePackage is mandatory only outside EE, LV and LT, and OMX refuses
    // an attribute that exists with no value.
    expect(one).not.toHaveProperty("servicePackage");
    expect(one).not.toHaveProperty("customs");
    // No phone at all: EE is phone-optional, `input()`'s address carries
    // `phone: null`, and this file's header explains why that is not
    // refused -- OMX itself accepts `contactEmail` alone for a locker.
    // `not.toHaveProperty`, not `toBeUndefined()`, for the same reason this
    // file's header gives at the top: the latter cannot tell a missing key
    // from one present and set to `undefined`.
    expect(one.receiverAddressee).not.toHaveProperty("contactPhone");
    expect(one.receiverAddressee).not.toHaveProperty("contactMobile");
  });

  it("sends a volunteered parcel-machine phone as contactPhone, never contactMobile", () => {
    const one = shipment(buildShipmentRegistration(input({
      order: { ...input().order, shippingAddress: {
        ...input().order.shippingAddress, phone: "+37255512345",
      } },
    })));
    // Always contactPhone -- see this file's header ("Why this always sends
    // `contactPhone`...") for the live-verified reason contactMobile is not
    // used even for a parcel machine: it type-validates a Baltic number and
    // refuses a fixed line, which contactPhone does not.
    expect(one.receiverAddressee.contactPhone).toBe("+37255512345");
    expect(one.receiverAddressee).not.toHaveProperty("contactMobile");
  });

  it("truncates a contentDescription over OMX's 1500-character bound rather than refusing it", () => {
    // Free text, not an identifier: a long run of product titles is
    // shortened, not a reason to fail a paid order.
    const longTitle = "Lunar Base ".repeat(200); // well over 1500 characters
    const one = shipment(buildShipmentRegistration(input({
      order: { ...input().order, items: [
        { title: longTitle, quantity: 1, weightGrams: 300, unitPriceNet: 25 },
      ] },
    })));
    expect(one.contentDescription.length).toBe(1500);
    expect(one.contentDescription).toBe(longTitle.slice(0, 1500));
  });

  it("sends the full senderAddressee from configuration, including its lowercase-p deliverypoint", () => {
    const one = shipment(buildShipmentRegistration(input()));
    expect(one.senderAddressee).toEqual({
      personName: "Plepic Games OÜ",
      contactPhone: "+37255550100",
      contactEmail: "info@example.com",
      address: {
        deliverypoint: "Jüri alevik",
        postcode: "75301",
        country: "EE",
        street: "Pihlaka tn 2",
      },
    });
  });

  it("omits the sender's street when the config carries none", () => {
    const one = shipment(buildShipmentRegistration(input({
      sender: { ...SENDER, street: undefined },
    })));
    expect(one.senderAddressee.address).not.toHaveProperty("street");
    expect(one.senderAddressee.address).toEqual({
      deliverypoint: "Jüri alevik", postcode: "75301", country: "EE",
    });
  });

  it("normalises a lowercase sender country the same way the receiver's is", () => {
    const one = shipment(buildShipmentRegistration(input({
      sender: { ...SENDER, country: "ee" },
    })));
    expect(one.senderAddressee.address.country).toBe("EE");
  });

  it("carries the fulfilment id and customer code through unchanged", () => {
    const body = buildShipmentRegistration(input());
    expect((body as { customerCode: string }).customerCode).toBe("CUSTOMER");
    expect(shipment(body).partnerShipmentId).toBe("ful_01JABCDEFGHJKMNPQRSTVWXYZ");
  });

  it("sums weight across quantity and distinct lines, in kilograms, to three decimals", () => {
    // 2*300 + 1*450 + 3*125 = 1425 g = 1.425 kg. Dropping "* quantity" or the
    // rounding would still pass a suite that only ever used 1 x 300 g.
    const one = shipment(buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order,
        shippingAddress: {
          firstName: "Ann", lastName: "Lee", address1: "5th Ave", postalCode: "10001",
          city: "New York", countryCode: "US", phone: "+12125550100",
        },
        items: [
          { title: "Game A", quantity: 2, weightGrams: 300, unitPriceNet: 25 },
          { title: "Game B", quantity: 1, weightGrams: 450, unitPriceNet: 30 },
          { title: "Game C", quantity: 3, weightGrams: 125, unitPriceNet: 10 },
        ],
      },
    })));
    expect(one.measurement.weight).toBe(1.425);
    expect(one.customs!.shipmentItems.map((item) => item.weight)).toEqual([0.6, 0.45, 0.375]);
  });

  /**
   * The extra refusal this builder adds beyond the brief: without it, a
   * `PARCEL_MACHINE` registration with no chosen machine would emit
   * `offloadPostcode: undefined`, which `JSON.stringify` drops, leaving an
   * address with neither an offload postcode nor a street -- a parcel
   * addressed nowhere. It must never fire for a courier order, which never
   * needs a machine ZIP at all.
   */
  it("refuses a parcel machine registration with no chosen machine, but not a courier order", () => {
    expect(() => buildShipmentRegistration(input({ parcelMachineZip: undefined })))
      .toThrow(/parcelMachineZip/);
    expect(() => buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Anna", lastName: "Klein", address1: "Weg 3", postalCode: "10115",
        city: "Berlin", countryCode: "DE", phone: "+4930123456",
      } },
    }))).not.toThrow();
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
    expect(one).not.toHaveProperty("servicePackage");
    expect(one.receiverAddressee.address.street).toBe("Brivibas iela 10");
    expect(one.receiverAddressee.address).not.toHaveProperty("offloadPostcode");
    // Defect A: OMX's field is `deliverypoint`, not `city` -- see
    // shipment.ts's header on this branch, and client.ts's header for the
    // sibling defects (B, C) this same live-API session confirmed.
    expect(one.receiverAddressee.address.deliverypoint).toBe("Riga");
    expect(one.receiverAddressee.address).not.toHaveProperty("city");
    // Latvia is phone-optional; the address carries none, and that must not refuse.
    expect(one.receiverAddressee).not.toHaveProperty("contactPhone");
    expect(one).not.toHaveProperty("customs");   // Latvia is in the EU
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
    expect(one).not.toHaveProperty("deliveryChannel");
    expect(one.contentDescription).toBe("Lunar Base");
    expect(one.receiverAddressee.contactPhone).toBe("+4930123456");
    // contactMobile is never sent by this file -- see its header ("Why this
    // always sends `contactPhone`...").
    expect(one.receiverAddressee).not.toHaveProperty("contactMobile");
    expect(one.receiverAddressee.address.postcode).toBe("10115");
    // Defect A, see the Latvian courier test above.
    expect(one.receiverAddressee.address.deliverypoint).toBe("Berlin");
    expect(one.receiverAddressee.address).not.toHaveProperty("city");
    expect(one).not.toHaveProperty("customs");   // Germany is in the EU
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
    // originCountry: "CN", alpha-2 -- not "CHN". See PRODUCT.customs.originCountry's
    // own docstring in product-model.ts: the manual's `string(3)` reads as
    // alpha-3, and is wrong; the live carrier refuses alpha-3 with a
    // jakarta.validation.constraints.Size violation and accepts alpha-2.
    expect(one.customs!.shipmentItems).toEqual([{
      description: "Lunar Base", numberOfPieces: 1, weight: 0.3,
      financialValue: 25, tariffNumber: "9504400000", originCountry: "CN",
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

  /**
   * The mirror image of the refusal just above, pinned directly: a
   * PARCEL_MACHINE registration with no phone at all must **not** be
   * refused. See this file's header ("Why this always sends `contactPhone`,
   * never `contactMobile`, and never refuses a phoneless locker order") for
   * the live confirmation this rests on -- an otherwise identical
   * registration with `contactEmail` only answered `200 OK`. Every
   * PARCEL_MACHINE_COUNTRY_CODES member (EE, LT, LV) is also in
   * PHONE_OPTIONAL_COUNTRY_CODES, so the `phoneRequired` check above was
   * already silent here; this pins that no *separate* channel-based refusal
   * was added on top of it.
   */
  it("does not refuse a parcel machine registration with no phone at all", () => {
    expect(() => buildShipmentRegistration(input())).not.toThrow();
  });
});
