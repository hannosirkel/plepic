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

import { newsletter as newsletterCopy } from "../../content/publisher.js";
import { checkout as checkoutCopy, unavailableFigure } from "../../content/shop.js";
import { contact as contactCopy, contactForm as contactFormCopy } from "../../content/support.js";
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
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { buildSitemapEntries } from "../src/lib/sitemap-contract.js";
import {
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
} from "../../content/routes.js";
import { alternateLinksFor, pagesIn } from "../src/lib/seo.js";
import { localizedPath } from "../src/lib/urls.js";
import { NOT_FOUND_TITLE } from "../src/app/not-found-content.js";

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
 * The served markup of the first element carrying a CSS-module class built
 * from `token`. A production `next build` names them
 * `<stylesheet>_<class>__<hash>`, e.g. `lunar-base_heroPurchase__xzBhj`, so
 * the distinctive part is the authored name between an underscore and a
 * doubled one. (The vitest/Vite transform spells the same class
 * `_heroPurchase_f620b6`; nothing here should be reused against that.)
 *
 * Depth-aware over the element's own tag name, because the blocks this is
 * asked for nest same-tag children and a "first closing tag" cut would
 * silently return a prefix — a test that passes because it looked at less
 * than it meant to. Throws rather than returning `""` if the class is not
 * there at all, so a renamed class fails loudly instead of making every
 * assertion about the block vacuously true.
 */
function servedBlock(html: string, token: string): string {
  const opening = new RegExp(`<(\\w+)\\b[^>]*class="[^"]*_${token}__[^"]*"[^>]*>`).exec(html);
  if (opening === null) throw new Error(`no element carrying the class "${token}" in the served markup`);

  const tag = opening[1] ?? "";
  const from = opening.index + opening[0].length;
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  tags.lastIndex = from;

  let depth = 1;
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(from, match.index);
  }
  throw new Error(`unterminated <${tag}> for the class "${token}"`);
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
interface HostRequestOptions {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Buffer;
}

function requestWithHost(
  port: number,
  path: string,
  host: string,
  options: HostRequestOptions = {},
): Promise<HostRequestResult> {
  return new Promise((resolve, reject) => {
    const body = options.body;
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: {
          Host: host,
          ...options.headers,
          ...(body === undefined ? {} : { "Content-Length": String(body.byteLength) }),
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
    request.end(body);
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
  MEDUSA_BACKEND_URL: "http://127.0.0.1:1",
  MEDUSA_PUBLISHABLE_API_KEY: "pk_runtime_value",
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
  // `/` intentionally fails closed without Store configuration. Readiness is
  // a site-process check, so use a non-commerce route that every deployment
  // can serve even when a focused test starts an unconfigured Store seam.
  await waitForServer(`http://127.0.0.1:${port}/about`, 60_000);
  return { process: process_, port };
}

let server: RunningServer;
let unconfiguredServer: RunningServer;
let buildArtifactText: string;
let backendServer: http.Server;

interface BackendRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: http.IncomingHttpHeaders;
  readonly bodyBase64: string;
}

const backendRequests: BackendRequest[] = [];

async function startBackendServer(): Promise<string> {
  backendServer = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const bodyBase64 = Buffer.concat(chunks).toString("base64");
      backendRequests.push({
        method: request.method ?? "",
        path: request.url ?? "",
        headers: request.headers,
        bodyBase64,
      });
      // The request-time page loader asks for one product with the fields it
      // needs. Other Store requests must remain transparent transport tests.
      if ((request.url ?? "").startsWith("/store/products?limit=1&fields=")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            products: [
              {
                id: "prod_lunar_base",
                title: mockCatalogue.name,
                variants: [
                  {
                    id: "variant_lunar_base",
                    manage_inventory: true,
                    allow_backorder: false,
                    inventory_quantity: 12,
                    calculated_price: {
                      currency_code: mockCatalogue.price.currency.toLowerCase(),
                      calculated_amount: mockCatalogue.price.amount,
                    },
                  },
                ],
              },
            ],
          }),
        );
        return;
      }
      response.writeHead(202, {
        "content-type": "application/json",
        "x-medusa-test-response": "preserved",
      });
      response.end(JSON.stringify({ method: request.method, path: request.url, bodyBase64 }));
    });
  });

  const port = await findFreePort();
  await new Promise<void>((resolve, reject) => {
    backendServer.once("error", reject);
    backendServer.listen(port, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${port}`;
}

beforeAll(async () => {
  rmSync(nextDistDir, { recursive: true, force: true });
  RUNTIME_ENV.MEDUSA_BACKEND_URL = await startBackendServer();

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
  unconfiguredServer = await startServer({
    ...RUNTIME_ENV,
    MEDUSA_BACKEND_URL: "",
    MEDUSA_PUBLISHABLE_API_KEY: "",
  });
}, 300_000);

afterAll(() => {
  server?.process.kill();
  unconfiguredServer?.process.kill();
  backendServer?.close();
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
  it("publishes the Medusa key at request time without publishing the backend target", async () => {
    const response = await requestWithHost(server.port, "/", "runtime.example.com");
    expect(response.status).toBe(200);
    expect(response.body).toContain(RUNTIME_ENV.MEDUSA_PUBLISHABLE_API_KEY);
    expect(response.body).not.toContain(RUNTIME_ENV.MEDUSA_BACKEND_URL);
    expect(response.body).not.toContain(BUILD_TIME_ENV.MEDUSA_PUBLISHABLE_API_KEY);
    expect(response.body).not.toContain(BUILD_TIME_ENV.MEDUSA_BACKEND_URL);
  });

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

describe("the built storefront's strict /store-api transport", () => {
  it("denies an unmatched path before consulting missing backend configuration", async () => {
    backendRequests.length = 0;
    const denied = await requestWithHost(
      unconfiguredServer.port,
      "/store-api/admin/users",
      "runtime.example.com",
    );
    const allowed = await requestWithHost(
      unconfiguredServer.port,
      "/store-api/store/products",
      "runtime.example.com",
    );

    expect(denied.status).toBe(404);
    expect(allowed.status).toBe(503);
    expect(backendRequests).toHaveLength(0);
  });

  it("strips /store-api and preserves a Store request's method, query and required headers", async () => {
    backendRequests.length = 0;

    const response = await requestWithHost(
      server.port,
      "/store-api/store/products?limit=7&region_id=reg_example",
      "runtime.example.com",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer session-example",
          Cookie: "cart_id=cart_example",
          "X-Publishable-Api-Key": "pk_request_runtime",
        },
      },
    );

    expect(response.status).toBe(202);
    expect(response.headers["x-medusa-test-response"]).toBe("preserved");
    expect(backendRequests).toHaveLength(1);
    expect(backendRequests[0]).toMatchObject({
      method: "GET",
      path: "/store/products?limit=7&region_id=reg_example",
      bodyBase64: "",
    });
    expect(backendRequests[0]?.headers.authorization).toBe("Bearer session-example");
    expect(backendRequests[0]?.headers.cookie).toBe("cart_id=cart_example");
    expect(backendRequests[0]?.headers["x-publishable-api-key"]).toBe("pk_request_runtime");
  });

  it("loads home and canonical product facts from the server Store seam with its publishable key", async () => {
    backendRequests.length = 0;

    for (const host of ["runtime.example.com", "test.runtime.example.com"]) {
      for (const path of ["/", "/games/lunar-base"]) {
        const response = await requestWithHost(server.port, path, host);
        expect(response.status, `${host}${path} did not render from the Store catalogue`).toBe(200);
      }
    }

    const productRequests = backendRequests.filter((request) => request.path.startsWith("/store/products?limit=1&fields="));
    expect(productRequests).toHaveLength(4);
    for (const request of productRequests) {
      expect(request.headers["x-publishable-api-key"]).toBe(RUNTIME_ENV.MEDUSA_PUBLISHABLE_API_KEY);
    }
  });

  it("forwards a Stripe hook body byte-for-byte with its signature and content type", async () => {
    backendRequests.length = 0;
    const body = Buffer.from([0x7b, 0x22, 0x72, 0x61, 0x77, 0x22, 0x3a, 0xff, 0x00, 0x7d]);

    const response = await requestWithHost(
      server.port,
      "/store-api/hooks/payment/stripe_stripe",
      "runtime.example.com",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Stripe-Signature": "t=123,v1=signature-example",
        },
        body,
      },
    );

    expect(response.status).toBe(202);
    expect(backendRequests).toHaveLength(1);
    expect(backendRequests[0]).toMatchObject({
      method: "POST",
      path: "/hooks/payment/stripe_stripe",
      bodyBase64: body.toString("base64"),
    });
    expect(backendRequests[0]?.headers["content-type"]).toBe("application/octet-stream");
    expect(backendRequests[0]?.headers["stripe-signature"]).toBe("t=123,v1=signature-example");
  });

  it("allows product media only through the named static prefix", async () => {
    backendRequests.length = 0;
    const response = await requestWithHost(
      server.port,
      "/store-api/static/products/lunar-base.webp?v=1",
      "runtime.example.com",
    );

    expect(response.status).toBe(202);
    expect(backendRequests).toHaveLength(1);
    expect(backendRequests[0]?.path).toBe("/static/products/lunar-base.webp?v=1");
  });

  it("404s every unmatched or normalized traversal path without a backend request", async () => {
    const denied = [
      "/store-api/admin/users",
      "/store-api/app",
      "/store-api/%2e%2e/app",
      "/store-api/store/../admin/users",
    ];

    for (const path of denied) {
      backendRequests.length = 0;
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, path).toBe(404);
      expect(backendRequests, `${path} reached the backend`).toHaveLength(0);
    }
  });

  it("lets Next normalize a repeated slash once, then locally 404s the destination without backend traffic", async () => {
    backendRequests.length = 0;

    const raw = await requestWithHost(
      server.port,
      "/store-api//admin/users",
      "runtime.example.com",
    );
    expect(raw.status).toBe(308);
    expect(raw.headers.location).toBe("/store-api/admin/users");
    expect(backendRequests, "the raw repeated-slash request reached the backend").toHaveLength(0);

    const normalized = await requestWithHost(
      server.port,
      raw.headers.location ?? "",
      "runtime.example.com",
    );
    expect(normalized.status).toBe(404);
    expect(backendRequests, "the normalized denial reached the backend").toHaveLength(0);
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

  /*
   * Every edition's legal paths, not the default one's. The gap marker is
   * per-edition ("[not configured: ...]" / "[seadistamata: ...]"), so the
   * sweep names both -- a marker needle in only one language is a sweep the
   * other edition's markers walk straight past.
   */
  it("leaves no brace, no marker and no incompleteness notice on any edition's legal pages", async () => {
    const paths = LOCALES.flatMap((locale) =>
      pagesIn(locale)
        .filter((page) => page.route.startsWith("legal"))
        .map((page) => localizedPath(locale, ROUTE_PATHS[page.route])),
    );
    expect(paths.length).toBeGreaterThanOrEqual(LEGAL_PATHS.length * 2);

    for (const path of paths) {
      const response = await requestWithHost(server.port, path, "runtime.example.com");
      expect(response.status, `${path} did not answer 200`).toBe(200);
      expect(paintedText(response.body), `${path} rendered an unresolved placeholder`).not.toMatch(
        /\{[A-Za-z][A-Za-z0-9]*\}/,
      );
      for (const marker of ["[not configured", "[seadistamata"]) {
        expect(response.body, `${path} rendered an unconfigured marker`).not.toContain(marker);
      }
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
    /*
     * Unified to the operator's wording on 2026-08-10, and unify was not
     * delete: the callout states the qualification once, and the body still
     * says how the tax sits in the figure and that the figure is unchanged
     * where none is due. `tests/legal-pages.test.tsx` carries that property in
     * full; this is its served-page half.
     */
    const collapsed = text.replaceAll(/\s+/g, " ");
    expect(collapsed).toContain("contained within that figure rather than added to it");
    expect(collapsed).toMatch(/does not change[^.]*including where no VAT is due at all/);
    expect(collapsed, "the body restates the callout's conditional one line below it").not.toMatch(
      /[Ww]here VAT is due/,
    );
  });

  /**
   * The same wording, one page up, and this is why the finding named the
   * product page as well: a legal page saying *"where applicable"* over a
   * purchase panel saying *"VAT included"* flatly moves the contradiction to
   * the more prominent of the two.
   *
   * **And the same *format*.** The operator supplied two lines with the first
   * emphasised; the product surfaces put the tax qualification in the small
   * print beside the shipping note. So the assertion is on the emphasised line
   * as a whole — `resolveCatalogue().priceHeadline`, the identical string
   * `/legal/shipping`'s callout `lead` resolves to — and on the *absence* of
   * the concatenated qualifier string that used to carry it. Whitespace is
   * collapsed because `paintedText` turns every tag into a space and the
   * figure is a `<span>` inside the emphasised paragraph.
   */
  it("presents the price identically on the product page, in the operator's two lines", async () => {
    const response = await requestWithHost(
      server.port,
      "/games/lunar-base",
      "runtime.example.com",
    );
    expect(response.status).toBe(200);

    const catalogue = resolveCatalogue();
    const text = paintedText(response.body).replaceAll(/\s+/g, " ");
    expect(text).toContain(catalogue.priceHeadline);
    expect(text).toContain(catalogue.priceShippingNote);
    expect(text, "the product page asserts VAT is included, unqualified").not.toMatch(
      /VAT included(?! where applicable)/,
    );

    /*
     * Scoped to the two commercial blocks, and it has to be: the same page
     * carries the shipping FAQ, whose answer quotes `{priceLine}` — the price
     * and the qualifiers as one sentence — and that is the right shape for
     * prose quoting a price mid-paragraph. The defect is the concatenated form
     * appearing where a headline price is presented.
     */
    for (const block of ["heroPurchase", "panel"] as const) {
      const served = paintedText(servedBlock(response.body, block)).replaceAll(/\s+/g, " ");
      expect(served, `${block} lost the operator's emphasised line`).toContain(
        catalogue.priceHeadline,
      );
      expect(
        served,
        `${block} has the tax qualification back in the small print beside the shipping note`,
      ).not.toContain(catalogue.priceQualifiers);
    }
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
 * The same defect, on the two **public** forms, and the same requirement: no
 * field value from either form reaches a URL in any state of the page,
 * including unhydrated.
 *
 * The checkout answers it with a route and a `303`. These two answer it with a
 * Server Function as the form's `action`, because the route shape needs files
 * outside the unit that fixed them — see
 * `src/components/forms/public-form-actions.ts`. What that produces is a real
 * `method="POST"` form pointing at the page's own URL, with React's own
 * `$ACTION_*` hidden fields, and a POST response that is the re-rendered page
 * carrying the answer in its HTML.
 *
 * **Only a real build can show that.** `react-dom/server` on its own has no
 * server reference to resolve and renders a `javascript:` neutraliser instead
 * (see `tests/forms.test.tsx`), so this is the only place in the repository
 * where the fix is actually exercised: a built server, the served form parsed
 * as a browser would parse it, and every hidden field sent back exactly as a
 * browser would send it.
 */
describe("neither public form can put a field value in a URL", () => {
  const LIVE_HOST = RUNTIME_ENV.SITE_CANONICAL_HOST;

  const PUBLIC_FORMS = [
    {
      route: "/",
      label: newsletterCopy.heading,
      answer: newsletterCopy.notSentMessage,
      copy: newsletterCopy,
      /**
       * The sentence this route must never paint, because painting it would
       * be a lie about a form that sends nothing.
       *
       * **`null` because the newsletter copy has no success sentence at
       * all**, deliberately: nothing in this build can succeed, so
       * `content/publisher.ts`'s `newsletter` object never had one to
       * fabricate. The test below pins that absence instead. It used to
       * assert that the *contact* form's success line was missing from the
       * homepage — which a page that never had that string passes for free,
       * and which said nothing about the newsletter at all. Give the
       * newsletter a success sentence and this fixture has to gain the string
       * to look for, or the suite reddens.
       */
      fabricatedAnswer: null,
      typed: { email: "unhydrated-subscriber@example.com" },
    },
    {
      route: "/support/lunar-base",
      label: contactCopy.heading,
      answer: contactFormCopy.notSentMessage,
      copy: contactFormCopy,
      fabricatedAnswer: contactFormCopy.successMessage,
      typed: {
        name: "Unhydrated Person",
        email: "unhydrated-writer@example.com",
        subject: "A subject line",
        message: "A message body that must never appear in a URL.",
      },
    },
  ] as const;

  /** The one `<form …>…</form>` carrying this accessible name. */
  function formMarkup(html: string, label: string): string {
    const marker = html.indexOf(`aria-label="${label}"`);
    if (marker === -1) return "";
    return html.slice(html.lastIndexOf("<form", marker), html.indexOf("</form>", marker));
  }

  /**
   * The submission count the served answer carries, or `null` if this
   * response painted no answer at all. See the form components' `alertAnchor`
   * block for why the count is on the element as well as in the React key.
   */
  function outcomeSubmission(html: string, label: string): string | null {
    return /data-submission="([^"]*)"/.exec(formMarkup(html, label))?.[1] ?? null;
  }

  /**
   * The hidden control React's progressive enhancement uses to carry the
   * previous action state back to the server on the next press.
   *
   * Named rather than sniffed out by shape on purpose. If React ever renames
   * it, the assertions below must fail loudly instead of quietly checking a
   * control that is no longer there — which is the failure mode that would
   * turn this whole guarantee back into something nobody is watching.
   */
  const PREVIOUS_STATE_FIELD = "$ACTION_1:1";

  /** The raw serialised previous state this page would resubmit, if any. */
  function serialisedPreviousState(html: string, label: string): string | undefined {
    return hiddenFields(formMarkup(html, label)).find(
      ([name]) => name === PREVIOUS_STATE_FIELD,
    )?.[1];
  }

  /** Every hidden control a browser would resubmit, in document order. */
  function hiddenFields(form: string): readonly (readonly [string, string])[] {
    return [...form.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)].flatMap((match) => {
      const tag = match[0];
      const name = /name="([^"]*)"/.exec(tag)?.[1];
      if (name === undefined) return [];
      const raw = /value="([^"]*)"/.exec(tag)?.[1] ?? "";
      const value = raw
        .replaceAll("&quot;", '"')
        .replaceAll("&#x27;", "'")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&");
      return [[name, value] as const];
    });
  }

  /**
   * A multipart/form-data POST, which is what React's own progressive
   * enhancement makes the browser send: the form it renders carries
   * `enctype="multipart/form-data"`, and a urlencoded body does not reach the
   * Server Function at all (verified — it answers 200 without running it).
   */
  function postMultipartWithHost(
    port: number,
    path: string,
    host: string,
    fields: readonly (readonly [string, string])[],
  ): Promise<HostRequestResult> {
    const boundary = `----plepicTestBoundary${randomDigits(16)}`;
    const body = Buffer.from(
      `${fields
        .map(
          ([name, value]) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        )
        .join("")}--${boundary}--\r\n`,
      "utf8",
    );

    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method: "POST",
          headers: {
            Host: host,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.byteLength,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        },
      );
      request.on("error", reject);
      request.write(body);
      request.end();
    });
  }

  for (const form of PUBLIC_FORMS) {
    describe(form.route, () => {
      it("serves a form that posts, before anything hydrates", async () => {
        const response = await requestWithHost(server.port, form.route, LIVE_HOST);
        expect(response.status).toBe(200);

        const markup = formMarkup(response.body, form.label);
        expect(markup, `no form labelled "${form.label}" was served`).not.toBe("");

        const tag = /<form\b[^>]*>/.exec(markup)?.[0] ?? "";
        expect(tag, "a form with no method is a GET, and a GET puts every value in the URL").toMatch(
          /method="post"/i,
        );
        // React's client-action neutraliser. Its presence would mean the
        // Server Function did not resolve and an unhydrated press does nothing.
        expect(tag).not.toContain("javascript:");
        // It posts to the page's own URL, and that URL carries no query.
        const action = /\saction="([^"]*)"/.exec(tag)?.[1] ?? "";
        expect([form.route, ""]).toContain(action);
        expect(action).not.toContain("?");
      });

      it("answers an unhydrated submission without putting one value in the URL", async () => {
        const served = await requestWithHost(server.port, form.route, LIVE_HOST);
        const markup = formMarkup(served.body, form.label);
        const fields = [...hiddenFields(markup), ...Object.entries(form.typed)];

        // A browser sends every hidden control the form declares. If React
        // stopped emitting them this submission would stop reaching the
        // Server Function, and the answer assertion below would fail.
        expect(fields.some(([name]) => name.startsWith("$ACTION"))).toBe(true);

        const response = await postMultipartWithHost(
          server.port,
          form.route,
          LIVE_HOST,
          fields,
        );

        expect(response.status).toBe(200);
        // No redirect at all, so nothing can carry a value in a Location.
        expect(response.headers.location).toBeUndefined();

        for (const [field, value] of Object.entries(form.typed)) {
          expect(response.body, `"${field}" came back in the response`).not.toContain(value);
          expect(response.body).not.toContain(encodeURIComponent(value));
        }
      });

      it("says plainly that nothing was sent, in the first paint, with no script involved", async () => {
        const served = await requestWithHost(server.port, form.route, LIVE_HOST);
        const fields = [
          ...hiddenFields(formMarkup(served.body, form.label)),
          ...Object.entries(form.typed),
        ];
        const response = await postMultipartWithHost(server.port, form.route, LIVE_HOST, fields);

        // Read with every <script> stripped: this sentence is in the HTML the
        // server sent, not something hydration produced.
        expect(paintedText(response.body).replaceAll(/\s+/g, " ")).toContain(
          form.answer.replaceAll(/\s+/g, " "),
        );
      });

      it("does not fabricate a success message anywhere on the route", async () => {
        const response = await requestWithHost(server.port, form.route, LIVE_HOST);

        if (form.fabricatedAnswer === null) {
          // See the fixture: this form has no success copy to fabricate, and
          // the check with teeth is that it still has none.
          expect(
            Object.keys(form.copy),
            "this form now has success copy; give the fixture the string to look for",
          ).not.toContain("successMessage");
          return;
        }

        expect(paintedText(response.body)).not.toContain(form.fabricatedAnswer);
      });

      /**
       * MIN-4 of review pass 1, end to end: a second consecutive submission
       * must be its own answer and not a repaint of the first.
       *
       * React's progressive enhancement binds the previous state into the
       * form it serves back (`$ACTION_1:1`), so resubmitting the form from a
       * POST response — exactly what a browser does on a second press — is
       * the same sequence a hydrated visitor produces. Before the fix the
       * action returned the bare sentence, there was no counter and no
       * `data-submission` attribute, and the hydrated case produced zero
       * mutations in the live region on the second press.
       *
       * The attribute is the observable; the React `key` built from the same
       * number is the mechanism that remounts the paragraph, and a key is
       * invisible in markup. This file cannot hydrate, so it proves the
       * counter reaches the render and increments; the live-region mutation
       * count itself was measured in a browser and is recorded in the unit's
       * report.
       */
      it("answers a second consecutive submission as its own event", async () => {
        const typed = Object.entries(form.typed);
        const served = await requestWithHost(server.port, form.route, LIVE_HOST);

        const first = await postMultipartWithHost(server.port, form.route, LIVE_HOST, [
          ...hiddenFields(formMarkup(served.body, form.label)),
          ...typed,
        ]);
        expect(first.status).toBe(200);
        expect(outcomeSubmission(first.body, form.label)).toBe("1");

        // The identical press again, on the page the first press produced.
        const second = await postMultipartWithHost(server.port, form.route, LIVE_HOST, [
          ...hiddenFields(formMarkup(first.body, form.label)),
          ...typed,
        ]);
        expect(second.status).toBe(200);
        expect(
          outcomeSubmission(second.body, form.label),
          "the second submission is indistinguishable from the first",
        ).toBe("2");

        // And it is the same fixed sentence from content/, both times.
        for (const body of [first.body, second.body]) {
          expect(paintedText(body).replaceAll(/\s+/g, " ")).toContain(
            form.answer.replaceAll(/\s+/g, " "),
          );
        }
      });

      /**
       * MIN-11 of review pass 2 — **the unit's central guarantee, and until
       * now the one nothing in this repository checked.**
       *
       * The forms answer in place rather than redirecting, so the whole case
       * that no field value escapes rests on what React serialises back into
       * the form: `$ACTION_1:1` is the previous outcome, in plaintext, in the
       * markup, and a browser reposts it on the next press. If a field value
       * ever reached the returned outcome it would travel out in that control
       * and straight back in — and every other assertion in this file would
       * still pass, because the response *body* check above only ever looked
       * at the first press, where `previous` is `[null]` and therefore the
       * least informative moment there is.
       *
       * So: three consecutive presses, retyping every field each time, with
       * the state read off the form the previous press served. `toEqual`
       * fails on an unexpected key, so the shape assertion is "these two
       * fields and nothing else"; the message must be the fixed `content/`
       * sentence and the count must be that press's integer.
       *
       * Mutation-proved by making the action put a submitted field into the
       * message it returns: this test reddens on both forms, on every press,
       * while the response-body test above stays green on press 1.
       */
      it("serialises back the fixed sentence and an integer, and nothing else, on every press", async () => {
        const typed = Object.entries(form.typed);
        const served = await requestWithHost(server.port, form.route, LIVE_HOST);

        // Before any press at all. If this control is absent the loop below
        // would be asserting `undefined` is fine forever.
        expect(
          serialisedPreviousState(served.body, form.label),
          `the served form declares no ${PREVIOUS_STATE_FIELD} — React renamed it, and this test is no longer looking at the previous state`,
        ).toBe("[null]");

        let page = served.body;
        for (const press of [1, 2, 3]) {
          const response = await postMultipartWithHost(server.port, form.route, LIVE_HOST, [
            ...hiddenFields(formMarkup(page, form.label)),
            ...typed,
          ]);
          expect(response.status).toBe(200);
          expect(outcomeSubmission(response.body, form.label)).toBe(String(press));

          const state = serialisedPreviousState(response.body, form.label);
          expect(state, `press ${String(press)} served back no ${PREVIOUS_STATE_FIELD}`).toBeDefined();

          expect(
            JSON.parse(state ?? "null"),
            `press ${String(press)} serialised something other than the fixed sentence and a count`,
          ).toEqual([{ message: form.answer, submissions: press }]);

          // Said the other way round, against the raw string: not one thing
          // the visitor typed is in there, in any of the encodings this
          // control can carry it in.
          for (const [field, value] of Object.entries(form.typed)) {
            expect(
              state,
              `"${field}" is in the state press ${String(press)} serialises back`,
            ).not.toContain(value);
            expect(state).not.toContain(encodeURIComponent(value));
            expect(state).not.toContain(JSON.stringify(value).slice(1, -1));
          }

          page = response.body;
        }
      });
    });
  }
});

/**
 * Cloudflare's documented widget sizes: `normal` 300x65, `flexible` 100% with
 * a **300px minimum**, `compact` 150x140 for space-constrained layouts. The
 * `.turnstile` box measures 174px on the newsletter and 222px on the checkout
 * at a 320px viewport, so anything but `compact` is wider than its container —
 * and it was clipped rather than visibly overflowing, which is how three
 * page-level sweeps read clean over it.
 */
describe("every Turnstile widget is served at a size that fits its container", () => {
  const routes = ["/", "/support/lunar-base", "/checkout?mock=filled"] as const;

  for (const route of routes) {
    it(`${route} renders the compact widget`, async () => {
      const response = await requestWithHost(server.port, route, MOCK_HOST);
      expect(response.status).toBe(200);

      const widgets = [...response.body.matchAll(/<div\b[^>]*class="cf-turnstile"[^>]*>/g)].map(
        (match) => match[0],
      );
      expect(widgets.length, `no Turnstile widget on ${route}`).toBeGreaterThan(0);
      for (const widget of widgets) {
        expect(widget).toContain('data-size="compact"');
      }
    });
  }
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
 * all** to a search engine. The Store-backed page must instead fail closed:
 * there is no honest sale page without a runtime Store credential.
 */
describe("an unconfigured deployment fails closed for commerce pages", () => {
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

  it("does not serve a product page from the committed catalogue fixture", async () => {
    const response = await requestWithHost(
      unconfigured.port,
      "/games/lunar-base",
      "unconfigured.example.com",
    );
    expect(response.status).toBe(500);
    expect(response.body).not.toContain(resolveCatalogue().price);
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

});

/**
 * The locale dimension, as a browser is actually served it.
 *
 * Everything else about it is proved against pure functions and a source
 * scan. This is the part that only a running server can answer: whether the
 * document that reaches a reader declares its language, whether the
 * `hreflang` annotations survive Next's metadata emitter, and whether the URL
 * shapes a locale dimension must *not* create are genuinely absent rather
 * than merely unimplemented.
 */
describe("the served document declares its language and its alternates", () => {
  const HOST = "runtime.example.com";

  /*
   * Every edition, not the default one: an Estonian legal page served with
   * `lang="en"` tells a screen reader to pronounce Estonian statutory terms
   * as English, on exactly the pages a reader consults about their rights.
   */
  it("declares each edition's own language tag on every page it publishes", async () => {
    for (const locale of LOCALES) {
      const expected = LOCALE_DEFINITIONS[locale].languageTag;

      for (const page of pagesIn(locale)) {
        const path = localizedPath(locale, ROUTE_PATHS[page.route]);
        const response = await requestWithHost(server.port, path, HOST);
        expect(response.status, path).toBe(200);

        const match = /<html[^>]*\slang="([^"]*)"/.exec(response.body);
        expect(match?.[1], `${path} does not declare its language`).toBe(expected);
      }
    }
  });

  it("emits the whole hreflang set, self-reference and x-default included", async () => {
    const entries = buildSitemapEntries(RUNTIME_ENV.SITE_BASE_URL);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const response = await requestWithHost(server.port, entry.path, HOST);
      expect(response.status, entry.path).toBe(200);

      const served = new Map(
        [...response.body.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"\/>/g)].map(
          (match) => [match[1] ?? "", match[2] ?? ""],
        ),
      );

      const expected = alternateLinksFor(RUNTIME_ENV.SITE_BASE_URL, entry.routeId);
      expect(
        Object.fromEntries(served),
        `${entry.path} serves the wrong hreflang set`,
      ).toEqual(expected);
      expect(served.size, `${entry.path} serves no alternates at all`).toBeGreaterThan(0);
    }
  });

  it("lists the same alternates in the sitemap as in the documents", async () => {
    const response = await requestWithHost(server.port, "/sitemap.xml", HOST);
    expect(response.status).toBe(200);

    for (const entry of buildSitemapEntries(RUNTIME_ENV.SITE_BASE_URL)) {
      for (const [tag, href] of Object.entries(entry.alternates)) {
        expect(
          response.body,
          `${entry.url} has no ${tag} alternate in the sitemap`,
        ).toContain(`hreflang="${tag}" href="${href}"`);
      }
    }
  });

  /**
   * A 404 must never carry a canonical or an alternate.
   *
   * `notFound()` does **not** discard this application's metadata — an earlier
   * revision of this suite deleted this guard believing it did. A canary
   * canonical placed in the `resolved === null` branch of
   * `app/[locale]/[[...segments]]/page.tsx` reaches the **hydrated DOM**:
   * `document.querySelector('link[rel=canonical]')` resolves to it. A
   * rendering crawler is then told a canonical exists for a URL that answers
   * 404.
   *
   * **Where it is asserted, and why that is honest.** The hydrated DOM is
   * built from the flight payload, and the flight payload is in the response
   * body — so that is what this reads, after unescaping, rather than the
   * rendered HTML. The previous version searched the raw body for
   * `rel="canonical"`, which never appears on a 404 in that form and so could
   * not fail. This is not a DOM assertion and does not claim to be; it is an
   * assertion on the one input the DOM value can come from, in a suite that
   * has no browser and may not gain one.
   *
   * **The needle is proved present, not assumed.** A real page must match the
   * same patterns this asserts a 404 does not. If the patterns were wrong, the
   * positive half fails and the negative half cannot quietly pass on a typo.
   */
  it("gives a 404 no canonical and no alternates, in the payload hydration reads", async () => {
    const unescaped = (body: string) => body.replace(/\\/g, "");
    const CANONICAL = [/rel="canonical"/, /"rel":"canonical"/];
    const ALTERNATE = [/rel="alternate"/, /"rel":"alternate"/, /hrefLang/];

    const page = unescaped((await requestWithHost(server.port, "/legal/imprint", HOST)).body);
    expect(
      CANONICAL.some((pattern) => pattern.test(page)),
      "no pattern matches a page that does carry a canonical — the needle is wrong",
    ).toBe(true);
    expect(
      ALTERNATE.some((pattern) => pattern.test(page)),
      "no pattern matches a page that does carry alternates — the needle is wrong",
    ).toBe(true);

    for (const path of ["/nonsense", "/en/legal/imprint", "/zz/anything"]) {
      const response = await requestWithHost(server.port, path, HOST);
      expect(response.status, path).toBe(404);

      const body = unescaped(response.body);
      for (const pattern of CANONICAL) {
        expect(pattern.test(body), `${path} carries a canonical (${String(pattern)})`).toBe(false);
      }
      for (const pattern of ALTERNATE) {
        expect(pattern.test(body), `${path} carries an alternate (${String(pattern)})`).toBe(false);
      }
    }
  });

  /**
   * A 404 still says what it is: one `noindex` and a title, so the browser tab
   * does not show the raw URL. Both survive without JavaScript — the `<title>`
   * is server-rendered even though the body is not.
   */
  it("gives a 404 a server-rendered title and exactly one robots directive", async () => {
    for (const path of ["/nonsense", "/en/legal/imprint"]) {
      const response = await requestWithHost(server.port, path, HOST);
      expect(response.status, path).toBe(404);
      expect(response.body, `${path} has no server-rendered title`).toContain(
        `<title>${NOT_FOUND_TITLE}</title>`,
      );
      expect(
        response.body.match(/<meta name="robots"/g)?.length ?? 0,
        `${path} does not carry exactly one robots directive`,
      ).toBe(1);
      expect(response.body).toContain("noindex");
    }
  });

  /**
   * The default edition's identifier is not a URL prefix of this site. If it
   * were, every page would have two URLs and one canonical — the duplicate a
   * locale dimension exists to prevent.
   *
   * This one is live: making `localeForPathSegment` return a locale whose
   * prefix is empty turns `/en/legal/imprint` into a 200 and this red.
   */
  it("404s the default edition's own identifier as a prefix", async () => {
    for (const path of ["/en", "/en/legal/imprint", "/en/about"]) {
      const response = await requestWithHost(server.port, path, HOST);
      expect(response.status, path).toBe(404);
    }
  });

  /*
   * `/en/` is not a fourth case. Next normalises a trailing slash with a 308
   * before routing, so the assertion above would have been satisfied by a
   * redirect rather than by the route table — which is exactly the kind of
   * pass that means nothing. The normalisation is checked as itself, and its
   * destination is checked to 404 like the rest.
   */
  it("normalises a trailing slash before routing, and the destination still 404s", async () => {
    const response = await requestWithHost(server.port, "/en/", HOST);
    expect(response.status).toBe(308);
    expect(response.headers.location).toBe("/en");

    const followed = await requestWithHost(server.port, "/en", HOST);
    expect(followed.status).toBe(404);
  });

  it("404s a prefix no locale claims, at every depth", async () => {
    const claimed = new Set(
      LOCALES.map((locale) => LOCALE_DEFINITIONS[locale].pathPrefix).filter((p) => p !== ""),
    );
    expect(claimed.has("/zz")).toBe(false);

    for (const path of ["/zz", "/zz/legal/imprint", "/zz/legal", "/nonsense/deep/path"]) {
      const response = await requestWithHost(server.port, path, HOST);
      expect(response.status, path).toBe(404);
    }
  });
});
