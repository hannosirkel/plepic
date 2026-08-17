/**
 * Host-based redirects for the three alternate hosts the Task 1 map carries —
 * the `www` variant of the canonical host, the alternate-brand host, and that
 * host's own `www` variant — and for whatever hostname is added next. **None
 * of them is named here.** This repository is public and, per `README.md`'s
 * "Repository boundaries" section, "contains no live hostname, address, or
 * credential"; the real hosts arrive only in the operator-supplied map
 * described under "Where the real map comes from" below, and the committed
 * fixture uses RFC 2606 reserved example domains. The lookup is entirely
 * configuration-driven: adding a host is adding an entry to the map, not
 * touching this file or `proxy.ts`.
 *
 * ## The map's shape
 *
 * ```jsonc
 * {
 *   "hosts": {
 *     "<incoming request host, lowercase, no port>": [
 *       { "path": "<site-relative path, exact>", "target": "<RouteId>" },
 *       { "path": "*", "target": "<RouteId>" }
 *     ]
 *   }
 * }
 * ```
 *
 * - `path` is either an **exact** site-relative path (`/rules`) or the
 *   literal string `"*"`, which is a catch-all for that host. A naive
 *   exact-match-only table silently drops a `"*"` entry — three of them exist
 *   in the Task 1 map — so lookup here is always exact-match-first,
 *   catch-all-second, checked explicitly, never folded into one pass that
 *   would treat `"*"` as just another literal path.
 * - `target` is a {@link RouteId} from `content/routes.ts` — the *only*
 *   vocabulary a redirect destination may use, so a redirect can never point
 *   somewhere outside this site's own route table (including `/cart`,
 *   `/checkout`, or a `/store-api` path, none of which are route ids).
 *
 * ## Resolution
 *
 * {@link resolveRedirect} performs exactly one lookup and returns a target
 * path, never a further redirect id — a redirect is a single hop by
 * construction, because the return value is a `RoutePath`, not something that
 * could itself be re-resolved. When a host is known but the specific path
 * matches neither an exact entry nor a catch-all, resolution falls back to
 * that host's catch-all: "an unmapped path resolves to the closest matching
 * section" is satisfied by whatever entry an editor chose there.
 * {@link parseRedirectMap} rejects a host with no catch-all, so every host in
 * a parsed map has one and there is no third case to handle.
 *
 * ## Where the real map comes from
 *
 * The operator transforms the Task 1 map with `npm run redirect-map:transform`
 * in this workspace, supplying explicit input and output paths. The command
 * knows this module's RouteId vocabulary and validation rules; it never knows
 * or reads an Orange checkout path. `loadRedirectMap` reads the transformed
 * file from `REDIRECT_MAP_PATH` before falling back to the fixture bundled at
 * {@link ./redirect-map.fixture.json}.
 *
 * ## Availability
 *
 * `proxy.ts` calls {@link loadRedirectMap} on **every** request, so this
 * module must be both cheap and impossible to take the site down with. Two
 * properties give that:
 *
 * - the parse is **memoised per source**, so the operator file is read from
 *   disk once per process rather than once per request; and
 * - a missing, unreadable or malformed source **degrades to "no redirects"**
 *   rather than throwing. A broken operator file costs the three alternate
 *   hosts their 301s, which is bad; letting it throw would 500 every request
 *   on every host including the canonical one, which is worse. The failure is
 *   logged once per source, not once per request.
 */

import { readFileSync } from "node:fs";

import { ROUTE_PATHS, type RouteId, type RoutePath } from "../../../content/routes.js";
import { readEnv, type EnvRecord } from "./env.js";
import fixture from "./redirect-map.fixture.json";

const ROUTE_IDS = new Set<string>(Object.keys(ROUTE_PATHS));

export interface RedirectMapEntry {
  readonly path: string;
  readonly target: RouteId;
}

export interface RedirectMap {
  readonly hosts: Readonly<Record<string, readonly RedirectMapEntry[]>>;
}

export class RedirectMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedirectMapError";
  }
}

function isRouteId(value: unknown): value is RouteId {
  return typeof value === "string" && ROUTE_IDS.has(value);
}

/** Validates an arbitrary parsed JSON value against the documented shape. */
export function parseRedirectMap(value: unknown, source: string): RedirectMap {
  if (typeof value !== "object" || value === null || !("hosts" in value)) {
    throw new RedirectMapError(`${source}: expected a top-level "hosts" object.`);
  }

  const hostsValue = (value as { hosts: unknown }).hosts;
  if (typeof hostsValue !== "object" || hostsValue === null) {
    throw new RedirectMapError(`${source}: "hosts" must be an object.`);
  }

  const hosts: Record<string, readonly RedirectMapEntry[]> = {};

  for (const [host, entriesValue] of Object.entries(hostsValue)) {
    if (host.toLowerCase() !== host) {
      throw new RedirectMapError(`${source}: host key ${JSON.stringify(host)} must be lowercase.`);
    }
    if (!Array.isArray(entriesValue) || entriesValue.length === 0) {
      throw new RedirectMapError(`${source}: host ${JSON.stringify(host)} must map to a non-empty array.`);
    }

    const entries: RedirectMapEntry[] = entriesValue.map((entry, index) => {
      if (typeof entry !== "object" || entry === null) {
        throw new RedirectMapError(`${source}: ${host}[${index}] must be an object.`);
      }
      const path = (entry as { path?: unknown }).path;
      const target = (entry as { target?: unknown }).target;

      if (typeof path !== "string" || (path !== "*" && !path.startsWith("/"))) {
        throw new RedirectMapError(
          `${source}: ${host}[${index}].path must be "*" or start with "/" — got ${JSON.stringify(path)}.`,
        );
      }
      if (!isRouteId(target)) {
        throw new RedirectMapError(
          `${source}: ${host}[${index}].target must be a known RouteId — got ${JSON.stringify(target)}.`,
        );
      }

      return { path, target };
    });

    const hasCatchAll = entries.some((entry) => entry.path === "*");
    if (!hasCatchAll) {
      throw new RedirectMapError(
        `${source}: host ${JSON.stringify(host)} has no "*" catch-all entry; every mapped host needs one so no path 404s.`,
      );
    }

    hosts[host] = entries;
  }

  return { hosts };
}

/** The source label used when no `REDIRECT_MAP_PATH` override is configured. */
const FIXTURE_SOURCE = "redirect-map.fixture.json";

/** A parsed map with no hosts: every request falls through, nothing redirects. */
const NO_REDIRECTS: RedirectMap = { hosts: {} };

/** Memoised parse, keyed by source. Cleared only by {@link clearRedirectMapCache}. */
const parsedBySource = new Map<string, RedirectMap>();

/**
 * Loads the redirect map: an operator-supplied file at `REDIRECT_MAP_PATH`
 * if set, otherwise the committed fixture.
 *
 * Memoised per source and non-throwing, because `proxy.ts` calls this on
 * every request on every host — see this module's "Availability" note. A
 * source that cannot be read or does not parse is logged once and cached as
 * {@link NO_REDIRECTS}, so a broken operator file costs the alternate hosts
 * their 301s instead of 500ing the canonical host.
 */
export function loadRedirectMap(env: EnvRecord = process.env): RedirectMap {
  const overridePath = readEnv("REDIRECT_MAP_PATH", env);
  const source = overridePath ?? FIXTURE_SOURCE;

  const cached = parsedBySource.get(source);
  if (cached !== undefined) return cached;

  let map: RedirectMap;
  try {
    map =
      overridePath === undefined
        ? parseRedirectMap(fixture, FIXTURE_SOURCE)
        : parseRedirectMap(JSON.parse(readFileSync(overridePath, "utf8")), overridePath);
    if (overridePath !== undefined) {
      console["info"](
        JSON.stringify({
          event: "redirect_map_loaded",
          source,
          hostCount: Object.keys(map.hosts).length,
        }),
      );
    }
  } catch (error) {
    console.error(
      `redirect map ${JSON.stringify(source)} could not be loaded; serving no host ` +
        `redirects until it is fixed and the process restarts: ${String(error)}`,
    );
    map = NO_REDIRECTS;
  }

  parsedBySource.set(source, map);
  return map;
}

/**
 * Drops the memoised parses. Exists for tests that write a fixture file, load
 * it, and then write a different one to the same path — a running server never
 * needs it, because a changed operator file arrives with a new process.
 */
export function clearRedirectMapCache(): void {
  parsedBySource.clear();
}

export interface ResolvedRedirect {
  readonly targetPath: RoutePath;
  readonly matchKind: "exact" | "catch-all";
}

/**
 * Resolves `pathname` for `host` against `map` in one lookup: exact match,
 * then the host's catch-all. Returns `null` when `host` is not in the map at
 * all, so the caller (`proxy.ts`) knows this host is not one of theirs and
 * should not redirect.
 *
 * There is no third outcome for a known host: {@link parseRedirectMap} rejects
 * a host with no `"*"` entry, so every host present in a parsed map has a
 * catch-all.
 */
export function resolveRedirect(
  host: string,
  pathname: string,
  map: RedirectMap,
): ResolvedRedirect | null {
  const normalizedHost = host.toLowerCase().split(":")[0] ?? "";
  const entries = map.hosts[normalizedHost];
  if (entries === undefined) return null;

  const exact = entries.find((entry) => entry.path === pathname);
  if (exact !== undefined) {
    return { targetPath: ROUTE_PATHS[exact.target], matchKind: "exact" };
  }

  const catchAll = entries.find((entry) => entry.path === "*");
  if (catchAll === undefined) {
    // Unreachable through parseRedirectMap, which requires a catch-all per host.
    return null;
  }

  return { targetPath: ROUTE_PATHS[catchAll.target], matchKind: "catch-all" };
}

/** Every host this map redirects, lowercase — used to compute the app's full known-hosts set. */
export function redirectMapHosts(map: RedirectMap): readonly string[] {
  return Object.keys(map.hosts);
}
