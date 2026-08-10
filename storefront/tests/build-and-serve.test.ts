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
 * 3. **Start it a second time** with nothing configured but the two host
 *    variables — the state every deployment is actually in — and confirm the
 *    product page publishes the same price to a crawler that it renders to a
 *    person, and that copy quoting an unconfigured merchant address is
 *    suppressed rather than rendered with a brace in it.
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

import { checkout as checkoutCopy, unavailableFigure } from "../../content/shop.js";
import {
  CHECKOUT_ORDER_POST_PATH,
  ORDER_NOT_PLACED,
  ORDER_NOT_PLACED_LOCATION,
  ORDER_OUTCOME_PARAM,
} from "../src/components/shop/checkout-order-post.js";
import {
  CARD_STATEMENT,
  CONFIRMATION_PROMISE,
  CONSENT_LINE,
  CONTRACT_FORMATION,
  DELIVERY_ESTIMATE,
  RETURN_POSTAGE,
} from "../src/components/shop/checkout-terms.js";
import { formatAmount } from "../src/lib/cart.js";
import { RUNTIME_ENV_VARS, type RuntimeEnvVar } from "../src/config/runtime-env.js";
import { RUNTIME_CONFIG_ELEMENT_ID } from "../src/lib/client-runtime-config.js";
import { resolveCatalogue } from "../src/lib/catalogue.js";
import { buildProductJsonLd } from "../src/lib/product-jsonld.js";
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

/**
 * The text a browser paints: `<script>` and `<style>` blocks removed with
 * their contents, then tags stripped.
 *
 * Needed because the brace assertions below run against a whole served page,
 * and a minified framework chunk contains `{a}`-shaped substrings by the
 * dozen. Scanning raw HTML for a placeholder grammar therefore reports the
 * webpack runtime as a content defect. `tests/no-unresolved-placeholder.test.tsx`
 * strips the same two elements for the same reason, and deliberately strips
 * nothing else — `<details>` in particular stays, because "not visible in the
 * first paint" is exactly the excuse under which the `{priceLine}` defect
 * shipped.
 */
function paintedText(html: string): string {
  return html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/g, " ")
    .replaceAll(/<[^>]+>/g, " ");
}

/**
 * The details a legal page's incompleteness notice enumerates, as a list.
 *
 * Parsed out rather than compared as one joined string: the joined form was
 * pinned to the runtime's default ICU collation, so a container with a
 * different `LANG` flipped two entries and reddened the suite for a reason
 * that had nothing to do with the page. React's SSR text separators become
 * whitespace under {@link paintedText}, so entries are trimmed.
 */
function noticeLabels(html: string): readonly string[] {
  const listed = /text below:([^.]+)\./.exec(paintedText(html))?.[1] ?? "";
  return listed
    .split(",")
    .map((entry) => entry.replaceAll(/\s+/g, " ").trim())
    .filter((entry) => entry.length > 0);
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

/**
 * The same, as a form POST with a urlencoded body — what a browser does when
 * it submits the checkout form itself, before hydration or with JavaScript
 * off. `redirect` is never followed: the point of the assertion is the status
 * and the `Location`, and in particular that neither carries a field value.
 */
function postFormWithHost(
  port: number,
  path: string,
  host: string,
  fields: Readonly<Record<string, string>>,
): Promise<HostRequestResult> {
  const body = new URLSearchParams(fields).toString();
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Host: host,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
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
    request.write(body);
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
  MERCHANT_CONTACT_ADDRESS: `build-canary-${randomDigits(18)}@example.com`,
  REDIRECT_MAP_PATH: join(scratchDir, `build-canary-${uuid}`, "redirect-map.json"),
  // Rendered into an `href`, so it has to parse as a URL rather than as an
  // opaque token — a canary that cannot be a destination proves nothing about
  // whether the destination was baked in.
  EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE: `https://build-canary-${uuid}.example.org/committee`,
};

const BUILD_TIME_ENV = Object.fromEntries(
  RUNTIME_ENV_VARS.map((name) => [name, SHAPED[name] ?? `build-canary-${name}-${uuid}`]),
) as Record<RuntimeEnvVar, string>;

/**
 * Variables whose value cannot be made unique, so scanning a minified bundle
 * for it proves nothing either way.
 *
 * **Currently empty, and that is the improvement.** The two entries that used
 * to be here were `CATALOGUE_MOCK_PRICE_CURRENCY` (a three-letter ISO 4217
 * code) and `CATALOGUE_MOCK_AVAILABILITY` (one of four schema.org tokens the
 * source validates against, so the needle appears in the bundle by
 * necessity). Both variables are gone: the price, currency, availability and
 * product name are identical in every environment and are read from
 * `storefront/mock/catalogue.json`, not from configuration — see
 * `src/config/runtime-config.ts`. An exemption removed by deleting the thing
 * that needed it is worth more than an exemption argued for.
 */
const NOT_UNIQUELY_SCANNABLE: readonly RuntimeEnvVar[] = [];

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
  MERCHANT_CONTACT_ADDRESS: "runtime-value@example.com",
  MERCHANT_LEGAL_NAME: "Runtime Value Legal Name OU",
  MERCHANT_PHONE_NUMBER: "+000 00 000000",
  MERCHANT_REGISTERED_ADDRESS: "1 Runtime Value Street, Runtime Value Town",
  MERCHANT_REGISTRATION_NUMBER: "RUNTIMEVALUE-REG",
  MERCHANT_RETURN_ADDRESS: "2 Runtime Value Street, Runtime Value Town",
  MERCHANT_VAT_NUMBER: "RUNTIMEVALUE-VAT",
  EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE: "https://runtime-value.example.org/committee",
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

  it("declares no catalogue variable, so no environment can move the published price", () => {
    expect(RUNTIME_ENV_VARS.filter((name) => name.startsWith("CATALOGUE_"))).toEqual([]);
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

  it("resolves the merchant contact address from the runtime environment, not the build-time one", async () => {
    const response = await requestWithHost(server.port, "/support/lunar-base", "runtime.example.com");
    expect(response.status).toBe(200);
    expect(response.body).toContain(RUNTIME_ENV.MERCHANT_CONTACT_ADDRESS);
    expect(response.body).not.toContain(BUILD_TIME_ENV.MERCHANT_CONTACT_ADDRESS);
    // And never as a brace: this route shipped "You can also reach us at
    // {merchantContactAddress}." in plain body type to every visitor.
    expect(response.body).not.toContain("{merchantContactAddress}");
  });

  /**
   * The other half of the same fact. The serialized runtime-config blob goes
   * into the HTML of every route, and it was built by spreading
   * `RuntimeConfig` wholesale, so the merchant's address was in the markup of
   * `/cart`, `/checkout` and every legal page — routes that never quote it and
   * whose client-side code never reads it. `src/lib/client-runtime-config.ts`
   * now names the fields it publishes; this is that assertion made against a
   * running server rather than against the projection function, because the
   * failure was in what the *page* served.
   */
  it("never serializes the merchant address into the runtime-config blob, on any route", async () => {
    const BLOB = new RegExp(
      `<script[^>]*id="${RUNTIME_CONFIG_ELEMENT_ID}"[^>]*>([\\s\\S]*?)</script>`,
    );

    for (const path of [
      "/",
      "/cart",
      "/checkout",
      "/legal/terms",
      "/legal/imprint",
      "/games/lunar-base",
    ]) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, `${path} did not answer 200`).toBe(200);

      const blob = BLOB.exec(response.body)?.[1];
      expect(blob, `${path} carries no runtime-config blob to check`).toBeTypeOf("string");
      expect(blob, `${path} serialized the merchant contact address`).not.toContain(
        RUNTIME_ENV.MERCHANT_CONTACT_ADDRESS,
      );
      expect(blob, `${path} serialized the merchant legal name`).not.toContain(
        RUNTIME_ENV.MERCHANT_LEGAL_NAME,
      );
      expect(blob, `${path} serialized a merchant field at all`).not.toContain("merchant");
    }
  });

  it("keeps the merchant address out of the body of routes that do not quote it", async () => {
    for (const path of ["/", "/cart", "/checkout"]) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, `${path} did not answer 200`).toBe(200);
      expect(response.body, `${path} rendered the merchant contact address`).not.toContain(
        RUNTIME_ENV.MERCHANT_CONTACT_ADDRESS,
      );
    }
  });
});

/**
 * The legal pages and the GPSR block, as a browser is actually served them.
 *
 * Every route under `/legal/` used to render `RoutePlaceholder` — a heading
 * and the page's own meta description — so not one word of `content/legal/*`
 * reached a visitor, and every existing test stayed green because each asked
 * whether the route answered 200 with a self-referencing canonical, and it
 * did. These ask what is on it.
 */
describe("the legal pages serve their content, resolved from the runtime environment", () => {
  const LEGAL_PATHS = [
    "/legal/imprint",
    "/legal/terms",
    "/legal/shipping",
    "/legal/returns",
    "/legal/privacy",
  ] as const;

  it("renders the whole trader identity on the imprint, from this process's environment", async () => {
    const response = await requestWithHost(server.port, "/legal/imprint", "runtime.example.com");
    expect(response.status).toBe(200);

    for (const value of [
      RUNTIME_ENV.MERCHANT_LEGAL_NAME,
      RUNTIME_ENV.MERCHANT_REGISTERED_ADDRESS,
      RUNTIME_ENV.MERCHANT_REGISTRATION_NUMBER,
      RUNTIME_ENV.MERCHANT_VAT_NUMBER,
      RUNTIME_ENV.MERCHANT_CONTACT_ADDRESS,
      RUNTIME_ENV.MERCHANT_PHONE_NUMBER,
    ]) {
      expect(response.body, `the imprint does not state ${value}`).toContain(value);
    }

    expect(response.body).not.toContain(BUILD_TIME_ENV.MERCHANT_LEGAL_NAME);
    expect(response.body).toContain("Estonian Commercial Register");
  });

  it("renders the return address on the returns page", async () => {
    const response = await requestWithHost(server.port, "/legal/returns", "runtime.example.com");
    expect(response.body).toContain(RUNTIME_ENV.MERCHANT_RETURN_ADDRESS);
  });

  it("leaves no brace, no marker and no incompleteness notice on any of the five", async () => {
    for (const path of LEGAL_PATHS) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, `${path} did not answer 200`).toBe(200);
      expect(paintedText(response.body), `${path} rendered an unresolved placeholder`).not.toMatch(
        /\{[A-Za-z][A-Za-z0-9]*\}/,
      );
      expect(response.body, `${path} rendered an unconfigured marker`).not.toContain(
        "[not configured",
      );
      expect(response.body, `${path} rendered the incompleteness notice`).not.toContain(
        "legal-incomplete-notice",
      );
    }
  });

  /**
   * Article 6(1)(t) CRD wants the out-of-court body **and the method of
   * reaching it**. The address is configuration, because `content/` may hold
   * no host, so this is the assertion that the configured address actually
   * reaches the served page rather than stopping at the config object.
   */
  it("serves the dispute-resolution access method, resolved from the environment", async () => {
    const response = await requestWithHost(server.port, "/legal/terms", "runtime.example.com");
    expect(response.status).toBe(200);

    expect(response.body).toContain("Consumer Disputes Committee");
    expect(response.body, "the forum is named with no way to reach it").toContain(
      `href="${RUNTIME_ENV.EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE}"`,
    );
    expect(response.body).not.toContain(
      BUILD_TIME_ENV.EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE,
    );
  });

  /**
   * Minor 2, and the operator's replacement wording of 2026-08-10: no
   * unqualified "VAT included" on the page whose job is to say something more
   * careful, because no EU VAT is due on an export.
   */
  it("serves one statement about tax on the shipping page, and it is the qualified one", async () => {
    const response = await requestWithHost(server.port, "/legal/shipping", "runtime.example.com");
    expect(response.status).toBe(200);

    const text = paintedText(response.body);
    expect(text).toContain(`${resolveCatalogue().price} · VAT included where applicable`);
    expect(text).toContain("Non-EU taxes and duties, if any, are not included.");
    expect(text, "the shipping page asserts VAT is included, unqualified").not.toMatch(
      /VAT included(?! where applicable)/,
    );
    expect(text).toContain(
      "Where VAT is due on your order, it is contained within that figure rather than added to it",
    );
  });

  /**
   * The same wording, one page up, and this is why the finding named the
   * product page as well: a legal page saying *"where applicable"* over a
   * purchase panel saying *"VAT included"* flatly moves the contradiction to
   * the more prominent of the two. Both read `priceQualifiers`.
   */
  it("presents the price identically on the product page", async () => {
    const response = await requestWithHost(
      server.port,
      "/games/lunar-base",
      "runtime.example.com",
    );
    expect(response.status).toBe(200);

    const text = paintedText(response.body);
    expect(text).toContain(resolveCatalogue().price);
    expect(text).toContain(resolveCatalogue().priceQualifiers);
    expect(text, "the product page asserts VAT is included, unqualified").not.toMatch(
      /VAT included(?! where applicable)/,
    );
  });

  /**
   * Four columns, and the one that gets lost is `Duration`. Asserted on the
   * **served** page rather than on the content object, because the failure that
   * matters is a renderer that reads three of the four.
   */
  it("serves the cookie table's four columns and the operator's two sentences", async () => {
    const response = await requestWithHost(server.port, "/legal/privacy", "runtime.example.com");
    expect(response.status).toBe(200);

    const text = paintedText(response.body);
    for (const cell of [
      "Cookie",
      "Provider",
      "Purpose",
      "Duration",
      "Up to 2 years",
      "Up to 3 months",
      "Varies",
      "Security, traffic management and protection against malicious traffic",
    ]) {
      expect(text, `the served cookie table is missing "${cell}"`).toContain(cell);
    }

    expect(text).toContain("Google Analytics and Meta cookies are used only with your consent.");
    expect(text).toContain(
      "Cloudflare security cookies are strictly necessary for the operation and security of the " +
        "site and do not require consent.",
    );
  });

  it("says out loud that all five are drafts pending the operator", async () => {
    for (const path of LEGAL_PATHS) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.body, `${path} does not say it is a draft`).toContain("legal-draft-note");
    }
  });

  it("carries the product page's GPSR manufacturer identity, contact and test report", async () => {
    const response = await requestWithHost(
      server.port,
      "/games/lunar-base",
      "runtime.example.com",
    );
    expect(response.status).toBe(200);
    expect(response.body).toContain(RUNTIME_ENV.MERCHANT_LEGAL_NAME);
    expect(response.body).toContain(RUNTIME_ENV.MERCHANT_REGISTERED_ADDRESS);
    expect(response.body).toContain(RUNTIME_ENV.MERCHANT_CONTACT_ADDRESS);
    expect(response.body).toContain(RUNTIME_ENV.MERCHANT_PHONE_NUMBER);
    expect(response.body).toContain("SHAH01338706");
    expect(response.body).not.toContain("product-safety-incomplete-notice");
  });
});

/**
 * The basket and the checkout, as a browser is actually served them.
 *
 * Both routes rendered `RoutePlaceholder` — a heading and a meta description —
 * for three merged pull requests, and every test stayed green because each
 * asked whether the route answered 200 with a canonical, and it did. These ask
 * what is on it, and in particular whether the screen `content/legal/terms.ts`
 * describes is the screen this server sends: the Article 8(2) button label, the
 * six disclosures immediately above it, the consent line, the confirmation
 * promise, the card statement and the return-postage disclosure.
 *
 * `?mock=` is the mock data layer's state parameter — see
 * `src/lib/mock-cart-actions.ts`. Without it, an empty basket is the default,
 * which is asserted first because it is what an ordinary first visit renders.
 *
 * **Every request that carries `?mock=` uses {@link MOCK_HOST}**, and that is
 * load-bearing rather than incidental: the parameter is gated off any hostname
 * a real visitor could reach, and `runtime.example.com` — this server's
 * `SITE_CANONICAL_HOST` — is exactly such a hostname. A request to it with
 * `?mock=filled` must render an empty basket, which the last block below
 * asserts directly. Sending these through the canonical host is how the
 * parameter used to be able to write into a stranger's session.
 */
const MOCK_HOST = "test.runtime.example.com";

describe("the basket and the checkout serve their real composition", () => {
  it("renders an empty basket by default, not a placeholder heading", async () => {
    const response = await requestWithHost(server.port, "/cart", "runtime.example.com");
    expect(response.status).toBe(200);

    const text = paintedText(response.body);
    expect(text).toContain("Your basket is empty");
    expect(text).toContain("Add Lunar Base to your basket");
    // The route used to render its own meta description as body copy.
    expect(text).not.toContain("What you are about to buy, and what it will cost delivered.");
  });

  it("renders an empty checkout by default", async () => {
    const response = await requestWithHost(server.port, "/checkout", "runtime.example.com");
    expect(response.status).toBe(200);
    expect(paintedText(response.body)).toContain("There is nothing to check out.");
  });

  it("prices a filled basket from the mock catalogue, and defers shipping to checkout", async () => {
    const response = await requestWithHost(
      server.port,
      "/cart?mock=filled",
      MOCK_HOST,
    );
    expect(response.status).toBe(200);

    const text = paintedText(response.body);
    expect(text).toContain(resolveCatalogue().price);
    expect(text).toContain("Calculated at checkout");
    expect(response.body).toContain('href="/checkout"');
  });

  it("serves the checkout screen content/legal/terms.ts describes", async () => {
    const response = await requestWithHost(
      server.port,
      "/checkout?mock=filled",
      MOCK_HOST,
    );
    expect(response.status).toBe(200);

    const text = paintedText(response.body);

    // Article 8(2): the label, and the six disclosures above it.
    expect(text).toContain("Order with obligation to pay");
    for (const label of [
      "The goods",
      "Price of the goods",
      "Shipping charge",
      "Total",
      "Delivery address",
      "Delivery estimate",
    ]) {
      expect(text, `the served order block is missing "${label}"`).toContain(label);
    }

    // The four sentences, verbatim from the legal page.
    for (const sentence of [
      CONSENT_LINE,
      CONFIRMATION_PROMISE,
      CARD_STATEMENT,
      CONTRACT_FORMATION,
      RETURN_POSTAGE,
      DELIVERY_ESTIMATE,
    ]) {
      expect(text, `the served checkout is missing "${sentence.slice(0, 48)}…"`).toContain(sentence);
    }

    // Article 6(1)(h): reachable here, and reachable earlier.
    expect(response.body).toContain('href="/legal/returns#withdrawal-form"');
  });

  /**
   * `initialAddress` is a documented test seam that the route never passes.
   * "Never passes" was asserted nowhere against the **served** markup, so a
   * route that started passing it — for a demo, for a screenshot, by
   * copy-paste — would put an invented person's address into a public shop and
   * nothing would say so. This is that assertion, on what the server sends.
   */
  it("serves a delivery-address form with every field empty and no country chosen", async () => {
    const response = await requestWithHost(server.port, "/checkout?mock=filled", MOCK_HOST);
    expect(response.status).toBe(200);
    expect(response.body, "a value reached a served address field").not.toMatch(
      /<input[^>]*\bname="(?:fullName|streetAddress|postalCode|city|email)"[^>]*\bvalue="[^"]/,
    );
    expect(response.body, "a country was selected before anybody chose one").not.toMatch(
      /<option value="[^"]+"[^>]*selected/,
    );
  });

  /**
   * MAJ-1. With a line that cannot be supplied, the Article 8(2) block stated
   * "Price of the goods: €0.00" and a total that was the shipping charge on its
   * own. An address cannot be typed over HTTP without a browser, so what is
   * asserted here is the half that is in the first paint: no figure of nothing,
   * the instruction that replaced it, and the button saying so where the button
   * is rather than only at the top of a very long page.
   */
  it("states no price for a basket it cannot supply, and says so at the button", async () => {
    const response = await requestWithHost(server.port, "/checkout?mock=unavailable", MOCK_HOST);
    expect(response.status).toBe(200);

    const text = paintedText(response.body);
    expect(text, "the goods were priced at nothing").not.toContain(formatAmount(0, "EUR"));
    expect(text).toContain(unavailableFigure);
    expect(text).toContain(checkoutCopy.errors.unavailableLine);
    expect(response.body).toMatch(/<button[^>]*aria-disabled="true"/);
    expect(response.body).toContain('role="status"');
    expect(response.body, "a disabled attribute would drop focus").not.toMatch(
      /<button[^>]*\sdisabled(?:=|\s|>)/,
    );
  });

  it("reaches the withdrawal conditions and the model form from the basket too", async () => {
    const response = await requestWithHost(server.port, "/cart", "runtime.example.com");
    expect(response.body).toContain('href="/legal/returns#withdrawal"');
    expect(response.body).toContain('href="/legal/returns#withdrawal-form"');
  });

  it("serves no card field and no payment script on either route", async () => {
    for (const path of ["/cart?mock=filled", "/checkout?mock=filled"]) {
      const response = await requestWithHost(server.port, path, MOCK_HOST);
      expect(response.body).not.toMatch(/autocomplete="cc-/i);
      expect(response.body.toLowerCase()).not.toContain("js.stripe");
    }
  });

  it("leaves no unresolved placeholder on either route, in any state", async () => {
    for (const path of [
      "/cart",
      "/cart?mock=filled",
      "/cart?mock=updating",
      "/cart?mock=error",
      "/cart?mock=unavailable",
      "/checkout",
      "/checkout?mock=filled",
      "/checkout?mock=placing",
      "/checkout?mock=error",
      "/checkout?mock=unavailable",
      `/checkout?${ORDER_OUTCOME_PARAM}=${ORDER_NOT_PLACED}`,
    ]) {
      const response = await requestWithHost(server.port, path, MOCK_HOST);
      expect(response.status, `${path} did not answer 200`).toBe(200);
      expect(paintedText(response.body), `${path} rendered an unresolved placeholder`).not.toMatch(
        /\{[A-Za-z][A-Za-z0-9]*\}/,
      );
    }
  });
});

/**
 * MAJ-2: no value a visitor typed into the checkout form may reach a URL — not
 * in the URL bar, not in browser history, not in a `Referer` header, and not in
 * any access log between the tunnel and Loki.
 *
 * The defect was a `<form>` with no `method`, which is a GET. It fired with
 * JavaScript off, and in the window between first paint and hydration — which
 * under this application's `'strict-dynamic'` CSP is not hypothetical, because
 * a nonce mismatch leaves a page that paints and never hydrates.
 *
 * These assertions are what a browser can be shown to be able to do, on the
 * real served markup, without running any of the page's JavaScript: the served
 * form declares a POST, the POST answers a redirect that carries no field
 * value, and the page it redirects to says plainly that no order was placed.
 */
describe("the checkout form cannot put a delivery address in a URL", () => {
  it("serves a form that posts, with an action, before anything hydrates", async () => {
    const response = await requestWithHost(server.port, "/checkout?mock=filled", MOCK_HOST);
    expect(response.status).toBe(200);

    const form = /<form\b[^>]*>/.exec(response.body)?.[0] ?? "";
    expect(form, "the checkout served no form at all").not.toBe("");
    expect(form, "a form with no method is a GET, and a GET puts the address in the URL").toMatch(
      /method="post"/i,
    );
    expect(form).toContain(`action="${CHECKOUT_ORDER_POST_PATH}"`);
  });

  it("answers an unhydrated submission with a redirect that carries no field value", async () => {
    const typed = {
      fullName: "Name",
      streetAddress: "Street and number",
      postalCode: "00000",
      city: "Town",
      country: "Estonia",
      email: "example@example.com",
    };
    const response = await postFormWithHost(
      server.port,
      CHECKOUT_ORDER_POST_PATH,
      MOCK_HOST,
      typed,
    );

    // 303, so a reload of the destination cannot re-post the form.
    expect(response.status).toBe(303);

    const location = response.headers.location ?? "";
    expect(location).toBe(ORDER_NOT_PLACED_LOCATION);
    for (const [field, value] of Object.entries(typed)) {
      expect(location, `"${field}" reached the redirect target`).not.toContain(value);
      expect(location, `"${field}" reached the redirect target`).not.toContain(
        encodeURIComponent(value),
      );
      expect(location).not.toContain(field);
    }
  });

  it("says plainly that no order was placed, in the first paint, with no script involved", async () => {
    const response = await requestWithHost(
      server.port,
      ORDER_NOT_PLACED_LOCATION,
      MOCK_HOST,
    );
    expect(response.status).toBe(200);
    // Read out of the served markup with every <script> stripped: this message
    // is in the HTML the server sent, not something hydration produced.
    expect(paintedText(response.body)).toContain(checkoutCopy.errors.paymentNotConnected);
  });

  it("exposes nothing on that path but the POST", async () => {
    const response = await requestWithHost(server.port, CHECKOUT_ORDER_POST_PATH, MOCK_HOST);
    expect(response.status).toBe(405);
  });
});

/**
 * MAJ-3: `?mock=` writes the requested basket into `sessionStorage`, so it is
 * gated off any hostname a passing stranger could be sent a link to.
 *
 * `runtime.example.com` is this server's `SITE_CANONICAL_HOST` — the live
 * public site, as far as this deployment is concerned. `test.runtime.example.com`
 * is in its `SITE_TEST_HOSTNAMES`. Both are read from the process environment
 * this server was started with; nothing about the gate is compiled in.
 */
describe("?mock= is inert on the hostname a visitor reaches", () => {
  const scenarioPaths = [
    "/cart?mock=filled",
    "/cart?mock=updating",
    "/cart?mock=unavailable",
    "/cart?mock=error",
    "/checkout?mock=filled",
    "/checkout?mock=placing",
  ] as const;

  it("renders the empty default on the canonical host, whatever is asked for", async () => {
    for (const path of scenarioPaths) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, `${path} did not answer 200`).toBe(200);

      const text = paintedText(response.body);
      expect(text, `${path} honoured a scenario on the live hostname`).toContain(
        "Your basket is empty",
      );
      expect(text, `${path} priced a basket on the live hostname`).not.toContain(
        resolveCatalogue().price,
      );
      expect(text, `${path} served an order button on the live hostname`).not.toContain(
        "Order with obligation to pay",
      );
    }
  });

  it("still honours it on a declared test hostname, which is what the suites and the dev story need", async () => {
    const cart = await requestWithHost(server.port, "/cart?mock=filled", MOCK_HOST);
    expect(paintedText(cart.body)).toContain(resolveCatalogue().price);

    const checkout = await requestWithHost(server.port, "/checkout?mock=filled", MOCK_HOST);
    expect(paintedText(checkout.body)).toContain("Order with obligation to pay");
  });

  it("leaves both routes working on the canonical host without the parameter", async () => {
    for (const path of ["/cart", "/checkout"]) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, `${path} did not answer 200`).toBe(200);
      expect(paintedText(response.body)).toContain("Your basket is empty");
    }
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
 * The same build, served by a second process with nothing configured beyond
 * the two host variables — the state every deployment is actually in today.
 *
 * This is the finding that made the whole arrangement worth changing. The
 * price used to come from `CATALOGUE_MOCK_*`, so an unconfigured deployment
 * published a visible €25.00 to a person and, in the JSON-LD, **no offer at
 * all** to a search engine; a *mis*configured one published a different price
 * to each, with nothing failing or warning. Both facts now come from
 * `storefront/mock/catalogue.json`, so the default state is the correct state
 * and there is no environment that can separate them.
 */
describe("an unconfigured deployment publishes the same price it renders", () => {
  let unconfigured: RunningServer;

  beforeAll(async () => {
    unconfigured = await startServer({
      SITE_BASE_URL: "https://unconfigured.example.com",
      SITE_CANONICAL_HOST: "unconfigured.example.com",
    });
  }, 120_000);

  afterAll(() => {
    unconfigured?.process.kill();
  });

  it("still serves the product page", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/games/lunar-base",
      "unconfigured.example.com",
    );
    expect(response.status).toBe(200);
    expect(response.body).toContain('"@type":"Product"');
  });

  it("publishes an Offer whose price, currency and availability are the catalogue's own", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/games/lunar-base",
      "unconfigured.example.com",
    );
    const expected = buildProductJsonLd({
      url: "https://unconfigured.example.com/games/lunar-base",
      description: "",
    });
    const offer = expected.offers as Record<string, unknown>;

    expect(response.body).toContain('"@type":"Offer"');
    expect(response.body).toContain(`"priceCurrency":"${String(offer.priceCurrency)}"`);
    expect(response.body).toContain(`"price":"${String(offer.price)}"`);
    expect(response.body).toContain(`"availability":"${String(offer.availability)}"`);
  });

  it("shows a human the same price it tells a crawler", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/games/lunar-base",
      "unconfigured.example.com",
    );
    const rendered = resolveCatalogue();
    expect(response.body).toContain(rendered.price);
    expect(response.body).toContain(rendered.availabilityLabel);
    expect(response.body).toContain(rendered.productName);
  });

  it("suppresses the copy that quotes an unconfigured merchant address, rather than rendering the brace", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/support/lunar-base",
      "unconfigured.example.com",
    );
    expect(response.status).toBe(200);
    expect(response.body).not.toContain("{merchantContactAddress}");
    expect(response.body).not.toContain("You can also reach us at");
  });

  /**
   * The opposite decision, on the pages where dropping would be the defect.
   *
   * Suppressing the sentence is right on the Support page: a visitor loses one
   * alternative contact route they could not have used anyway, and the contact
   * form under it still works. An imprint that quietly loses its registration
   * number renders as a complete, confident legal notice that is missing a
   * disclosure the law requires, and nobody can see that anything is gone. So
   * these routes name the gap where it is and say so at the top of the page.
   */
  it("names, rather than drops, every unconfigured legal disclosure on the imprint", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/legal/imprint",
      "unconfigured.example.com",
    );
    expect(response.status).toBe(200);

    // No brace reaches a visitor, in this state either.
    expect(paintedText(response.body)).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);

    for (const label of [
      "registered company name",
      "registered address",
      "company registration number",
      "VAT identification number",
      "contact email address",
      "telephone number",
    ]) {
      expect(response.body, `the imprint hides its missing ${label}`).toContain(
        `[not configured: ${label}]`,
      );
    }

    expect(response.body).toContain("legal-incomplete-notice");
    expect(response.body).toContain("This notice is incomplete.");

    /*
     * The notice enumerates the missing details, and it is asserted as a
     * **set plus the one ordering fact that matters** rather than as a joined
     * string.
     *
     * The joined string was pinned to `localeCompare`'s default collation, so
     * a container with a different `LANG` reordered two entries and reddened
     * this suite for a reason with nothing to do with the page. The property
     * worth keeping is that the list is sorted by the label a reader sees and
     * not by the token behind it — token order would open with "contact email
     * address" — and that survives any collation.
     */
    const listed = noticeLabels(response.body);
    expect(listed.length, "the notice lists nothing").toBeGreaterThan(0);
    expect(listed.toSorted()).toEqual(
      [
        "registered company name",
        "registered address",
        "company registration number",
        "VAT identification number",
        "contact email address",
        "telephone number",
      ].toSorted(),
    );
    expect(
      listed[0],
      "the notice is sorted by placeholder token, not by the label a reader sees",
    ).toBe("company registration number");

    // And the surrounding prose is still there, not dropped with the value.
    expect(response.body).toContain("Estonian Commercial Register");
    expect(response.body).toContain("the party responsible for the contract you enter at checkout");
  });

  /**
   * The **opposite** decision, one layer out, and the two classes side by side
   * on one served page.
   *
   * A missing merchant detail is a missing disclosure: nothing else on the page
   * conveys it, so it is named where it belongs and enumerated in the notice.
   * A missing destination is not: `content/legal/terms.ts` names the Consumer
   * Disputes Committee in prose, which the operator and the qualified reviewer
   * confirmed on 2026-08-10 satisfies Article 6(1)(t) CRD by itself, so the
   * address is an enhancement. The previous revision had it in the required-gap
   * set, which let an optional link make a legally complete page announce
   * itself as incomplete.
   */
  it("drops the unconfigured dispute-resolution link quietly, while the identity set stays loud", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/legal/terms",
      "unconfigured.example.com",
    );
    expect(response.status).toBe(200);

    const text = paintedText(response.body);

    // The disclosure is the sentence, and it is untouched.
    expect(text).toContain("The procedure is free of charge.");
    expect(text).toContain(
      "you may refer the dispute to the Consumer Disputes Committee at the Estonian Consumer " +
        "Protection and Technical Regulatory Authority.",
    );

    // The enhancement is gone, and nothing on the page mentions it.
    expect(text, "an optional link is still being rendered as a disclosure gap").not.toContain(
      "web address of the dispute resolution body",
    );
    expect(noticeLabels(response.body)).not.toContain(
      "web address of the dispute resolution body",
    );

    // The identity set on the same page, in the same state, is still loud.
    expect(response.body).toContain("legal-incomplete-notice");
    expect(text).toContain("[not configured: contact email address]");
    expect(noticeLabels(response.body)).toContain("registered company name");

    // Never invented, never a dead link, never a brace.
    expect(response.body).not.toContain('href="#"');
    expect(text).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
  });

  it("keeps every paragraph of every legal page, configured or not", async () => {
    for (const path of [
      "/legal/imprint",
      "/legal/terms",
      "/legal/shipping",
      "/legal/returns",
      "/legal/privacy",
    ]) {
      const configuredResponse = await requestWithHost(server.port, path, "runtime.example.com");
      const unconfiguredResponse = await requestWithHost(
        unconfigured.port,
        path,
        "unconfigured.example.com",
      );

      const paragraphs = (html: string): number => (html.match(/<p\b/g) ?? []).length;

      expect(unconfiguredResponse.status, `${path} did not answer 200 unconfigured`).toBe(200);
      expect(paintedText(unconfiguredResponse.body)).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
      // The unconfigured page has the notice's own paragraphs on top, so it can
      // never have *fewer* than the configured one. Fewer means dropped copy.
      expect(
        paragraphs(unconfiguredResponse.body),
        `${path} rendered fewer paragraphs with nothing configured — copy was dropped`,
      ).toBeGreaterThanOrEqual(paragraphs(configuredResponse.body));
    }
  });

  it("names, rather than drops, the unconfigured GPSR manufacturer identity", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/games/lunar-base",
      "unconfigured.example.com",
    );
    expect(response.status).toBe(200);
    expect(paintedText(response.body)).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
    expect(response.body).toContain("[not configured: registered address]");
    expect(response.body).toContain("product-safety-incomplete-notice");
    // The safety information itself needs no configuration and must be intact.
    expect(response.body).toContain("SHAH01338706");
    expect(response.body).toContain("Flammability");
  });
});
