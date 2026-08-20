/**
 * Retired routes: a path that still resolves, a page that no longer exists,
 * and exactly one hop between them.
 *
 * `/about` was retired on the operator's decision of 2026-08-20. The page had
 * become very nearly a duplicate of the homepage's middle third, competing
 * with it for the same queries, and everything on it but the timeline was
 * already on the homepage. The route itself could not simply be deleted: the
 * navigation still links to it by the operator's instruction, and the path has
 * been public long enough to be linked from elsewhere, so a 404 would be the
 * wrong answer to a good request.
 *
 * The property that actually matters here is **one hop**. The plan forbids
 * emitting a redirect chain or a loop, and the redirect map the operator froze
 * in Task 1 maps the old site's About page to `/about` — so the naive
 * arrangement, where the host map answers with `/about` and a second request
 * is then redirected to `/`, produces exactly the chain the plan forbids for
 * the one host most likely to carry real inbound links. Retirement is
 * therefore resolved *after* the map has turned its route id into a path, in
 * one place, for both branches.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RETIRED_ROUTES, ROUTE_PATHS } from "../../content/routes.js";
import { finalRouteFor, isRetiredRoute } from "../../content/schema.js";
import { proxy } from "../src/proxy.js";

const CANONICAL = "canonical.example.net";
const BASE_URL = `https://${CANONICAL}`;

let mapPath: string;
let previous: Record<string, string | undefined>;

beforeEach(() => {
  mapPath = join(mkdtempSync(join(tmpdir(), "plepic-retired-")), "redirect-map.json");
  previous = {
    SITE_BASE_URL: process.env.SITE_BASE_URL,
    SITE_CANONICAL_HOST: process.env.SITE_CANONICAL_HOST,
    REDIRECT_MAP_PATH: process.env.REDIRECT_MAP_PATH,
  };
  process.env.SITE_BASE_URL = BASE_URL;
  process.env.SITE_CANONICAL_HOST = CANONICAL;
  process.env.REDIRECT_MAP_PATH = mapPath;
});

afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key as keyof typeof process.env];
    else process.env[key as keyof typeof process.env] = value;
  }
});

function writeMap(hosts: Record<string, { path: string; target: string }[]>): void {
  writeFileSync(mapPath, JSON.stringify({ hosts }), "utf8");
}

describe("the retirement model", () => {
  it("retires at least one route, so nothing below is vacuous", () => {
    expect(Object.keys(RETIRED_ROUTES).length).toBeGreaterThan(0);
  });

  it("keeps every retired route's path, so links to it still resolve to a route", () => {
    for (const retired of Object.keys(RETIRED_ROUTES)) {
      expect(Object.hasOwn(ROUTE_PATHS, retired)).toBe(true);
    }
  });

  it("resolves a retired route to a route that is not itself retired", () => {
    for (const retired of Object.keys(RETIRED_ROUTES)) {
      const final = finalRouteFor(retired as keyof typeof ROUTE_PATHS);
      expect(final).not.toBe(retired);
      expect(isRetiredRoute(final)).toBe(false);
    }
  });

  it("leaves a live route alone", () => {
    expect(finalRouteFor("lunarBase")).toBe("lunarBase");
    expect(isRetiredRoute("lunarBase")).toBe(false);
  });
});

describe("a request to a retired route on the canonical host", () => {
  it("answers a single 301 to the route that replaced it", () => {
    writeMap({});
    const response = proxy(
      new NextRequest(`${BASE_URL}/about`, { headers: { host: CANONICAL } }),
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${BASE_URL}/`);
  });

  it("carries the inbound query string onto the destination", () => {
    writeMap({});
    const response = proxy(
      new NextRequest(`${BASE_URL}/about?utm_source=newsletter`, { headers: { host: CANONICAL } }),
    );

    expect(response.headers.get("location")).toBe(`${BASE_URL}/?utm_source=newsletter`);
  });

  /*
   * Retirement is an exact-path rule. `/about/team` was never a declared
   * route, so it 404s rather than being swept to the homepage on the strength
   * of a shared prefix — a redirect that answers URLs which never existed
   * hides real broken links behind a soft 200.
   */
  it("does not retire a path merely because a retired route is its prefix", () => {
    writeMap({});
    const response = proxy(
      new NextRequest(`${BASE_URL}/about/team`, { headers: { host: CANONICAL } }),
    );

    expect(response.status).not.toBe(301);
  });
});

describe("a redirect map that targets a retired route", () => {
  /*
   * The operator's frozen map does exactly this: the old site's About page
   * maps to `about`. Without resolution at this point, the visitor gets two
   * 301s.
   */
  it("still produces one hop, landing on the final destination", () => {
    writeMap({
      "alt.example.org": [
        { path: "/about-us", target: "about" },
        { path: "*", target: "home" },
      ],
    });

    const response = proxy(
      new NextRequest("https://alt.example.org/about-us", {
        headers: { host: "alt.example.org" },
      }),
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${BASE_URL}/`);
  });

  it("and the destination is not itself a redirect", () => {
    writeMap({
      "alt.example.org": [
        { path: "/about-us", target: "about" },
        { path: "*", target: "home" },
      ],
    });

    const first = proxy(
      new NextRequest("https://alt.example.org/about-us", {
        headers: { host: "alt.example.org" },
      }),
    );
    const location = first.headers.get("location")!;

    const second = proxy(new NextRequest(location, { headers: { host: CANONICAL } }));
    expect(second.status).not.toBe(301);
  });
});
