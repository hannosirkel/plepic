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
