#!/usr/bin/env node
/**
 * Crawls a running storefront into a static, sub-path-safe snapshot.
 *
 * Used by `.github/workflows/preview.yml` (see `docs/current/preview.md`). The
 * storefront cannot use `output: export` -- it reads request headers, has
 * server actions, mints CSP nonces and runs a proxy -- so this script requests
 * every page from the *running* server instead and writes what came back.
 *
 *   node scripts/preview-snapshot.mjs \
 *     --origin http://127.0.0.1:3100 --host preview.example.org \
 *     --out preview-site --public-dir storefront/public \
 *     --pull-request 123 --sha <40 hex> --base-path /plepic/
 *
 * What the snapshot is: server-rendered HTML and CSS only. Next's client
 * JavaScript loads chunks from absolute `/_next/` paths and cannot hydrate
 * under a sub-path, so every `<script>` is removed, together with the nonce
 * and the canonical/alternate/Open Graph tags that name the (synthetic)
 * canonical host. Every internal reference is rewritten to a relative one, so
 * the snapshot works at `https://<owner>.github.io/<repo>/`.
 *
 * Dependency-free on purpose: Node's standard library only.
 */
import { Buffer } from "node:buffer";
import console from "node:console";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    origin: { type: "string" },
    host: { type: "string" },
    out: { type: "string" },
    "public-dir": { type: "string" },
    "pull-request": { type: "string" },
    sha: { type: "string" },
    "base-path": { type: "string" },
  },
});

function fail(message) {
  console.error(`preview-snapshot: ${message}`);
  process.exit(1);
}

for (const name of ["origin", "host", "out", "public-dir", "pull-request", "sha", "base-path"]) {
  if (args[name] === undefined) fail(`--${name} is required`);
}
if (!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(args.origin)) fail("--origin must be a loopback http origin");
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(args.host)) fail("--host must be a bare hostname");
if (!/^[1-9][0-9]*$/.test(args["pull-request"])) fail("--pull-request must be a positive integer");
if (!/^[0-9a-f]{40}$/.test(args.sha)) fail("--sha must be a full lowercase commit SHA");
if (!/^\/[A-Za-z0-9._-]+\/$/.test(args["base-path"])) fail("--base-path must look like /repository/");

const origin = new URL(args.origin);
const hostOrigin = `https://${args.host}`;
const outDir = resolve(args.out);
const basePath = args["base-path"];
const bannerText =
  `Preview of pull request #${args["pull-request"]} (${args.sha.slice(0, 7)}) ` +
  "— not the shop. Forms and basket do not work.";

/** One GET against the running server, presenting the synthetic canonical host. */
function get(path) {
  return new Promise((done, reject) => {
    const req = request(
      { host: origin.hostname, port: origin.port, path, method: "GET", headers: { host: args.host } },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          done({
            status: res.statusCode ?? 0,
            type: String(res.headers["content-type"] ?? ""),
            location: res.headers.location === undefined ? null : String(res.headers.location),
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout fetching ${path}`)));
    req.on("error", reject);
    req.end();
  });
}

/** `/a/b?x#y` -> `/a/b`, or null when the reference is not an internal path. */
function internalPath(reference) {
  let value = reference.trim();
  if (value.startsWith(hostOrigin)) value = value.slice(hostOrigin.length) || "/";
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value.split("#")[0].split("?")[0];
}

const pages = new Map(); // path -> html Buffer (raw, before rewriting)
const assets = new Map(); // path -> Buffer
const aliases = new Map(); // redirected path -> final path
const warnings = [];
const queue = [];
const seen = new Set();

function enqueue(path) {
  if (path === null || seen.has(path)) return;
  if (path.startsWith("/store-api") || path.startsWith("/_next/image")) return;
  seen.add(path);
  queue.push(path);
}

/** Removes scripts and everything that preloads one, before references are scanned. */
function stripScripts(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*\brel="(?:modulepreload)"[^>]*>/gi, "")
    .replace(/<link\b[^>]*\bas="script"[^>]*>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");
}

const ATTRIBUTE = /\b(href|src|poster|action|imagesrcset|srcset|content)="([^"]*)"/gi;

/** Splits a srcset into its URL candidates. */
function srcsetUrls(value) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((candidate) => candidate !== undefined && candidate !== "");
}

function referencesIn(html) {
  const found = [];
  for (const match of html.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    const value = match[2].replaceAll("&amp;", "&");
    if (name === "srcset" || name === "imagesrcset") found.push(...srcsetUrls(value));
    else found.push(value);
  }
  return found;
}

function cssReferences(css, cssPath) {
  const found = [];
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const value = match[2];
    if (value.startsWith("data:") || /^[a-z]+:/i.test(value)) continue;
    found.push(value.startsWith("/") ? value : new URL(value, `http://x${cssPath}`).pathname);
  }
  return found;
}

async function crawl() {
  while (queue.length > 0) {
    const path = queue.shift();
    let response = await get(path);
    // Follow same-origin redirects (retired routes), recording the alias so
    // links to the old path can be pointed at the final one.
    for (let hop = 0; response.status >= 300 && response.status < 400 && response.location !== null && hop < 5; hop += 1) {
      const target = internalPath(response.location);
      if (target === null) break;
      aliases.set(path, target);
      enqueue(target);
      response = null;
      break;
    }
    if (response === null) continue;
    if (response.status !== 200) {
      // A missing stylesheet would publish a silently unstyled preview. Any
      // other dead reference (the online game lives on another service; a
      // document a pull request links before adding it) is a finding the
      // reviewer should see in the preview, not a reason to publish nothing.
      if (path.startsWith("/_next/")) {
        fail(`${path} answered ${response.status}`);
      }
      warnings.push(`${path} answered ${response.status}`);
      continue;
    }
    if (response.type.startsWith("text/html")) {
      pages.set(path, response.body);
      for (const reference of referencesIn(stripScripts(response.body.toString("utf8")))) {
        enqueue(internalPath(reference));
      }
    } else {
      assets.set(path, response.body);
      if (response.type.startsWith("text/css")) {
        for (const reference of cssReferences(response.body.toString("utf8"), path)) enqueue(reference);
      }
    }
  }
}

/** Relative prefix from a page at `path` back to the snapshot root. */
function prefixFor(path) {
  const depth = path.split("/").filter(Boolean).length;
  return depth === 0 ? "./" : "../".repeat(depth);
}

function relativise(reference, prefix) {
  const trimmed = reference.trim();
  const path = internalPath(trimmed);
  if (path === null) return reference;
  const suffix = trimmed.slice((trimmed.startsWith(hostOrigin) ? hostOrigin.length : 0) + path.length);
  const final = aliases.get(path) ?? path;
  const isPage = pages.has(final) || (!assets.has(final) && !/\.[A-Za-z0-9]+$/.test(final));
  const local = final === "/" ? prefix : `${prefix}${final.slice(1)}${isPage ? "/" : ""}`;
  return `${local}${suffix}`;
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function rewritePage(path, raw) {
  const prefix = prefixFor(path);
  let html = stripScripts(raw.toString("utf8"));
  // Tags that name the synthetic canonical host, or that only make sense on the
  // live origin: none of them can be true for a preview.
  html = html
    .replace(/<link\b[^>]*\brel="(?:canonical|alternate)"[^>]*>/gi, "")
    .replace(/<meta\b[^>]*\b(?:property="og:(?:url|image)[^"]*"|name="twitter:image[^"]*")[^>]*>/gi, "")
    .replace(/<meta\b[^>]*\bname="robots"[^>]*>/gi, "")
    // External stylesheets and preloads (the Turnstile loader, for one).
    .replace(/<link\b[^>]*\bhref="https?:\/\/[^"]*"[^>]*>/gi, "")
    .replace(/\snonce="[^"]*"/gi, "")
    .replace(/\sdata-precedence="[^"]*"/gi, "");

  html = html.replace(/\b(href|src|poster|action|imagesrcset|srcset)="([^"]*)"/gi, (_whole, name, value) => {
    const decoded = value.replaceAll("&amp;", "&");
    if (name.toLowerCase() === "srcset" || name.toLowerCase() === "imagesrcset") {
      const rewritten = value
        .split(",")
        .map((candidate) => {
          const [url, ...rest] = candidate.trim().split(/\s+/);
          return [relativise(url ?? "", prefix), ...rest].join(" ");
        })
        .join(", ");
      return `${name}="${rewritten}"`;
    }
    return `${name}="${relativise(decoded, prefix).replaceAll("&", "&amp;")}"`;
  });

  const head = [
    '<meta name="robots" content="noindex, nofollow">',
    `<link rel="icon" href="${prefix}favicon.ico">`,
  ].join("");
  html = html.replace(/<head([^>]*)>/i, (whole) => `${whole}${head}`);

  const banner =
    '<div role="note" style="position:sticky;top:0;z-index:2147483647;padding:.6rem 1rem;' +
    "background:#ffe14d;color:#111;font:600 15px/1.4 system-ui,sans-serif;text-align:center;" +
    `border-bottom:2px solid #111">${escapeHtml(bannerText)}</div>`;
  html = html.replace(/<body([^>]*)>/i, (whole) => `${whole}${banner}`);
  return html;
}

/**
 * GitHub Pages serves `404.html` for any unknown path. The storefront's own
 * not-found page cannot be captured: Next streams a 404 as an empty shell and
 * draws the message with client JavaScript, which a snapshot does not carry.
 * So this is a plain page, and the `<base>` makes its one link work from any
 * depth.
 */
function notFoundPage() {
  const banner = escapeHtml(bannerText);
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    `<base href="${basePath}"><title>Page not found</title></head>` +
    '<body style="margin:0;font:16px/1.5 system-ui,sans-serif">' +
    '<div role="note" style="padding:.6rem 1rem;background:#ffe14d;color:#111;font-weight:600;' +
    `text-align:center;border-bottom:2px solid #111">${banner}</div>` +
    '<main style="padding:2rem 1rem"><h1>Page not found</h1>' +
    "<p>This address is not part of the preview snapshot.</p>" +
    '<p><a href="./">Go to the preview home page</a></p></main></body></html>'
  );
}

function rewriteCss(path, css) {
  // Next's own stylesheets use paths relative to the file; only an absolute
  // reference needs rewriting.
  // `prefixFor` counts path segments, which for a file includes the file name.
  const prefix = prefixFor(dirname(path));
  return css.replace(/url\(\s*(['"]?)(\/[^'")]*)\1\s*\)/g, (_whole, quote, value) => {
    return `url(${quote}${prefix}${value.slice(1)}${quote})`;
  });
}

function write(relativePath, content) {
  const target = join(outDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

async function main() {
  // Seeds: every sitemap entry (all editions) and the favicon; everything else
  // is found by following links.
  const sitemap = await get("/sitemap.xml");
  if (sitemap.status !== 200) fail(`/sitemap.xml answered ${sitemap.status}`);
  const sitemapPaths = [...sitemap.body.toString("utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => internalPath(match[1]))
    .filter((path) => path !== null);
  if (sitemapPaths.length < 10) fail(`sitemap listed only ${sitemapPaths.length} pages`);
  for (const path of sitemapPaths) enqueue(path);
  enqueue("/favicon.ico");

  await crawl();

  for (const path of sitemapPaths) {
    if (!pages.has(path)) fail(`sitemap page ${path} was not captured (${warnings.join("; ")})`);
  }

  mkdirSync(outDir, { recursive: true });
  for (const [path, raw] of pages) {
    write(path === "/" ? "index.html" : join(path.slice(1), "index.html"), rewritePage(path, raw));
  }
  write("404.html", notFoundPage());
  for (const [path, body] of assets) {
    write(path.slice(1), path.endsWith(".css") ? rewriteCss(path, body.toString("utf8")) : body);
  }

  // The rulebook PDFs are linked from the rulebook page; copy the directory
  // so every edition's file is present whether or not a link was crawled.
  const documents = join(resolve(args["public-dir"]), "documents");
  if (existsSync(documents)) {
    for (const name of readdirSync(documents)) {
      mkdirSync(join(outDir, "documents"), { recursive: true });
      copyFileSync(join(documents, name), join(outDir, "documents", name));
    }
  }

  // GitHub Pages runs Jekyll unless told not to, and Jekyll drops `_next/`.
  write(".nojekyll", "");

  console.log(`captured ${pages.size} pages and ${assets.size} assets into ${outDir}`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  verify();
}

/** The snapshot's own acceptance test: refuses to publish a leaky or broken one. */
function verify() {
  const problems = [];
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
    );
  for (const file of walk(outDir).filter((name) => name.endsWith(".html"))) {
    // The 404 page's `<base>` is the one deliberate absolute reference.
    const html = readFileSync(file, "utf8").replace(/<base\b[^>]*>/gi, "");
    if (/<script\b/i.test(html)) problems.push(`${file}: contains a <script>`);
    if (/\b(?:href|src|action|poster|srcset)="\//i.test(html)) problems.push(`${file}: absolute internal reference`);
    if (html.includes(args.host)) problems.push(`${file}: names the synthetic host`);
    if (!html.includes('name="robots" content="noindex')) problems.push(`${file}: no noindex`);
    if (!html.includes(bannerText)) problems.push(`${file}: no banner`);
    if (/\snonce="/i.test(html)) problems.push(`${file}: carries a nonce`);
  }
  if (!existsSync(join(outDir, ".nojekyll"))) problems.push(".nojekyll missing");
  if (problems.length > 0) fail(`snapshot refused:\n${problems.join("\n")}`);
  console.log("snapshot verified: no scripts, no absolute references, noindex and banner on every page");
}

await main();
