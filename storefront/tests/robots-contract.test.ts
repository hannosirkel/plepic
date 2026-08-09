import { describe, expect, it } from "vitest";

import { buildRobotsRules } from "../src/lib/robots-contract.js";

describe("buildRobotsRules", () => {
  it("disallows everything on a test host and carries no sitemap link", () => {
    const rules = buildRobotsRules({ isTestHost: true, baseUrl: "https://test.example.com" });
    expect(rules).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("allows the live host, excludes cart/checkout/store-api, and points at the sitemap", () => {
    const rules = buildRobotsRules({ isTestHost: false, baseUrl: "https://example.com" });
    expect(rules.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(rules.rules).toMatchObject({ disallow: expect.arrayContaining(["/cart", "/checkout", "/store-api"]) });
    expect(rules.sitemap).toBe("https://example.com/sitemap.xml");
  });
});
