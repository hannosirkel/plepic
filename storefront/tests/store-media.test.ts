import { describe, expect, it } from "vitest";

import { browserMediaUrl } from "../src/lib/store-media.js";
import { resolveStoreApiPath } from "../src/lib/store-api-transport.js";

describe("browserMediaUrl", () => {
  it("exposes a backend media URL as the relative /store-api/static form", () => {
    expect(browserMediaUrl("/static/lunar-base-box.webp")).toBe(
      "/store-api/static/lunar-base-box.webp",
    );
  });

  it("completes the round trip back to the path Medusa serves", () => {
    const browserUrl = browserMediaUrl("/static/lunar-base-box.webp");
    expect(browserUrl).not.toBeNull();
    expect(resolveStoreApiPath(browserUrl!)).toBe("/static/lunar-base-box.webp");
  });

  it("hands the browser nothing that is not a relative backend media path", () => {
    for (const value of [
      "https://cdn.example.test/lunar-base-box.webp",
      "http://backend.internal/static/lunar-base-box.webp",
      "//cdn.example.test/x.webp",
      "/static/../../etc/passwd",
      "/static/%2e%2e/escape.webp",
      "/static/sub/../../escape.webp",
      "/static/back\\slash.webp",
      "/static//double.webp",
      "/static/",
      "/static",
      "/app/static/x.webp",
      "/store-api/static/x.webp",
      "lunar-base-box.webp",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(browserMediaUrl(value)).toBeNull();
    }
  });

  it("refuses any URL the storefront proxy would itself 404", () => {
    for (const value of ["/static/../store/products", "/static/./x.webp"]) {
      const browserUrl = browserMediaUrl(value);
      expect(browserUrl === null || resolveStoreApiPath(browserUrl) !== null).toBe(true);
      expect(browserUrl).toBeNull();
    }
  });
});
