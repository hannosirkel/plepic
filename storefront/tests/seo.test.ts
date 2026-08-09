import { describe, expect, it } from "vitest";

import { pages } from "../../content/pages.js";
import { ROUTE_PATHS } from "../../content/routes.js";
import { buildPageMetadata } from "../src/lib/seo.js";

const BASE_URL = "https://example.com";

describe("buildPageMetadata on a live host", () => {
  it("gives every route a title, a description and a self-referencing canonical", () => {
    for (const page of pages) {
      const metadata = buildPageMetadata(page.route, { baseUrl: BASE_URL, isTestHost: false });
      expect(metadata.title).toBe(page.title);
      expect(metadata.description).toBe(page.description);
      expect(metadata.alternates?.canonical).toBe(`${BASE_URL}${ROUTE_PATHS[page.route]}`);
    }
  });

  it("marks every indexable route index, follow", () => {
    const indexable = pages.filter((page) => page.indexable);
    expect(indexable.length).toBeGreaterThan(0);

    for (const page of indexable) {
      const metadata = buildPageMetadata(page.route, { baseUrl: BASE_URL, isTestHost: false });
      expect(metadata.robots, page.route).toEqual({ index: true, follow: true });
    }
  });

  it("marks a non-indexable route noindex, nofollow", () => {
    const metadata = buildPageMetadata("cart", { baseUrl: BASE_URL, isTestHost: false });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

/**
 * `proxy.ts` sends `X-Robots-Tag: noindex, nofollow` on a configured test
 * hostname. A page that simultaneously emitted `index, follow` in its own
 * metadata would be arguing with that header, and which side a crawler
 * believes is not a question worth having an answer to. On a test host, no
 * route is indexable.
 */
describe("buildPageMetadata on a test host", () => {
  it("marks every route noindex, nofollow, including the ones the registry calls indexable", () => {
    for (const page of pages) {
      const metadata = buildPageMetadata(page.route, { baseUrl: BASE_URL, isTestHost: true });
      expect(metadata.robots, `${page.route} is indexable on a test host`).toEqual({
        index: false,
        follow: false,
      });
    }
  });

  it("still emits the canonical on the live base URL, never on the test host", () => {
    const metadata = buildPageMetadata("home", { baseUrl: BASE_URL, isTestHost: true });
    expect(metadata.alternates?.canonical).toBe(`${BASE_URL}/`);
  });
});
