/**
 * The dynamic half of "read every per-environment value at runtime, never at
 * build time" — and, in the same running server, the contracts no pure
 * function can check: the sitemap, robots, the redirects, and the CSP nonce.
 *
 * 1. **Build once**, with a set of env values that exist *only* during
 *    `next build` (the canaries). Then grep the actual deployable output —
 *    `.next/server` and `.next/static`, not `.next/cache` — for every one of
 *    those values. None may appear. If one does, it was inlined at build
 *    time, which is exactly what this unit exists to prevent.
 * 2. **Start the built app** with a *different* set of env values the build
 *    never saw, and confirm the server actually serves them.
 * 3. **Start it a second time** with no catalogue price configured at all,
 *    and confirm the product page publishes no price rather than a defaulted
 *    one.
 *
 * ## Why the CSP assertions are here and nowhere else
 *
 * `src/lib/csp.ts` emits `'strict-dynamic'`. Under CSP Level 3 that makes a
 * browser **ignore** `'self'` and every host-source in `script-src`, so the
 * per-request nonce is the only thing left that can authorise a script at
 * all. If the nonce in the enforced `Content-Security-Policy` response header
 * and the nonce on the `<script>` tags in the body ever stop matching, the
 * page paints and never hydrates: no consent banner, no Agree, no Decline, no
 * analytics, no Turnstile widget. Every unit test in this package would still
 * pass, and so would every other test in this file — `node:http` does not
 * enforce CSP, and neither does anything else in this repository.
 *
 * So the assertions below compare the two directly, on the real served HTML:
 * whatever nonce the response header tells the browser to trust must be on
 * every script Next.js emitted. That is the one check that would have caught
 * the nonce being handed to Next.js on a header Next.js does not read.
 *
 * This suite is slow (`next build` is not instant) and is why
 * `vitest.config.ts` raises the suite timeouts. `afterAll` always removes
 * `.next` again — the repository root's `eslint .` has no ignore entry for a
 * generated build directory, and this suite must not leave one lying around
 * for that run to trip over.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as http from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RUNTIME_ENV_VARS, type RuntimeEnvVar } from "../src/config/runtime-env.js";
import { buildSitemapEntries } from "../src/lib/sitemap-contract.js";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(storefrontDir);
const nextDistDir = join(storefrontDir, ".next");

function resolveNextBin(): string {
  const candidates = [
    join(storefrontDir, "node_modules", ".bin", "next"),
    join(repoRoot, "node_modules", ".bin", "next"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) {
    throw new Error(`could not find the "next" binary in any of: ${candidates.join(", ")}`);
  }
  return found;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("could not determine a free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
  return out;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok || response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server at ${url} never became ready: ${String(lastError)}`);
}

function extractCanonical(html: string): string | null {
  const match = /<link rel="canonical" href="([^"]+)"/.exec(html);
  return match?.[1] ?? null;
}

interface HostRequestResult {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  readonly body: string;
}

/**
 * Issues a request against `127.0.0.1:port` while genuinely varying the
 * `Host` header — the thing this whole suite's host-based tests exist to
 * exercise. The global `fetch` (undici) treats `Host` as a forbidden header
 * and silently sends the real connection authority instead of whatever is
 * passed in `headers`, which would make every host-based assertion here pass
 * or fail for the wrong reason. `node:http` has no such restriction.
 */
function requestWithHost(port: number, path: string, host: string): Promise<HostRequestResult> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { Host: host },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

const uuid = crypto.randomUUID();
const scratchDir = mkdtempSync(join(tmpdir(), "plepic-build-and-serve-"));

function randomDigits(length: number): string {
  return Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join("");
}

/**
 * The canary set, **derived** from `src/config/runtime-env.ts` rather than
 * hand-listed.
 *
 * The previous revision of this file listed six names by hand. Three
 * variables had no canary at all, and nothing whatsoever forced one to be
 * added when a new variable landed — which is precisely the moment the plan
 * warns about, since Task 5 adds the Stripe and Medusa publishable keys.
 * Deriving the set means a name added to `RUNTIME_ENV_VARS` gets an opaque,
 * unique, unmistakable canary automatically, and `SHAPED` only has to say
 * something for the few variables whose value has to parse as something in
 * particular.
 *
 * `tests/runtime-config.test.ts` holds up the other end: it scans `src/` and
 * asserts `RUNTIME_ENV_VARS` is exactly the set of variables the source
 * actually reads, so a new variable cannot skip the list either.
 */
const SHAPED: Partial<Record<RuntimeEnvVar, string>> = {
  SITE_BASE_URL: `https://build-canary-${uuid}.example.com`,
  SITE_CANONICAL_HOST: `build-canary-${uuid}.example.com`,
  SITE_TEST_HOSTNAMES: `test-build-canary-${uuid}.example.com`,
  CATALOGUE_MOCK_PRICE_AMOUNT: randomDigits(18),
  // XTS is ISO 4217's code reserved for testing. See NOT_UNIQUELY_SCANNABLE.
  CATALOGUE_MOCK_PRICE_CURRENCY: "XTS",
  CATALOGUE_MOCK_AVAILABILITY: "PreOrder",
  REDIRECT_MAP_PATH: join(scratchDir, `build-canary-${uuid}`, "redirect-map.json"),
};

const BUILD_TIME_ENV = Object.fromEntries(
  RUNTIME_ENV_VARS.map((name) => [name, SHAPED[name] ?? `build-canary-${name}-${uuid}`]),
) as Record<RuntimeEnvVar, string>;

/**
 * Two variables whose value cannot be made unique, so scanning a minified
 * bundle for it proves nothing either way.
 *
 * `CATALOGUE_MOCK_PRICE_CURRENCY` is a three-letter ISO 4217 code and
 * `CATALOGUE_MOCK_AVAILABILITY` is one of four schema.org tokens that appear
 * in this package's own source by necessity — `src/config/runtime-config.ts`
 * validates against them. A three-character or dictionary-word needle matches
 * a large minified bundle by coincidence, so a passing scan would be luck and
 * a failing one would be noise.
 *
 * They are not unguarded. Both still get a *distinct* build-time value above,
 * and "the running server reflects the runtime environment" below asserts the
 * served product page carries the runtime currency and availability rather
 * than the build-time ones — which is the property the scan is a proxy for,
 * observed directly instead.
 */
const NOT_UNIQUELY_SCANNABLE: readonly RuntimeEnvVar[] = [
  "CATALOGUE_MOCK_PRICE_CURRENCY",
  "CATALOGUE_MOCK_AVAILABILITY",
];

/**
 * The operator redirect map the *running* server uses, at a path the build
 * never saw. It carries the fixture's three hosts plus one the fixture does
 * not have, so a passing redirect assertion below proves the server read this
 * file rather than the bundled fixture — which is the whole `REDIRECT_MAP_PATH`
 * hand-off Task 5 depends on.
 */
const runtimeRedirectMapPath = join(scratchDir, "operator-redirect-map.json");

const RUNTIME_ENV: Record<RuntimeEnvVar, string> = {
  SITE_BASE_URL: "https://runtime.example.com",
  SITE_CANONICAL_HOST: "runtime.example.com",
  SITE_TEST_HOSTNAMES: "test.runtime.example.com,test-admin.runtime.example.com",
  ANALYTICS_MEASUREMENT_ID: "G-RUNTIMEVALUE",
  TURNSTILE_SITE_KEY: "0xRUNTIMEVALUE",
  CATALOGUE_MOCK_PRODUCT_NAME: "Lunar Base",
  CATALOGUE_MOCK_PRICE_AMOUNT: "4200",
  CATALOGUE_MOCK_PRICE_CURRENCY: "EUR",
  CATALOGUE_MOCK_AVAILABILITY: "InStock",
  REDIRECT_MAP_PATH: runtimeRedirectMapPath,
};

interface RunningServer {
  readonly process: ReturnType<typeof spawn>;
  readonly port: number;
}

async function startServer(env: Record<string, string>): Promise<RunningServer> {
  const port = await findFreePort();
  const process_ = spawn(process.execPath, [resolveNextBin(), "start", "-p", String(port)], {
    cwd: storefrontDir,
    env: { ...process.env, ...env, NODE_ENV: "production" },
    stdio: "pipe",
  });
  await waitForServer(`http://127.0.0.1:${port}/`, 60_000);
  return { process: process_, port };
}

let server: RunningServer;
let buildArtifactText: string;

beforeAll(async () => {
  rmSync(nextDistDir, { recursive: true, force: true });

  writeFileSync(
    runtimeRedirectMapPath,
    JSON.stringify({
      hosts: {
        "www.runtime.example.com": [{ path: "*", target: "home" }],
        "alt-brand.runtime.example.org": [
          { path: "/rules", target: "rulebook" },
          { path: "*", target: "lunarBase" },
        ],
        "www.alt-brand.runtime.example.org": [{ path: "*", target: "lunarBase" }],
        "operator-only.runtime.example.org": [{ path: "*", target: "about" }],
      },
    }),
    "utf8",
  );

  const build = spawnSync(process.execPath, [resolveNextBin(), "build", "--webpack"], {
    cwd: storefrontDir,
    env: { ...process.env, ...BUILD_TIME_ENV, NODE_ENV: "production" },
    encoding: "utf8",
  });

  if (build.status !== 0) {
    throw new Error(`next build failed (status ${String(build.status)}):\n${build.stdout}\n${build.stderr}`);
  }

  const artifactDirs = [join(nextDistDir, "server"), join(nextDistDir, "static")];
  const artifactFiles = artifactDirs.flatMap(listFiles);
  buildArtifactText = artifactFiles
    .map((path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return ""; // binary file (a font, an image) — cannot contain a text env value
      }
    })
    .join("\n");

  server = await startServer(RUNTIME_ENV);
}, 300_000);

afterAll(() => {
  server?.process.kill();
  rmSync(nextDistDir, { recursive: true, force: true });
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("the canary set is complete", () => {
  it("gives every declared runtime variable a build-time canary", () => {
    expect(Object.keys(BUILD_TIME_ENV).toSorted()).toEqual([...RUNTIME_ENV_VARS].toSorted());
  });

  it("gives every declared runtime variable a different runtime value", () => {
    for (const name of RUNTIME_ENV_VARS) {
      expect(RUNTIME_ENV[name], `${name} has no runtime value to distinguish it from its canary`).toBeDefined();
      expect(RUNTIME_ENV[name], `${name} is identical at build time and at run time`).not.toBe(
        BUILD_TIME_ENV[name],
      );
    }
  });

  it("exempts nothing from the artifact scan that has not been justified in NOT_UNIQUELY_SCANNABLE", () => {
    const declared: readonly string[] = RUNTIME_ENV_VARS;
    expect(NOT_UNIQUELY_SCANNABLE.every((name) => declared.includes(name))).toBe(true);
    expect(NOT_UNIQUELY_SCANNABLE.length).toBeLessThan(RUNTIME_ENV_VARS.length / 2);
  });
});

describe("no built artifact contains a value that differs between environments", () => {
  it("actually built something to scan", () => {
    expect(buildArtifactText.length).toBeGreaterThan(0);
  });

  const exempt: readonly string[] = NOT_UNIQUELY_SCANNABLE;
  for (const [name, value] of Object.entries(BUILD_TIME_ENV)) {
    if (exempt.includes(name)) continue;
    it(`the build-time value of ${name} does not appear anywhere in .next/server or .next/static`, () => {
      expect(buildArtifactText.includes(value)).toBe(false);
    });
  }
});

/**
 * The Content-Security-Policy contract, checked against real served HTML.
 *
 * `node:http` does not enforce CSP, so nothing here fails because a browser
 * refused a script. What it can do — and what no other test in this
 * repository does — is compare the nonce the response header tells a browser
 * to trust against the nonce on the tags in the body, which is the only thing
 * standing between `'strict-dynamic'` and a page that never hydrates.
 */
describe("the CSP nonce the browser is told to trust is the one on the page", () => {
  const SCRIPT_TAG = /<script\b[^>]*>/g;
  const STYLESHEET_LINK = /<link\b[^>]*rel="stylesheet"[^>]*>/g;

  function nonceFromCsp(csp: string | undefined): string {
    expect(csp, "no Content-Security-Policy response header").toBeTypeOf("string");
    const scriptSrc = (csp ?? "")
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src"));
    expect(scriptSrc, "the policy has no script-src directive").toBeDefined();

    const match = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/.exec(scriptSrc ?? "");
    expect(match?.[1], "script-src carries no nonce source").toBeTruthy();
    return match?.[1] ?? "";
  }

  for (const path of ["/", "/games/lunar-base"]) {
    it(`nonces every script tag ${path} emits`, async () => {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status).toBe(200);

      const nonce = nonceFromCsp(
        typeof response.headers["content-security-policy"] === "string"
          ? response.headers["content-security-policy"]
          : undefined,
      );

      const tags = response.body.match(SCRIPT_TAG) ?? [];
      // Framework bundle, route chunk, polyfills, webpack runtime, the inline
      // flight scripts, the runtime-config blob. If this ever collapses to a
      // handful, the assertion below has stopped meaning anything.
      expect(tags.length, "suspiciously few script tags to check").toBeGreaterThan(5);

      const unnonced = tags.filter((tag) => !tag.includes(`nonce="${nonce}"`));
      expect(
        unnonced,
        "these script tags carry no nonce, or a different one — under 'strict-dynamic' " +
          "the browser blocks every one of them and the page never hydrates",
      ).toEqual([]);
    });
  }

  it("nonces the stylesheet links too, because style-src is nonce-based as well", async () => {
    const response = await requestWithHost(server.port, "/", "runtime.example.com");
    const nonce = nonceFromCsp(
      typeof response.headers["content-security-policy"] === "string"
        ? response.headers["content-security-policy"]
        : undefined,
    );

    const links = response.body.match(STYLESHEET_LINK) ?? [];
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((link) => !link.includes(`nonce="${nonce}"`))).toEqual([]);
  });

  it("actually emits the inline flight scripts the nonce has to cover", async () => {
    const response = await requestWithHost(server.port, "/", "runtime.example.com");
    expect(response.body).toContain("self.__next_f.push");
  });

  it("mints a fresh nonce per request, so one leaked page does not authorise the next", async () => {
    const [first, second] = await Promise.all([
      requestWithHost(server.port, "/", "runtime.example.com"),
      requestWithHost(server.port, "/", "runtime.example.com"),
    ]);

    const firstNonce = nonceFromCsp(
      typeof first.headers["content-security-policy"] === "string"
        ? first.headers["content-security-policy"]
        : undefined,
    );
    const secondNonce = nonceFromCsp(
      typeof second.headers["content-security-policy"] === "string"
        ? second.headers["content-security-policy"]
        : undefined,
    );

    expect(firstNonce).not.toBe(secondNonce);
  });

  it("keeps 'strict-dynamic' in script-src, which is what makes all of the above load-bearing", async () => {
    const response = await requestWithHost(server.port, "/", "runtime.example.com");
    expect(response.headers["content-security-policy"]).toContain("'strict-dynamic'");
  });
});

describe("the running server reflects the runtime environment, not the build-time one", () => {
  it("serves the sitemap built from the runtime base URL", async () => {
    const response = await requestWithHost(server.port, "/sitemap.xml", "runtime.example.com");
    expect(response.status).toBe(200);
    expect(response.body).toContain(RUNTIME_ENV.SITE_BASE_URL);
    expect(response.body).not.toContain(BUILD_TIME_ENV.SITE_BASE_URL);

    const expected = buildSitemapEntries(RUNTIME_ENV.SITE_BASE_URL);
    for (const entry of expected) {
      expect(response.body).toContain(entry.url);
    }
  });

  it("serves an allow robots.txt for the live host, pointing at the sitemap", async () => {
    const response = await requestWithHost(server.port, "/robots.txt", "runtime.example.com");
    expect(response.status).toBe(200);
    expect(response.body.toLowerCase()).toContain("disallow: /cart");
    expect(response.body.toLowerCase()).toContain("disallow: /checkout");
    expect(response.body).toContain("runtime.example.com/sitemap.xml");
  });

  it("every sitemap URL answers 200 with a self-referencing canonical", async () => {
    const entries = buildSitemapEntries(RUNTIME_ENV.SITE_BASE_URL);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const response = await requestWithHost(server.port, entry.path, "runtime.example.com");
      expect(response.status, `${entry.path} did not answer 200`).toBe(200);

      const canonical = extractCanonical(response.body);
      expect(canonical, `${entry.path} carries no canonical link`).toBe(entry.url);
    }
  });

  it("gives the canonical product page Product/Offer JSON-LD sourced from the runtime configuration", async () => {
    const response = await requestWithHost(server.port, "/games/lunar-base", "runtime.example.com");
    expect(response.body).toContain('"@type":"Product"');
    expect(response.body).toContain('"priceCurrency":"EUR"');
    expect(response.body).toContain('"price":"42.00"');
    expect(response.body).toContain('"availability":"https://schema.org/InStock"');

    // The build-time currency and availability were XTS and PreOrder. Neither
    // is scannable in a minified bundle; both are observable right here.
    expect(response.body).not.toContain('"priceCurrency":"XTS"');
    expect(response.body).not.toContain("PreOrder");
  });
});

describe("host redirects are a single hop to a page that answers 200", () => {
  /**
   * The previous revision asserted only that `Location` started with the base
   * URL, and never requested it. A redirect target that itself redirected —
   * the exact failure the checkbox's "single hop to a final URL" forbids —
   * would have passed. So follow it.
   */
  const cases: readonly { readonly host: string; readonly path: string }[] = [
    { host: "www.runtime.example.com", path: "/" },
    { host: "alt-brand.runtime.example.org", path: "/" },
    { host: "alt-brand.runtime.example.org", path: "/rules" },
    { host: "www.alt-brand.runtime.example.org", path: "/anything-unmapped" },
    // Present only in the operator map at REDIRECT_MAP_PATH, never in the
    // committed fixture: proof the running server read the operator file.
    { host: "operator-only.runtime.example.org", path: "/" },
  ];

  for (const testCase of cases) {
    it(`${testCase.host}${testCase.path} answers one 301 to a 200`, async () => {
      const response = await requestWithHost(server.port, testCase.path, testCase.host);
      expect(response.status).toBe(301);

      const location = response.headers.location;
      expect(location, "no Location header").toBeTypeOf("string");
      expect(typeof location === "string" && location.startsWith(`${RUNTIME_ENV.SITE_BASE_URL}/`)).toBe(
        true,
      );

      const target = new URL(location ?? "");
      const followed = await requestWithHost(
        server.port,
        `${target.pathname}${target.search}`,
        target.host,
      );
      expect(followed.status, `${location} did not answer 200 — that is a second hop`).toBe(200);
      expect(followed.headers.location, `${location} redirected again`).toBeUndefined();
    });
  }

  it("never redirects the canonical host itself", async () => {
    const response = await requestWithHost(server.port, "/", "runtime.example.com");
    expect(response.status).toBe(200);
  });
});

describe("test hostnames", () => {
  it("are marked noindex by header, by robots.txt, and by the page's own metadata", async () => {
    for (const testHost of ["test.runtime.example.com", "test-admin.runtime.example.com"]) {
      const pageResponse = await requestWithHost(server.port, "/", testHost);
      expect(pageResponse.headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(pageResponse.body).toContain('name="robots" content="noindex, nofollow"');

      const robotsResponse = await requestWithHost(server.port, "/robots.txt", testHost);
      const body = robotsResponse.body.toLowerCase();
      expect(body).toContain("disallow: /");
      expect(body).not.toContain("sitemap:");
    }
  });

  it("do not make the live host noindex", async () => {
    const response = await requestWithHost(server.port, "/", "runtime.example.com");
    expect(response.headers["x-robots-tag"]).toBeUndefined();
    expect(response.body).not.toContain('content="noindex');
  });
});

/**
 * The same build, served by a second process that configures no catalogue
 * price at all — the state an unconfigured deployment is actually in.
 *
 * The previous revision defaulted the price to 3900, the currency to EUR and
 * the availability to InStock, so an unconfigured deployment published
 * `"price":"39.00"` as `Offer` structured data to search engines and nothing
 * failed, warned, or tested for it. There is no reserved price the way RFC
 * 2606 reserves `example.com`, so the only truthful thing to publish is
 * nothing.
 */
describe("an unconfigured deployment publishes no price", () => {
  let unpriced: RunningServer;

  beforeAll(async () => {
    unpriced = await startServer({
      SITE_BASE_URL: "https://unpriced.example.com",
      SITE_CANONICAL_HOST: "unpriced.example.com",
    });
  }, 120_000);

  afterAll(() => {
    unpriced?.process.kill();
  });

  it("still serves the product page", async () => {
    const response = await requestWithHost(unpriced.port, "/games/lunar-base", "unpriced.example.com");
    expect(response.status).toBe(200);
    expect(response.body).toContain('"@type":"Product"');
  });

  it("publishes no Offer, no price, no currency and no availability", async () => {
    const response = await requestWithHost(unpriced.port, "/games/lunar-base", "unpriced.example.com");
    expect(response.body).not.toContain('"@type":"Offer"');
    expect(response.body).not.toContain('"price"');
    expect(response.body).not.toContain('"priceCurrency"');
    expect(response.body).not.toContain('"availability"');
  });

  it("publishes none of the previous revision's fabricated defaults", async () => {
    const response = await requestWithHost(unpriced.port, "/games/lunar-base", "unpriced.example.com");
    expect(response.body).not.toContain("39.00");
    expect(response.body).not.toContain("schema.org/InStock");
  });
});
