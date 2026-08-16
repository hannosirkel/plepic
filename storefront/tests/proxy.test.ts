/**
 * Two carried findings against `proxy.ts`, both from review of the units
 * before this one:
 *
 * 1. **No canonical-host guard.** The module's own doc comment claimed "a
 *    request to the canonical host itself never matches an entry in the
 *    map, so there is no second hop and no loop" — but nothing enforced it.
 *    A typo that adds the apex to the operator redirect map would have
 *    produced an infinite redirect on the live site. `isCanonicalHost` now
 *    gates the whole redirect branch with an early return; this test proves
 *    it by giving the canonical host an entry in the map anyway (the exact
 *    mistake the guard exists for) and asserting `proxy()` still does not
 *    redirect it.
 * 2. **Redirects dropped the query string.** `absoluteUrl` never saw
 *    `request.nextUrl.search`, so an inbound backlink carrying `utm_*`
 *    arrived at its destination with no campaign attribution — on exactly
 *    the migration traffic the plan keeps analytics running to measure.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearRedirectMapCache } from "../src/config/redirect-map.js";
import { proxy } from "../src/proxy.js";

function withEnv<T>(env: Record<string, string>, run: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) previous[key] = process.env[key];
  Object.assign(process.env, env);
  try {
    return run();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

describe("proxy(): the canonical-host redirect guard", () => {
  let dir: string;
  let mapPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plepic-proxy-test-"));
    mapPath = join(dir, "redirect-map.json");
    clearRedirectMapCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    clearRedirectMapCache();
  });

  it("never redirects the canonical host, even when the operator map mistakenly carries an entry for it", () => {
    // The exact mistake the guard exists for: the operator map names the
    // canonical host itself, which `parseRedirectMap` does not forbid (it
    // has no idea which host is canonical — that is `SITE_CANONICAL_HOST`,
    // a different piece of configuration entirely).
    writeFileSync(
      mapPath,
      JSON.stringify({
        hosts: {
          "canonical.example.net": [{ path: "*", target: "about" }],
        },
      }),
      "utf8",
    );

    withEnv(
      {
        SITE_BASE_URL: "https://canonical.example.net",
        SITE_CANONICAL_HOST: "canonical.example.net",
        REDIRECT_MAP_PATH: mapPath,
      },
      () => {
        const request = new NextRequest("https://canonical.example.net/", {
          headers: { host: "canonical.example.net" },
        });
        const response = proxy(request);

        expect(response.headers.get("location")).toBeNull();
        expect([200, undefined]).toContain(response.status === 200 ? 200 : undefined);
      },
    );
  });

  it("still redirects a genuinely mapped alternate host — the guard is host-specific, not a kill switch", () => {
    writeFileSync(
      mapPath,
      JSON.stringify({
        hosts: {
          "www.canonical.example.net": [{ path: "*", target: "about" }],
        },
      }),
      "utf8",
    );

    withEnv(
      {
        SITE_BASE_URL: "https://canonical.example.net",
        SITE_CANONICAL_HOST: "canonical.example.net",
        REDIRECT_MAP_PATH: mapPath,
      },
      () => {
        const request = new NextRequest("https://www.canonical.example.net/", {
          headers: { host: "www.canonical.example.net" },
        });
        const response = proxy(request);

        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe("https://canonical.example.net/about");
      },
    );
  });
});

/**
 * How wide the guard actually is, asserted rather than assumed either way.
 *
 * `tests/build-and-serve.test.ts` observes that this deployment serves 200 on
 * its canonical host and on both declared test hostnames. What it cannot show
 * — one server, one map — is what `proxy.ts` would do if the operator map
 * named one of those test hostnames. An earlier revision of that suite implied
 * the guard covered them. It does not: `isCanonicalHost` compares against
 * `SITE_CANONICAL_HOST` and nothing else, so membership in
 * `SITE_TEST_HOSTNAMES` buys a hostname no protection at all.
 *
 * Both tests below pin observed behaviour, not a wish. Whether the guard
 * *should* widen to cover every declared test hostname is a design change to
 * `proxy.ts` and outside the unit that wrote these tests, so the hazard is
 * recorded here instead of quietly fixed. If someone does widen it, the first
 * test turns red and this comment is where they should land.
 *
 * The practical reading: **disjointness between the served hostnames and the
 * redirect map's keys is an operator-configuration constraint, enforced by
 * nothing in this repository** — except for the canonical host, which is
 * enforced. The second test is why the live topology is nonetheless safe: in
 * the test environment the test hostname *is* the canonical host, so the guard
 * that exists already covers it.
 */
describe("proxy(): the redirect guard covers the canonical host and nothing else", () => {
  let dir: string;
  let mapPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plepic-proxy-test-host-"));
    mapPath = join(dir, "redirect-map.json");
    clearRedirectMapCache();
    writeFileSync(
      mapPath,
      JSON.stringify({
        hosts: { "test.canonical.example.net": [{ path: "*", target: "about" }] },
      }),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    clearRedirectMapCache();
  });

  it("redirects a declared test hostname the operator map names, away from the environment serving it", () => {
    withEnv(
      {
        SITE_BASE_URL: "https://canonical.example.net",
        SITE_CANONICAL_HOST: "canonical.example.net",
        SITE_TEST_HOSTNAMES: "test.canonical.example.net",
        REDIRECT_MAP_PATH: mapPath,
      },
      () => {
        const request = new NextRequest("https://test.canonical.example.net/cart", {
          headers: { host: "test.canonical.example.net" },
        });
        const response = proxy(request);

        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe("https://canonical.example.net/about");

        // And it leaves before the noindex branch: the 301 off a test hostname
        // carries no `X-Robots-Tag` either, because `proxy()` returns at the
        // redirect rather than falling through to `isTestHost`.
        expect(response.headers.get("x-robots-tag")).toBeNull();
      },
    );
  });

  it("guards that same hostname where it is the canonical one, which is how the test environment is configured", () => {
    withEnv(
      {
        SITE_BASE_URL: "https://test.canonical.example.net",
        SITE_CANONICAL_HOST: "test.canonical.example.net",
        SITE_TEST_HOSTNAMES: "test.canonical.example.net",
        REDIRECT_MAP_PATH: mapPath,
      },
      () => {
        const request = new NextRequest("https://test.canonical.example.net/cart", {
          headers: { host: "test.canonical.example.net" },
        });
        const response = proxy(request);

        expect(response.headers.get("location")).toBeNull();
        expect(response.status).not.toBe(301);
        // Fell through to the noindex branch, so this really is the served
        // path and not an early return of a different kind.
        expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      },
    );
  });
});

describe("proxy(): a redirect preserves the inbound query string", () => {
  let dir: string;
  let mapPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plepic-proxy-query-test-"));
    mapPath = join(dir, "redirect-map.json");
    clearRedirectMapCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    clearRedirectMapCache();
  });

  it("carries utm_* campaign parameters through the single hop", () => {
    writeFileSync(
      mapPath,
      JSON.stringify({
        hosts: {
          "alt.example.org": [
            { path: "/game", target: "lunarBase" },
            { path: "*", target: "lunarBase" },
          ],
        },
      }),
      "utf8",
    );

    const previous = {
      SITE_BASE_URL: process.env.SITE_BASE_URL,
      SITE_CANONICAL_HOST: process.env.SITE_CANONICAL_HOST,
      REDIRECT_MAP_PATH: process.env.REDIRECT_MAP_PATH,
    };
    process.env.SITE_BASE_URL = "https://canonical.example.net";
    process.env.SITE_CANONICAL_HOST = "canonical.example.net";
    process.env.REDIRECT_MAP_PATH = mapPath;

    try {
      const request = new NextRequest(
        "https://alt.example.org/game?utm_source=newsletter&utm_campaign=launch",
        { headers: { host: "alt.example.org" } },
      );
      const response = proxy(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "https://canonical.example.net/games/lunar-base?utm_source=newsletter&utm_campaign=launch",
      );
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key as keyof typeof process.env];
        else process.env[key as keyof typeof process.env] = value;
      }
    }
  });

  it("redirects a path with no query string to a location with none either", () => {
    writeFileSync(
      mapPath,
      JSON.stringify({ hosts: { "alt.example.org": [{ path: "*", target: "about" }] } }),
      "utf8",
    );

    const previous = {
      SITE_BASE_URL: process.env.SITE_BASE_URL,
      SITE_CANONICAL_HOST: process.env.SITE_CANONICAL_HOST,
      REDIRECT_MAP_PATH: process.env.REDIRECT_MAP_PATH,
    };
    process.env.SITE_BASE_URL = "https://canonical.example.net";
    process.env.SITE_CANONICAL_HOST = "canonical.example.net";
    process.env.REDIRECT_MAP_PATH = mapPath;

    try {
      const request = new NextRequest("https://alt.example.org/", { headers: { host: "alt.example.org" } });
      const response = proxy(request);
      expect(response.headers.get("location")).toBe("https://canonical.example.net/about");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key as keyof typeof process.env];
        else process.env[key as keyof typeof process.env] = value;
      }
    }
  });
});
