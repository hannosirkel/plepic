/**
 * The publication guard for the storefront package.
 *
 * `README.md`'s "Repository boundaries" section says this repository
 * "contains no live hostname, address, or credential", and the plan's Global
 * Constraints put it more sharply: live domains and addresses belong in the
 * private inventory or in ignored operator configuration, while tracked
 * public defaults, templates and tests keep reserved example values. Nothing
 * enforced that here — `src/config/hosts.ts` cited the rule by name in a doc
 * comment four lines before `src/config/redirect-map.ts` broke it, naming
 * three live hosts and a fourth planned one in *its* doc comment. Review
 * caught that; a test should have.
 *
 * So this scans the **source text** of everything under `src/` and `tests/`,
 * comments included. Comments are the whole point: a hostname in a comment
 * leaks exactly as completely as one in a string, and it is the likelier
 * place for one to appear, because a comment feels like an explanation rather
 * than a value. `content/content.test.ts` does the same for `content/`, and
 * records in its own doc comment that an earlier revision let a live hostname
 * past for exactly this reason. That file is not this package's to extend,
 * and the two guards are deliberately separate because they permit different
 * things — content may name no hostname at all, while this package must name
 * the third-party endpoints it actually talks to.
 *
 * The rule is an allowlist, not a blocklist. A blocklist would have to name
 * the very hostnames it exists to keep out of this repository, which is
 * self-defeating; an allowlist fails closed on a hostname nobody anticipated,
 * which is the case that matters.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** Scanned recursively. */
const SCAN_ROOTS = ["src", "tests"] as const;

/**
 * Scanned individually, because the package root also holds build artifacts
 * (`.next/`, `*.tsbuildinfo`) that are neither tracked nor text worth reading.
 * Named rather than globbed so renaming one drops it out of the scan loudly:
 * every name here is asserted to exist. `next.config.ts` in particular is a
 * plausible future home for a hostname — image `remotePatterns` and `rewrites`
 * both take them.
 */
const SCAN_FILES = [
  "next.config.ts",
  "next-env.d.ts",
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
] as const;

/**
 * Every extension allowed under the scanned roots. Closed and asserted, the
 * way `content/content.test.ts` does it, so a file type nobody thought about
 * fails this suite rather than silently skipping the scan.
 */
const EXTENSIONS: readonly string[] = [".ts", ".tsx", ".json"];

/**
 * Registrable domains this package is allowed to name.
 *
 * Two kinds, and nothing else:
 *
 * 1. **RFC 2606 reserved example domains.** The only domains a tracked
 *    default, fixture or test may stand in with. Every real hostname arrives
 *    through the process environment (`SITE_BASE_URL`, `SITE_CANONICAL_HOST`,
 *    `SITE_TEST_HOSTNAMES`) or through the operator's redirect map.
 * 2. **Third-party service endpoints the application genuinely talks to.**
 *    These are vendor hostnames, identical in every environment, and they
 *    appear in the Content-Security-Policy and in `next/script` sources
 *    because they must. They say nothing about who this site is or where it
 *    is deployed.
 * 3. **Vendor documentation hosts**, which appear in generated files this
 *    package does not own — `next-env.d.ts` carries one and says in its own
 *    text that it should not be edited.
 *
 * Adding an entry here is a deliberate act. Adding one because a live
 * hostname tripped the scan is the mistake this exists to prevent.
 */
const ALLOWED_DOMAINS: readonly string[] = [
  // 1. RFC 2606.
  "example.com",
  "example.net",
  "example.org",
  // 2. Endpoints the application talks to.
  "cloudflare.com",
  "google-analytics.com",
  "googletagmanager.com",
  "schema.org",
  // 3. Vendor documentation.
  "nextjs.org",
];

const TLD = [
  "com", "net", "org", "info", "biz", "io", "dev", "app", "co", "me", "tv",
  "shop", "games", "eu", "ee", "dk", "fi", "se", "no", "lv", "lt", "de", "nl",
  "fr", "at", "it", "es", "pl", "cz", "ie", "uk", "us", "ru", "cn",
].join("|");

/**
 * Matches the registrable tail of a hostname: one label, a dot, a known TLD.
 * Sub-labels are irrelevant — `www.<live>` and `test.<live>` both reduce to
 * the same registrable domain, so allowlisting works on that form.
 */
const HOSTNAME = new RegExp(`\\b([a-z0-9][a-z0-9-]*\\.(?:${TLD}))\\b`, "gi");

/**
 * Public IPv4 literals. RFC 5737 reserves three ranges for documentation, and
 * loopback and RFC 1918 space is not a live address, so those are the only
 * ones a public repository may carry. `deploys` may carry RFC 1918 addresses
 * openly and so may this.
 */
const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

function isDocumentationOrPrivateAddress(octets: readonly number[]): boolean {
  const [a = 0, b = 0, c = 0] = octets;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  // RFC 5737 documentation ranges.
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

interface ScannedFile {
  readonly name: string;
  readonly source: string;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}

const paths = [
  ...SCAN_ROOTS.flatMap((root) => listFiles(join(storefrontDir, root))),
  ...SCAN_FILES.map((name) => join(storefrontDir, name)),
].toSorted();

const scanned: readonly ScannedFile[] = paths.map((path) => ({
  name: relative(storefrontDir, path).split(sep).join("/"),
  source: readFileSync(path, "utf8"),
}));

describe("file coverage", () => {
  it("scanned every root and a plausible number of files", () => {
    expect(scanned.length).toBeGreaterThan(20);
    for (const root of SCAN_ROOTS) {
      expect(scanned.some((file) => file.name.startsWith(`${root}/`))).toBe(true);
    }
  });

  it("scanned every named package-root file, so none was renamed out of the scan", () => {
    for (const name of SCAN_FILES) {
      expect(scanned.some((file) => file.name === name), `${name} was not scanned`).toBe(true);
    }
  });

  it("knows how to handle every file type it found", () => {
    const unknown = scanned
      .filter((file) => !EXTENSIONS.includes(extname(file.name)))
      .map((file) => file.name);
    expect(
      unknown,
      "add the extension to EXTENSIONS after checking it is text this scan can read",
    ).toEqual([]);
  });

  it("scans this file too, so the guard cannot exempt itself", () => {
    expect(scanned.some((file) => file.name === "tests/no-live-hostname.test.ts")).toBe(true);
  });
});

describe("no source file names a hostname outside the allowlist, comments included", () => {
  for (const file of scanned) {
    it(`${file.name}`, () => {
      const offenders = [
        ...new Set(
          [...file.source.matchAll(HOSTNAME)]
            .map((match) => (match[1] ?? "").toLowerCase())
            .filter((domain) => !ALLOWED_DOMAINS.includes(domain)),
        ),
      ].toSorted();

      expect(
        offenders,
        "a live hostname belongs in the private inventory or in operator configuration, " +
          "never in this repository — use a reserved example domain instead",
      ).toEqual([]);
    });
  }
});

describe("no source file names a routable IP address", () => {
  for (const file of scanned) {
    it(`${file.name}`, () => {
      const offenders = [
        ...new Set(
          [...file.source.matchAll(IPV4)]
            .filter((match) => !isDocumentationOrPrivateAddress(match.slice(1, 5).map(Number)))
            .map((match) => match[0]),
        ),
      ].toSorted();

      expect(offenders, "use an RFC 5737 documentation address").toEqual([]);
    });
  }
});

describe("the guard has teeth", () => {
  const check = (text: string): readonly string[] =>
    [...text.matchAll(HOSTNAME)]
      .map((match) => (match[1] ?? "").toLowerCase())
      .filter((domain) => !ALLOWED_DOMAINS.includes(domain));

  it("catches a live hostname in a comment, which is where the real one was found", () => {
    const brand = ["plepic", "games"].join("");
    expect(check(` * Host-based redirects for \`www.${brand}.com\`.`)).toEqual([`${brand}.com`]);
  });

  it("catches a live hostname behind an arbitrary number of sub-labels", () => {
    const brand = ["lunarbase", "game"].join("");
    expect(check(`https://test.www.${brand}.com/rules`)).toEqual([`${brand}.com`]);
  });

  it("catches a routable address", () => {
    const routable = [212, 47, 220, 121];
    expect(isDocumentationOrPrivateAddress(routable)).toBe(false);
  });

  it("lets the reserved example domains and the vendor endpoints through", () => {
    expect(check("https://www.example.com https://challenges.cloudflare.com https://schema.org/InStock")).toEqual(
      [],
    );
  });
});
