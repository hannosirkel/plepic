import { ROUTE_PATHS, type RouteId } from "../../../content/routes.js";
import {
  parseRedirectMap,
  resolveRedirect,
  type RedirectMap,
  type RedirectMapEntry,
} from "./redirect-map.js";

const TOP_LEVEL_KEYS = [
  "metadata",
  "shop_plepic_manifest_unused",
  "storefront_redirect_table",
] as const;

const ENTRY_KEYS = [
  "drives_storefront_redirect_table",
  "host",
  "note",
  "path",
  "reason",
  "target",
] as const;

const UNFLAGGED_REQUIRED_ENTRY_KEYS = [
  "drives_storefront_redirect_table",
  "host",
  "path",
  "reason",
  "target",
] as const;

type JsonObject = Readonly<Record<string, unknown>>;

interface OperatorRedirectEntry {
  readonly drivesStorefrontRedirectTable: boolean;
  readonly host: string;
  readonly path: string;
  readonly target: string;
}

export class RedirectMapTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedirectMapTransformError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(
  value: JsonObject,
  allowedKeys: readonly string[],
  source: string,
  requiredKeys: readonly string[] = allowedKeys,
): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = requiredKeys.filter((key) => !(key in value));

  if (unexpected.length > 0) {
    throw new RedirectMapTransformError(
      `${source}: unexpected key ${JSON.stringify(unexpected[0])}.`,
    );
  }
  if (missing.length > 0) {
    throw new RedirectMapTransformError(`${source}: missing key ${JSON.stringify(missing[0])}.`);
  }
}

function requireString(value: unknown, source: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new RedirectMapTransformError(`${source} must be a non-empty string without outer whitespace.`);
  }
  return value;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function normalizeHost(value: unknown, source: string): string {
  const host = requireString(value, source).toLowerCase();

  if (host.includes(":") || host.includes("/") || host.includes("?") || host.includes("#")) {
    throw new RedirectMapTransformError(`${source} must be a bare hostname without a port or path.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(`http://${host}`);
  } catch {
    throw new RedirectMapTransformError(`${source} must be a valid hostname.`);
  }
  if (parsed.hostname !== host || parsed.host !== host || !host.includes(".")) {
    throw new RedirectMapTransformError(`${source} must be a valid bare hostname.`);
  }

  return host;
}

function requireSourcePath(value: unknown, source: string): string {
  const path = requireString(value, source);
  if (path === "*") return path;

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) {
    throw new RedirectMapTransformError(
      `${source} must be "*" or a site-relative pathname without a query or fragment.`,
    );
  }

  const normalizedPath = new URL(path, "https://redirect-map.invalid").pathname;
  if (hasControlCharacter(path) || normalizedPath !== path) {
    throw new RedirectMapTransformError(
      `${source} must equal its runtime-normalized pathname — got ${JSON.stringify(path)}.`,
    );
  }
  return path;
}

function parseOperatorEntry(value: unknown, source: string): OperatorRedirectEntry {
  if (!isObject(value)) {
    throw new RedirectMapTransformError(`${source} must be an object.`);
  }
  requireExactKeys(
    value,
    ENTRY_KEYS,
    source,
    value.drives_storefront_redirect_table === false ? UNFLAGGED_REQUIRED_ENTRY_KEYS : ENTRY_KEYS,
  );

  if (typeof value.drives_storefront_redirect_table !== "boolean") {
    throw new RedirectMapTransformError(
      `${source}.drives_storefront_redirect_table must be boolean.`,
    );
  }

  if (value.note !== undefined) {
    requireString(value.note, `${source}.note`);
  }
  requireString(value.reason, `${source}.reason`);

  return {
    drivesStorefrontRedirectTable: value.drives_storefront_redirect_table,
    host: normalizeHost(value.host, `${source}.host`),
    path: requireSourcePath(value.path, `${source}.path`),
    target: requireString(value.target, `${source}.target`),
  };
}

/** Inverts a route vocabulary and refuses two ids that would name the same path. */
export function createRoutePathIndex(
  routePaths: Readonly<Record<string, string>>,
  source: string,
): ReadonlyMap<string, string> {
  const routeIdByPath = new Map<string, string>();

  for (const [routeId, path] of Object.entries(routePaths)) {
    const existing = routeIdByPath.get(path);
    if (existing !== undefined) {
      throw new RedirectMapTransformError(
        `${source}: route path ${JSON.stringify(path)} is ambiguous between ` +
          `${JSON.stringify(existing)} and ${JSON.stringify(routeId)}.`,
      );
    }
    routeIdByPath.set(path, routeId);
  }

  return routeIdByPath;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareEntries(left: RedirectMapEntry, right: RedirectMapEntry): number {
  if (left.path === "*") return right.path === "*" ? 0 : 1;
  if (right.path === "*") return -1;
  return compareStrings(left.path, right.path);
}

function catchAllProbe(entries: readonly RedirectMapEntry[]): string {
  const exactPaths = new Set(entries.map((entry) => entry.path));
  let sequence = 0;
  let candidate = "/.well-known/plepic-redirect-map-validation";

  while (exactPaths.has(candidate)) {
    sequence += 1;
    candidate = `/.well-known/plepic-redirect-map-validation-${sequence}`;
  }
  return candidate;
}

function replayTransformedEntries(map: RedirectMap, source: string): void {
  for (const [host, entries] of Object.entries(map.hosts)) {
    const catchAllPath = catchAllProbe(entries);
    for (const entry of entries) {
      const pathname = entry.path === "*" ? catchAllPath : entry.path;
      const expectedMatchKind = entry.path === "*" ? "catch-all" : "exact";
      const resolution = resolveRedirect(host, pathname, map);
      if (
        resolution === null ||
        resolution.matchKind !== expectedMatchKind ||
        resolution.targetPath !== ROUTE_PATHS[entry.target]
      ) {
        throw new RedirectMapTransformError(
          `${source}: transformed entry ${JSON.stringify(host)} ${JSON.stringify(entry.path)} ` +
            "did not replay to its source target.",
        );
      }
    }
  }
}

/**
 * Converts the Task 1 operator schema to the storefront runtime schema.
 * Metadata counts are deliberately ignored; the entries themselves are the record.
 */
export function transformRedirectMap(value: unknown, source: string): RedirectMap {
  if (!isObject(value)) {
    throw new RedirectMapTransformError(`${source}: expected a top-level object.`);
  }
  requireExactKeys(value, TOP_LEVEL_KEYS, source);
  if (!isObject(value.metadata)) {
    throw new RedirectMapTransformError(`${source}.metadata must be an object.`);
  }

  const tables = ["storefront_redirect_table", "shop_plepic_manifest_unused"] as const;
  const entries: OperatorRedirectEntry[] = [];
  for (const table of tables) {
    const tableValue = value[table];
    if (!Array.isArray(tableValue)) {
      throw new RedirectMapTransformError(`${source}.${table} must be an array.`);
    }
    tableValue.forEach((entry, index) => {
      entries.push(parseOperatorEntry(entry, `${source}.${table}[${index}]`));
    });
  }

  const selected = entries.filter((entry) => entry.drivesStorefrontRedirectTable);
  if (selected.length === 0) {
    throw new RedirectMapTransformError(`${source}: no entry drives the storefront redirect table.`);
  }

  const routeIdByPath = createRoutePathIndex(ROUTE_PATHS, "ROUTE_PATHS");
  const entriesByHost = new Map<string, RedirectMapEntry[]>();
  const sourceKeys = new Set<string>();

  for (const entry of selected) {
    const sourceKey = `${entry.host}\u0000${entry.path}`;
    if (sourceKeys.has(sourceKey)) {
      throw new RedirectMapTransformError(
        `${source}: duplicate redirect for host ${JSON.stringify(entry.host)} and ` +
          `path ${JSON.stringify(entry.path)}.`,
      );
    }
    sourceKeys.add(sourceKey);

    const routeId = routeIdByPath.get(entry.target);
    if (routeId === undefined) {
      throw new RedirectMapTransformError(
        `${source}: target ${JSON.stringify(entry.target)} does not resolve to a unique RouteId.`,
      );
    }

    const hostEntries = entriesByHost.get(entry.host) ?? [];
    hostEntries.push({ path: entry.path, target: routeId as RouteId });
    entriesByHost.set(entry.host, hostEntries);
  }

  const hosts: Record<string, readonly RedirectMapEntry[]> = {};
  for (const host of [...entriesByHost.keys()].sort(compareStrings)) {
    hosts[host] = [...(entriesByHost.get(host) ?? [])].sort(compareEntries);
  }

  const parsed = parseRedirectMap({ hosts }, `${source} (transformed)`);
  replayTransformedEntries(parsed, source);
  return parsed;
}
