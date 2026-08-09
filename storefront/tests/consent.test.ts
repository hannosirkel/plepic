import { describe, expect, it } from "vitest";

import { parseStoredConsent, shouldLoadAnalytics } from "../src/lib/consent.js";

describe("parseStoredConsent", () => {
  it("accepts only the two known decisions", () => {
    expect(parseStoredConsent("granted")).toBe("granted");
    expect(parseStoredConsent("declined")).toBe("declined");
  });

  it("treats anything else, including null, as no decision", () => {
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent(undefined)).toBeNull();
    expect(parseStoredConsent("")).toBeNull();
    expect(parseStoredConsent("true")).toBeNull();
  });
});

describe("shouldLoadAnalytics", () => {
  it("never loads on a test host, even with consent granted and a measurement ID present", () => {
    expect(
      shouldLoadAnalytics({ isTestHost: true, decision: "granted", measurementId: "G-TEST123" }),
    ).toBe(false);
  });

  it("never loads before a decision exists", () => {
    expect(shouldLoadAnalytics({ isTestHost: false, decision: null, measurementId: "G-TEST123" })).toBe(
      false,
    );
  });

  it("never loads once declined", () => {
    expect(
      shouldLoadAnalytics({ isTestHost: false, decision: "declined", measurementId: "G-TEST123" }),
    ).toBe(false);
  });

  it("never loads with no measurement ID configured, even with consent granted", () => {
    expect(shouldLoadAnalytics({ isTestHost: false, decision: "granted", measurementId: null })).toBe(
      false,
    );
  });

  it("loads only on a live host, with consent granted, and a measurement ID configured", () => {
    expect(
      shouldLoadAnalytics({ isTestHost: false, decision: "granted", measurementId: "G-TEST123" }),
    ).toBe(true);
  });
});
