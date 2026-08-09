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
import { ROUTE_PATHS } from "../../content/routes.js";

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
