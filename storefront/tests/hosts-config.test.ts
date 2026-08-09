import { describe, expect, it } from "vitest";

import { isCanonicalHost, isTestHost, loadSiteHostConfig, normalizeHost } from "../src/config/hosts.js";
import { ConfigError } from "../src/config/env.js";

describe("loadSiteHostConfig", () => {
  it("uses reserved example-domain fallbacks when nothing is configured — never a live hostname", () => {
    const config = loadSiteHostConfig({});
    expect(config.baseUrl).toBe("https://example.com");
    expect(config.canonicalHost).toBe("example.com");
    expect(config.testHostnames).toEqual([]);
  });

  it("reads every value from the environment when it is present", () => {
    const config = loadSiteHostConfig({
      SITE_BASE_URL: "https://canonical.example.net",
      SITE_CANONICAL_HOST: "canonical.example.net",
      SITE_TEST_HOSTNAMES: "test.example.net, preview.example.net",
    });
    expect(config.baseUrl).toBe("https://canonical.example.net");
    expect(config.testHostnames).toEqual(["test.example.net", "preview.example.net"]);
  });

  it("rejects a base URL that carries a path", () => {
    expect(() => loadSiteHostConfig({ SITE_BASE_URL: "https://example.com/shop" })).toThrow(ConfigError);
  });

  it("rejects a base URL that is not an absolute URL", () => {
    expect(() => loadSiteHostConfig({ SITE_BASE_URL: "example.com" })).toThrow(ConfigError);
  });

  it("rejects a canonical host that carries a scheme", () => {
    expect(() => loadSiteHostConfig({ SITE_CANONICAL_HOST: "https://example.com" })).toThrow(ConfigError);
  });
});

describe("isTestHost: membership in validated configuration, not a string sniff", () => {
  const config = loadSiteHostConfig({ SITE_TEST_HOSTNAMES: "test.example.com" });

  it("is true for a configured test hostname", () => {
    expect(isTestHost("test.example.com", config)).toBe(true);
  });

  it("is true regardless of case or a port suffix", () => {
    expect(isTestHost("TEST.EXAMPLE.COM:443", config)).toBe(true);
  });

  it("is false for a hostname that merely looks like a test host but is not configured", () => {
    expect(isTestHost("test-staging.example.com", config)).toBe(false);
  });

  it("is false for the canonical host", () => {
    expect(isTestHost("example.com", config)).toBe(false);
  });
});

describe("isCanonicalHost / normalizeHost", () => {
  it("strips a port and lowercases", () => {
    expect(normalizeHost("Example.COM:8080")).toBe("example.com");
  });

  it("matches the canonical host case-insensitively", () => {
    const config = loadSiteHostConfig({ SITE_CANONICAL_HOST: "example.com" });
    expect(isCanonicalHost("EXAMPLE.com", config)).toBe(true);
    expect(isCanonicalHost("www.example.com", config)).toBe(false);
  });
});
