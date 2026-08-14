import { describe, expect, it } from "vitest";

import { medusaMajorToMinor, minorToMedusaMajor } from "../src/lib/store-money.js";

describe("Medusa money boundary", () => {
  it("converts EUR major units to the storefront minor-unit model", () => {
    expect(medusaMajorToMinor(25, "EUR")).toBe(2500);
    expect(medusaMajorToMinor(25.99, "eur")).toBe(2599);
    expect(medusaMajorToMinor(0, "EUR")).toBe(0);
  });

  it("converts displayed minor units back to Medusa major units", () => {
    expect(minorToMedusaMajor(3200, "EUR")).toBe(32);
    expect(minorToMedusaMajor(2599, "eur")).toBe(25.99);
  });

  it("rejects unsupported, negative, unsafe, and over-precise values", () => {
    expect(() => medusaMajorToMinor(1.001, "EUR")).toThrow(/money amount/);
    expect(() => medusaMajorToMinor(-1, "EUR")).toThrow(/money amount/);
    expect(() => medusaMajorToMinor(Number.MAX_SAFE_INTEGER, "EUR")).toThrow(/money amount/);
    expect(() => medusaMajorToMinor(1, "USD")).toThrow(/currency/);
    expect(() => minorToMedusaMajor(1.5, "EUR")).toThrow(/money amount/);
  });
});
