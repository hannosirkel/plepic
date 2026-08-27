import { describe, expect, it, vi } from "vitest";

import { OMNIVA_FULFILLMENT_PROVIDER_ID } from "../src/commerce/shipping-model.js";
import {
  OmnivaLabelError,
  resolveOmnivaLabel,
  type OmnivaLabelFulfillmentRecord,
  type OmnivaLabelPort,
} from "../src/fulfillment/omniva-label.js";

const BARCODE = "CE123456789EE";

/**
 * A minimal Omniva fulfilment record, shaped exactly as
 * `../src/modules/omniva/service.ts`'s `createFulfillment` writes one:
 * `barcode` always, `label_pdf_base64` only when the label call succeeded,
 * and the parcel-machine fields only when the buyer chose a machine.
 */
function omnivaFulfillment(
  overrides: Partial<OmnivaLabelFulfillmentRecord> = {},
  dataOverrides: Record<string, unknown> = {},
): OmnivaLabelFulfillmentRecord {
  return {
    id: "ful_01JABCDEFGHJKMNPQRSTVWXYZ",
    provider_id: OMNIVA_FULFILLMENT_PROVIDER_ID,
    data: {
      barcode: BARCODE,
      parcel_machine_zip: "10145",
      parcel_machine_name: "Tallinn Kristiine",
      ...dataOverrides,
    },
    ...overrides,
  };
}

/**
 * The pieces of a {@link OmnivaLabelPort} a test actually wants to assert
 * against, kept as plain `vi.fn()` locals rather than read back off the
 * returned port -- vitest 4's `Mock` type does not survive being narrowed
 * back down to a plain function-typed interface property cleanly enough for
 * `tsc --strict`, so each test builds exactly the mocks it needs and passes
 * them in, rather than this helper trying to type a fully-mocked port.
 */
function stubPort(overrides: Partial<OmnivaLabelPort> = {}): OmnivaLabelPort {
  return {
    listFulfillments: async () => [],
    isOmnivaConfigured: () => true,
    requestLabel: async () => {
      throw new Error("requestLabel should not have been called");
    },
    storeLabel: async () => {
      throw new Error("storeLabel should not have been called");
    },
    ...overrides,
  };
}

describe("resolveOmnivaLabel: the stored-PDF path", () => {
  it("returns a stored label without calling Omniva or writing anything back", async () => {
    const fulfillment = omnivaFulfillment({}, { label_pdf_base64: "JVBERi0=" });
    const requestLabel = vi.fn();
    const storeLabel = vi.fn();
    const port = stubPort({
      listFulfillments: async () => [fulfillment],
      requestLabel,
      storeLabel,
    });

    const result = await resolveOmnivaLabel(BARCODE, port);

    expect(result).toEqual({
      barcode: BARCODE,
      fulfillmentId: fulfillment.id,
      pdfBase64: "JVBERi0=",
    });
    expect(requestLabel).not.toHaveBeenCalled();
    expect(storeLabel).not.toHaveBeenCalled();
  });

  /**
   * The ordering `resolveOmnivaLabel`'s own docstring calls out: a stored
   * label must stay downloadable even when Omniva is not (or no longer)
   * configured, because this path never has to call Omniva at all.
   */
  it("returns a stored label even when Omniva is not configured", async () => {
    const fulfillment = omnivaFulfillment({}, { label_pdf_base64: "JVBERi0=" });
    const requestLabel = vi.fn();
    const port = stubPort({
      listFulfillments: async () => [fulfillment],
      isOmnivaConfigured: () => false,
      requestLabel,
    });

    const result = await resolveOmnivaLabel(BARCODE, port);

    expect(result.pdfBase64).toBe("JVBERi0=");
    expect(requestLabel).not.toHaveBeenCalled();
  });
});

describe("resolveOmnivaLabel: the re-request path", () => {
  it("re-requests, stores, and returns a fresh label when none is stored", async () => {
    const fulfillment = omnivaFulfillment();
    const requestLabel = vi.fn(async () => "ZnJlc2gtbGFiZWw=");
    const storeLabel = vi.fn(async () => undefined);
    const port = stubPort({
      listFulfillments: async () => [fulfillment],
      requestLabel,
      storeLabel,
    });

    const result = await resolveOmnivaLabel(BARCODE, port);

    expect(result).toEqual({
      barcode: BARCODE,
      fulfillmentId: fulfillment.id,
      pdfBase64: "ZnJlc2gtbGFiZWw=",
    });
    // Called with the barcode alone -- nothing resembling a shipment
    // registration payload, which is what makes this path unable to
    // double-register a parcel: see `OmnivaLabelPort`'s own docstring.
    expect(requestLabel).toHaveBeenCalledTimes(1);
    expect(requestLabel).toHaveBeenCalledWith(BARCODE);
  });

  it("merges the fresh label onto the fulfilment's existing data, keeping the parcel machine fields", async () => {
    const fulfillment = omnivaFulfillment();
    const storeLabel = vi.fn(async () => undefined);
    const port = stubPort({
      listFulfillments: async () => [fulfillment],
      requestLabel: async () => "ZnJlc2gtbGFiZWw=",
      storeLabel,
    });

    await resolveOmnivaLabel(BARCODE, port);

    expect(storeLabel).toHaveBeenCalledWith(fulfillment.id, {
      barcode: BARCODE,
      parcel_machine_zip: "10145",
      parcel_machine_name: "Tallinn Kristiine",
      label_pdf_base64: "ZnJlc2gtbGFiZWw=",
    });
  });

  it("refuses to re-request when Omniva is not configured", async () => {
    const fulfillment = omnivaFulfillment();
    const requestLabel = vi.fn();
    const storeLabel = vi.fn();
    const port = stubPort({
      listFulfillments: async () => [fulfillment],
      isOmnivaConfigured: () => false,
      requestLabel,
      storeLabel,
    });

    const error = await resolveOmnivaLabel(BARCODE, port).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OmnivaLabelError);
    expect((error as OmnivaLabelError).code).toBe("not_configured");
    expect(requestLabel).not.toHaveBeenCalled();
    expect(storeLabel).not.toHaveBeenCalled();
  });

  it("propagates Omniva's refusal as label_request_failed, naming the barcode, and stores nothing", async () => {
    const fulfillment = omnivaFulfillment();
    const storeLabel = vi.fn();
    const port = stubPort({
      listFulfillments: async () => [fulfillment],
      requestLabel: async () => {
        throw new Error("OMX refused the label for CE123456789EE: some-code");
      },
      storeLabel,
    });

    const error = await resolveOmnivaLabel(BARCODE, port).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OmnivaLabelError);
    expect((error as OmnivaLabelError).code).toBe("label_request_failed");
    expect((error as Error).message).toContain(BARCODE);
    expect((error as Error).message).toContain("some-code");
    expect(storeLabel).not.toHaveBeenCalled();
  });
});

describe("resolveOmnivaLabel: refusals", () => {
  it("refuses an empty barcode without listing anything", async () => {
    const listFulfillments = vi.fn();
    const port = stubPort({ listFulfillments });

    const error = await resolveOmnivaLabel("   ", port).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OmnivaLabelError);
    expect((error as OmnivaLabelError).code).toBe("missing_barcode");
    expect(listFulfillments).not.toHaveBeenCalled();
  });

  it("refuses a barcode no fulfilment carries", async () => {
    const port = stubPort({
      listFulfillments: async () => [omnivaFulfillment({}, { barcode: "CE_OTHER" })],
    });

    const error = await resolveOmnivaLabel(BARCODE, port).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OmnivaLabelError);
    expect((error as OmnivaLabelError).code).toBe("unknown_barcode");
  });

  /**
   * Defensive: only `createFulfillment` ever writes `data.barcode`, and only
   * onto an Omniva fulfilment, so this case does not occur from this
   * codebase's own writers today. It is still refused by name rather than
   * answered as if the match were this barcode's real label -- see this
   * module's own header for why that distinction, not just the refusal,
   * matters.
   */
  it("refuses a fulfilment carrying this barcode whose provider is not Omniva", async () => {
    const fulfillment = omnivaFulfillment({ provider_id: "manual_manual" });
    const requestLabel = vi.fn();
    const port = stubPort({ listFulfillments: async () => [fulfillment], requestLabel });

    const error = await resolveOmnivaLabel(BARCODE, port).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OmnivaLabelError);
    expect((error as OmnivaLabelError).code).toBe("not_omniva");
    expect((error as Error).message).toContain(fulfillment.id);
    expect(requestLabel).not.toHaveBeenCalled();
  });
});
