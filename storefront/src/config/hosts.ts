/**
 * The base URL, the canonical host, and the set of test hostnames — every
 * hostname the storefront knows about, all from configuration.
 *
 * No literal hostname lives in this file. The values below (`example.com`,
 * `test.example.org`) are RFC 2606 reserved example domains used only as
 * fallbacks when the corresponding environment variable is absent, exactly
 * the way `roles/argocd/defaults/main.yml` in Orange carries `orange.example.com`
 * as its tracked default and the real value lives in the private inventory.
 * The plepic repository is public and, per `README.md`'s "Repository
 * boundaries" section, "contains no live hostname, address, or credential" —
 * so the real hostnames this site answers to arrive only through the process
 * environment at deploy time, never through a committed default.
 */

import { ConfigError, readEnv, readEnvList, type EnvRecord } from "./env.js";

export interface SiteHostConfig {
  /** Full origin, no trailing slash: `https://example.com`. */
  readonly baseUrl: string;
  /** Bare hostname clients are canonicalised to: `example.com`. */
  readonly canonicalHost: string;
  /**
   * Hostnames that must never be indexed and never load analytics: the test
   * environment's storefront hostname, and any preview hostname added later.
   * Membership here is what "a test hostname" means everywhere else in this
   * package — never a request-time string match against a naming convention.
   */
  readonly testHostnames: readonly string[];
}

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function assertBareHostname(value: string, source: string): string {
  const host = value.toLowerCase();
  if (!HOSTNAME_PATTERN.test(host)) {
    throw new ConfigError(
      `${source} must be a bare hostname with no scheme, port, or path — got ${JSON.stringify(value)}.`,
    );
  }
  return host;
}

function assertBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`SITE_BASE_URL must be an absolute URL — got ${JSON.stringify(value)}.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConfigError(`SITE_BASE_URL must use http or https — got ${JSON.stringify(value)}.`);
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new ConfigError(
      `SITE_BASE_URL must be an origin with no path, query, or fragment — got ${JSON.stringify(value)}.`,
    );
  }
  // Normalised, no trailing slash.
  return `${url.protocol}//${url.host}`;
}

/**
 * Loads and validates the host configuration from `env`.
 *
 * Every field is required or has a documented reserved-example fallback;
 * nothing here is optional-and-silently-absent, because a silently absent
 * canonical host is how a redirect loop or an un-canonicalised duplicate page
 * ships unnoticed.
 */
export function loadSiteHostConfig(env: EnvRecord = process.env): SiteHostConfig {
  const baseUrl = assertBaseUrl(readEnv("SITE_BASE_URL", env) ?? "https://example.com");
  const canonicalHost = assertBareHostname(
    readEnv("SITE_CANONICAL_HOST", env) ?? new URL(baseUrl).hostname,
    "SITE_CANONICAL_HOST",
  );
  const testHostnames = readEnvList("SITE_TEST_HOSTNAMES", env).map((host) =>
    assertBareHostname(host, "SITE_TEST_HOSTNAMES"),
  );

  return { baseUrl, canonicalHost, testHostnames };
}

/** Strips a port suffix, the way a browser's `Host` header may carry one. */
export function normalizeHost(host: string): string {
  return host.toLowerCase().split(":")[0] ?? "";
}

/**
 * True when `host` is one this deployment must keep out of search indexes:
 * membership in {@link SiteHostConfig.testHostnames}, checked as a validated
 * set rather than by pattern-matching the string at request time.
 */
export function isTestHost(host: string, config: Pick<SiteHostConfig, "testHostnames">): boolean {
  const normalized = normalizeHost(host);
  return config.testHostnames.some((candidate) => normalizeHost(candidate) === normalized);
}

/** True when `host` is the canonical live host. */
export function isCanonicalHost(host: string, config: Pick<SiteHostConfig, "canonicalHost">): boolean {
  return normalizeHost(host) === normalizeHost(config.canonicalHost);
}

/**
 * True when `host` is the `www` label directly above the canonical host — the
 * one alternate spelling of the site's own name.
 *
 * Composed from validated configuration rather than matched as a pattern, for
 * the same reason {@link isTestHost} is: a bare `startsWith("www.")` would
 * claim `www.example.org` on a deployment whose canonical host is
 * `canonical.example.net`, and canonicalising somebody else's hostname onto
 * this site is a redirect this code has no business emitting.
 *
 * Deliberately **not** folded into {@link isCanonicalHost}. That predicate
 * guards the redirect branch against self-redirect loops, so widening it to
 * accept `www` would silence the very redirect this exists to produce.
 */
export function isWwwOfCanonicalHost(
  host: string,
  config: Pick<SiteHostConfig, "canonicalHost">,
): boolean {
  return normalizeHost(host) === `www.${normalizeHost(config.canonicalHost)}`;
}
