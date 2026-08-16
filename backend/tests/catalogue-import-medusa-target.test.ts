import type { MedusaContainer } from "@medusajs/framework/types";
import { describe, expect, it } from "vitest";

import { MedusaCatalogueSeedTarget } from "../src/catalogue-import/medusa-target.js";

/**
 * The two lookups that have no natural key.
 *
 * The seed records are addressed by natural keys — product by handle, price by
 * SKU and currency, coupon by code — and those were checked and are sound. The
 * default shipping profile and the default stock location
 * have none: the import asks for "a" row, and an unfiltered, unordered
 * `query.graph` returns whichever row the database hands back first, which
 * PostgreSQL promises nothing about. With one row each that is invisible; with
 * two, a rerun binds the product to a different shipping profile than the run
 * before it, and the import stops being rerunnable in the one way that matters.
 *
 * Deterministic selection is the fix rather than a refusal, because a second
 * shipping profile is a perfectly legitimate thing for an operator to have
 * created and is no reason to refuse an import.
 */

interface Rows {
  readonly [entity: string]: readonly Record<string, unknown>[];
}

function targetOver(rows: Rows): MedusaCatalogueSeedTarget {
  const query = {
    graph: ({ entity }: { entity: string }) =>
      Promise.resolve({ data: [...(rows[entity] ?? [])] }),
  };
  const container = { resolve: () => query } as unknown as MedusaContainer;
  return new MedusaCatalogueSeedTarget(container);
}

/** The lookups are private; the point of the test is that they are the real ones. */
interface Lookups {
  defaultShippingProfileId(): Promise<string>;
  defaultStockLocationId(): Promise<string>;
}

function lookups(target: MedusaCatalogueSeedTarget): Lookups {
  return target as unknown as Lookups;
}

describe("the seed target's keyless lookups", () => {
  it("binds to the same shipping profile whichever order the database returns them in", async () => {
    const forward = lookups(
      targetOver({ shipping_profile: [{ id: "sp_01" }, { id: "sp_02" }] }),
    );
    const reversed = lookups(
      targetOver({ shipping_profile: [{ id: "sp_02" }, { id: "sp_01" }] }),
    );

    expect(await forward.defaultShippingProfileId()).toBe("sp_01");
    expect(await reversed.defaultShippingProfileId()).toBe("sp_01");
  });

  it("binds to the same stock location whichever order the database returns them in", async () => {
    const forward = lookups(
      targetOver({ stock_location: [{ id: "sloc_01" }, { id: "sloc_02" }] }),
    );
    const reversed = lookups(
      targetOver({ stock_location: [{ id: "sloc_02" }, { id: "sloc_01" }] }),
    );

    expect(await forward.defaultStockLocationId()).toBe("sloc_01");
    expect(await reversed.defaultStockLocationId()).toBe("sloc_01");
  });

  it("still refuses when there is no row to bind to at all", async () => {
    await expect(lookups(targetOver({})).defaultShippingProfileId()).rejects.toThrow(
      /No shipping profile exists/,
    );
    await expect(lookups(targetOver({})).defaultStockLocationId()).rejects.toThrow(
      /No stock location exists/,
    );
  });
});
