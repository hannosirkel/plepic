import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRedirectMapCache,
  loadRedirectMap,
  parseRedirectMap,
  redirectMapHosts,
  resolveRedirect,
} from "../src/config/redirect-map.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
} from "../../content/routes.js";
import { localizedPath } from "../src/lib/urls.js";

describe("redirect map: loading the committed fixture", () => {
  const map = loadRedirectMap({});

  it("carries exactly the three Task 1 hosts", () => {
    expect(redirectMapHosts(map).toSorted()).toEqual(
      ["alt-brand.example.org", "www.alt-brand.example.org", "www.example.com"].toSorted(),
    );
  });

  it("gives every host a catch-all entry", () => {
    for (const host of redirectMapHosts(map)) {
      expect(map.hosts[host]?.some((entry) => entry.path === "*")).toBe(true);
    }
  });
});

describe("resolveRedirect: exact match beats catch-all", () => {
  const map = loadRedirectMap({});

  it("resolves an exact path to its specific target", () => {
    const result = resolveRedirect("alt-brand.example.org", "/rules", map);
    expect(result).toEqual({ targetPath: ROUTE_PATHS.rulebook, matchKind: "exact" });
  });

  it("falls back to the host's catch-all for an unmapped path", () => {
    const result = resolveRedirect("alt-brand.example.org", "/some/never-anticipated/path", map);
    expect(result).toEqual({ targetPath: ROUTE_PATHS.lunarBase, matchKind: "catch-all" });
  });

  it("does not silently drop the literal '*' entry — a naive exact-match table would", () => {
    const result = resolveRedirect("www.example.com", "/anything", map);
    expect(result?.targetPath).toBe(ROUTE_PATHS.home);
  });

  it("is case-insensitive and ignores a port on the Host header", () => {
    const result = resolveRedirect("WWW.EXAMPLE.COM:8443", "/", map);
    expect(result?.targetPath).toBe(ROUTE_PATHS.home);
  });

  it("returns null for a host the map does not know at all — the canonical host, say", () => {
    expect(resolveRedirect("example.com", "/", map)).toBeNull();
  });

  it("resolves every configured host to a single RoutePath, never to another redirect", () => {
    // Structural: ResolvedRedirect.targetPath is typed as RoutePath, not as
    // something resolvable again, so a second hop is not expressible. This
    // walks every fixture entry to confirm each one actually resolves.
    for (const host of redirectMapHosts(map)) {
      for (const entry of map.hosts[host] ?? []) {
        if (entry.path === "*") continue;
        const result = resolveRedirect(host, entry.path, map);
        expect(result).not.toBeNull();
        expect(Object.values(ROUTE_PATHS)).toContain(result?.targetPath);
      }
    }
  });
});

describe("parseRedirectMap: validation", () => {
  it("rejects a host with no catch-all entry", () => {
    expect(() =>
      parseRedirectMap({ hosts: { "www.example.com": [{ path: "/", target: "home" }] } }, "test"),
    ).toThrow(/catch-all/);
  });

  it("rejects an uppercase host key", () => {
    expect(() =>
      parseRedirectMap({ hosts: { "WWW.EXAMPLE.COM": [{ path: "*", target: "home" }] } }, "test"),
    ).toThrow(/lowercase/);
  });

  it("rejects a target that is not a known RouteId", () => {
    expect(() =>
      parseRedirectMap({ hosts: { "www.example.com": [{ path: "*", target: "not-a-route" }] } }, "test"),
    ).toThrow(/RouteId/);
  });

  it("rejects a path that is neither '*' nor site-relative", () => {
    expect(() =>
      parseRedirectMap(
        { hosts: { "www.example.com": [{ path: "https://example.com/", target: "home" }] } },
        "test",
      ),
    ).toThrow(/path/);
  });

  it("rejects a redirect target under /store-api — there is no such RouteId, so this is structural", () => {
    expect(Object.values(ROUTE_PATHS).some((path) => path.startsWith("/store-api"))).toBe(false);
  });
});

/**
 * The operator-supplied map, which is how Task 5 delivers the real one: it
 * writes a validly-shaped JSON file and sets `REDIRECT_MAP_PATH`. Nothing in
 * `src/config/redirect-map.ts` changes for it — which is a claim worth a test
 * rather than a comment, because until now nothing ever loaded a map from a
 * path at all.
 *
 * The failure modes matter as much as the happy path. `proxy.ts` calls
 * `loadRedirectMap()` on **every** request on **every** host, so a missing or
 * malformed operator file that threw would 500 the canonical site, not just
 * the three hosts that redirect. It degrades to "no redirects" instead, and
 * memoises so a file is read once per process rather than once per request.
 */
describe("loadRedirectMap: the REDIRECT_MAP_PATH override", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plepic-redirect-map-"));
    clearRedirectMapCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    clearRedirectMapCache();
    vi.restoreAllMocks();
  });

  function writeMap(name: string, contents: string): string {
    const path = join(dir, name);
    writeFileSync(path, contents, "utf8");
    return path;
  }

  it("loads an operator file in place of the committed fixture", () => {
    const path = writeMap(
      "map.json",
      JSON.stringify({
        hosts: { "operator.example.org": [{ path: "/rules", target: "rulebook" }, { path: "*", target: "home" }] },
      }),
    );

    const map = loadRedirectMap({ REDIRECT_MAP_PATH: path });

    expect(redirectMapHosts(map)).toEqual(["operator.example.org"]);
    expect(resolveRedirect("operator.example.org", "/rules", map)).toEqual({
      targetPath: ROUTE_PATHS.rulebook,
      matchKind: "exact",
    });
    // The fixture's hosts are gone: the override replaces, never merges.
    expect(resolveRedirect("www.example.com", "/", map)).toBeNull();
  });

  it("reads the file once per process, not once per request", () => {
    const path = writeMap(
      "cached.json",
      JSON.stringify({ hosts: { "operator.example.org": [{ path: "*", target: "home" }] } }),
    );

    const first = loadRedirectMap({ REDIRECT_MAP_PATH: path });
    rmSync(path);
    const second = loadRedirectMap({ REDIRECT_MAP_PATH: path });

    expect(second).toBe(first);
  });

  it("degrades to no redirects when the file is missing, rather than 500ing every host", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const map = loadRedirectMap({ REDIRECT_MAP_PATH: join(dir, "does-not-exist.json") });

    expect(redirectMapHosts(map)).toEqual([]);
    expect(resolveRedirect("www.example.com", "/", map)).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });

  it("degrades the same way on unparsable JSON", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const path = writeMap("broken.json", "{ this is not json");

    expect(redirectMapHosts(loadRedirectMap({ REDIRECT_MAP_PATH: path }))).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });

  it("degrades the same way on a shape violation, and says which one", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const path = writeMap(
      "no-catch-all.json",
      JSON.stringify({ hosts: { "operator.example.org": [{ path: "/", target: "home" }] } }),
    );

    expect(redirectMapHosts(loadRedirectMap({ REDIRECT_MAP_PATH: path }))).toEqual([]);
    expect(error.mock.calls[0]?.[0]).toMatch(/catch-all/);
  });

  it("logs a broken source once, not once per request", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const path = join(dir, "still-missing.json");

    for (let i = 0; i < 5; i += 1) loadRedirectMap({ REDIRECT_MAP_PATH: path });

    expect(error).toHaveBeenCalledOnce();
  });
});

/**
 * The locale dimension does **not** reach the redirect map.
 *
 * The map is derived from the Task 1 URL map and CI reads it from a fixture,
 * so a locale must not fork it: no `locale` field on an entry, no second map
 * per edition, and no localized target. A redirect answers with the default
 * edition's path, which is the same answer it gave before locales existed —
 * an inbound link from the alternate-brand host carries no statement about
 * what language its visitor reads, and inventing one from a redirect would be
 * a guess dressed up as a canonical.
 *
 * This is a guard rather than an observation because the natural "improvement"
 * is exactly the wrong one: adding `"locale": "…"` to an entry looks helpful
 * and would give one target path two sources of truth.
 */
describe("redirects carry no locale", () => {
  const map = loadRedirectMap({});
  const routePaths = new Set<string>(Object.values(ROUTE_PATHS));

  it("resolves every host and path to a bare, unprefixed route path", () => {
    for (const host of redirectMapHosts(map)) {
      for (const entry of map.hosts[host] ?? []) {
        const probe = entry.path === "*" ? "/anything-unmapped" : entry.path;
        const resolved = resolveRedirect(host, probe, map);
        expect(resolved, `${host}${probe}`).not.toBeNull();
        expect(
          routePaths.has(resolved?.targetPath ?? ""),
          `${host}${probe} resolved to ${resolved?.targetPath ?? "null"}, which is not a bare route path`,
        ).toBe(true);
      }
    }
  });

  it("gives a target the same path in the default edition and in the redirect", () => {
    for (const host of redirectMapHosts(map)) {
      for (const entry of map.hosts[host] ?? []) {
        expect(ROUTE_PATHS[entry.target]).toBe(
          localizedPath(DEFAULT_LOCALE, ROUTE_PATHS[entry.target]),
        );
      }
    }
  });

  /**
   * The parser's own vocabulary, pinned. `parseRedirectMap` keeps `path` and
   * `target` and nothing else; an entry that tried to name an edition would
   * have to change the parser first, which is the point at which somebody has
   * to justify the second source of truth.
   */
  it("keeps a parsed entry to exactly path and target", () => {
    const parsed = parseRedirectMap(
      { hosts: { "operator.example.org": [{ path: "*", target: "home", locale: "en" }] } },
      "locale-probe",
    );
    expect(Object.keys(parsed.hosts["operator.example.org"]?.[0] ?? {}).toSorted()).toEqual([
      "path",
      "target",
    ]);
  });

  it("carries no locale prefix in the committed fixture's own paths", () => {
    const prefixes = LOCALES.map((locale) => LOCALE_DEFINITIONS[locale].pathPrefix).filter(
      (prefix) => prefix !== "",
    );

    for (const host of redirectMapHosts(map)) {
      for (const entry of map.hosts[host] ?? []) {
        for (const prefix of prefixes) {
          expect(entry.path.startsWith(`${prefix}/`), `${host}${entry.path}`).toBe(false);
        }
      }
    }
  });
});

/**
 * "No chains or loops", stated as the three facts that make it true rather
 * than as one observation about today's fixture.
 *
 * The served proof is in `tests/build-and-serve.test.ts` — every configured
 * host answers exactly one 301 whose `Location` answers 200 with no `Location`
 * of its own, and the canonical host is never redirected. What that suite
 * cannot show is *why* a second hop is not expressible, which is what stops
 * the next operator map from introducing one. Three properties do it, and each
 * is mechanical:
 *
 * 1. a target is a `RouteId`, so it resolves to a bare same-site path and can
 *    never be another host, another redirect, or an off-site URL — the two
 *    tests below;
 * 2. a parsed entry carries nothing but `path` and `target`, so there is no
 *    field in which a destination host could be smuggled. Held by
 *    "keeps a parsed entry to exactly path and target" above, which drops any
 *    key the parser does not name, whatever it is called. This block used to
 *    restate it with `host` and `url` as the discarded keys; that was the same
 *    assertion against the same code path, and has been deleted rather than
 *    kept for illustration;
 * 3. therefore the only shape a loop could take is the destination host being
 *    itself a key in the map — and `proxy.ts` refuses to redirect the
 *    canonical host, which is the only host a target can resolve onto.
 *    `tests/proxy.test.ts` drives that guard with a map that deliberately
 *    contains it, and, next to it, pins the guard's edge: a *test* hostname
 *    named in the map is not covered and is redirected. Nothing about that is
 *    assertable from this module, which sees no host configuration at all.
 *
 * A fourth test here previously claimed to check "a self-referential host". It
 * built `{ "loop.example.org": [{ path: "*", target: "home" }] }`, in which
 * nothing refers to itself — `target` is a `RouteId`, not a host — and then
 * asserted the lookup returns what a lookup returns. It established nothing
 * about loops and is gone.
 */
describe("the redirect graph has no chains and no loops", () => {
  const map = loadRedirectMap({});

  it("resolves every host and path in one step to a terminal route path", () => {
    const routePaths = new Set<string>(Object.values(ROUTE_PATHS));
    let checked = 0;

    for (const host of redirectMapHosts(map)) {
      for (const entry of map.hosts[host] ?? []) {
        const probe = entry.path === "*" ? "/nothing-anticipated-here" : entry.path;
        const first = resolveRedirect(host, probe, map);
        expect(first, `${host}${probe}`).not.toBeNull();

        // Terminal: the answer is a route this site serves, not an input the
        // resolver could be handed again for a second answer.
        expect(routePaths.has(first?.targetPath ?? ""), `${host}${probe}`).toBe(true);
        checked += 1;
      }
    }

    expect(checked, "walked no entries at all").toBeGreaterThan(4);
  });

  it("rejects a target naming another mapped host rather than a route", () => {
    expect(() =>
      parseRedirectMap(
        { hosts: { "a.example.org": [{ path: "*", target: "b.example.org" }] } },
        "chain-probe",
      ),
    ).toThrow(/RouteId/);
  });

});
