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
 * So this scans the **source text** of everything under `storefront/`,
 * comments included, minus whatever git itself would not track — see "file
 * coverage" below for why that is the walk, not a fixed list of roots.
 * Comments are the whole point: a hostname in a comment leaks exactly as
 * completely as one in a string, and it is the likelier place for one to
 * appear, because a comment feels like an explanation rather than a value.
 * `content/content.test.ts` does the same for `content/`, and records in its
 * own doc comment that an earlier revision let a live hostname past for
 * exactly this reason. That file is not this package's to extend, and the
 * two guards are deliberately separate because they permit different
 * things — content may name no hostname at all, while this package must name
 * the third-party endpoints it actually talks to.
 *
 * The rule is an allowlist, not a blocklist. A blocklist would have to name
 * the very hostnames it exists to keep out of this repository, which is
 * self-defeating; an allowlist fails closed on a hostname nobody anticipated,
 * which is the case that matters.
 *
 * ---
 *
 * **The `storefront/public/` blind spot.** This guard originally scanned only
 * `src/` and `tests/`, by a fixed `SCAN_ROOTS` list. `t2-design-assets` added
 * a third tracked directory, `public/`, carrying committed web derivatives —
 * SVGs, PNGs, WebPs — and a fixed root list is exactly the kind of guard a
 * new directory disappears from silently. Two changes fix that:
 *
 * 1. **The walk is now "everything git would track under `storefront/`",**
 *    computed with `git ls-files --cached --others --exclude-standard`
 *    rather than a hardcoded root list. A future directory is covered the
 *    day it is created, without anyone remembering to add it here — the same
 *    reasoning `design/README.md` gives for computing its layer-dependent
 *    token set transitively instead of naming blocks by hand.
 * 2. **Binary assets get an extension policy of their own.** PNG, ICO and
 *    WebP bytes are not UTF-8 text, so running the hostname/IP regex over
 *    them is not meaningful — it would either false-positive on incidental
 *    byte sequences or (with a stricter decode) silently pass every binary
 *    file, which is worse than not checking. `TEXT_EXTENSIONS` are read and
 *    scanned exactly as before; `BINARY_EXTENSIONS` are instead held to two
 *    checks that *are* meaningful for a binary web derivative: the file is
 *    non-empty, it is small enough to be a derivative rather than an
 *    accidentally committed master (`design/README.md`'s masters are
 *    "multi-megabyte" by the plan's own description — the team photograph
 *    alone is 4.9 MB), and it carries **no metadata chunk**. A byte ceiling
 *    cannot see inside a file, and the operator's asset manifest records GPS
 *    EXIF on several of the source photographs; a coordinate or a camera
 *    serial riding inside a public web asset leaks exactly as completely as
 *    a hostname in a comment. Any extension in neither list still fails the
 *    "knows how to handle every file type" test, so the fail-closed
 *    guarantee the original file described survives the rewrite.
 *
 * **The SVG-namespace false positive.** Every raw inline SVG this unit
 * committed opens with `xmlns="http://www.w3.org/2000/svg"`, which is
 * boilerplate the SVG/XML spec requires on every conforming document, not a
 * hostname this repository talks to or is deployed at. The lazy fix would be
 * adding the W3C's own domain to `ALLOWED_DOMAINS` — exactly what this
 * file's own comment above warns against, because that list's meaning is
 * "third-party service endpoints the application genuinely talks to", and a
 * namespace URI is neither third-party nor an endpoint. `XML_NAMESPACE_URIS`
 * is a second, narrower allowlist for exact XML namespace URI strings,
 * stripped from the text before the hostname scan runs, so `ALLOWED_DOMAINS`
 * keeps its original meaning and the W3C's domain never has to appear in it
 * (nor, for the same self-referential reason, spelled out literally
 * anywhere else in this file outside the two full URIs below and the
 * assembled-at-runtime fixtures near the bottom — this guard scans its own
 * source, so it has to obey its own rule about writing a bare domain name).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { Buffer } from "node:buffer";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(storefrontDir);

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
  // `VideoEmbed.tsx` embeds from `youtube-nocookie.com`, and every call site
  // in this unit passes `youTubeId={null}` (no real YouTube video id exists
  // yet — see that component's doc comment), so nothing actually loads it
  // today. It is allowlisted here as the genuine future endpoint rather than
  // routed around, but `src/lib/csp.ts` does not yet permit it in
  // `frame-src`/`script-src` — this unit's authority to touch that file is
  // scoped to two carried findings and catalogue-placeholder resolution, not
  // video CSP, so a future unit supplying a real id must update the CSP too.
  // Recorded in the migration report as a follow-up dependency.
  //
  // The main, cookie-setting YouTube host is deliberately **not** here. It
  // was added beside this entry and nothing in the repository loads it —
  // `VideoEmbed` uses the no-cookie host and only that, and
  // `tests/video-embed.test.tsx` asserts the other one never reaches served
  // markup, assembling the string rather than spelling it. Widening a
  // publication guard for an entry nothing uses is exactly the drift the
  // guard exists to prevent; a unit that genuinely needs it adds it then,
  // with the reference that justifies it.
  "youtube-nocookie.com",
  // 3. Vendor documentation.
  "nextjs.org",
];

/**
 * Exact XML namespace URI strings, stripped from a file's text before the
 * hostname scan runs. These are syntactic requirements of well-formed SVG/XML
 * documents — every `<svg>` root in this repository carries the first one —
 * not references to a domain the application talks to or is deployed at.
 * Deliberately a list of exact, complete URI strings rather than a domain
 * (the W3C's own domain is not, and must not become, a member of
 * `ALLOWED_DOMAINS`): a component that genuinely named a live-looking
 * subdomain of that same domain in some other shape would still be caught —
 * see "the guard has teeth" below.
 */
const XML_NAMESPACE_URIS: readonly string[] = [
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1999/xlink",
];

function stripXmlNamespaceUris(text: string): string {
  return XML_NAMESPACE_URIS.reduce((acc, uri) => acc.split(uri).join(""), text);
}

/**
 * Read and scanned as UTF-8 text for a hostname or IP literal. `.css` is
 * here because a stylesheet can carry a hostname exactly as easily as a
 * script can — `url(https://…)` in a `background-image` or an `@font-face
 * src` — and this unit is the first to add any `.css` file under `src/`.
 */
const TEXT_EXTENSIONS: readonly string[] = [".ts", ".tsx", ".json", ".svg", ".css"];

/**
 * Adapted SVG icon components (`src/components/icons/FeatureIcons.tsx`)
 * inline raw `<path d="…">` coordinate data — hundreds of period-separated
 * decimal numbers, verbatim from the source vector files. A four-groups-of-
 * digits-and-dots run inside that data collides with the IPv4 pattern by
 * pure chance (curve coordinates are not routing information, but
 * `44.88,15.89` and its neighbours read the same as a dotted-quad to a
 * regular expression that cannot tell coordinate geometry from a network
 * address). This strips the *contents* of every `d="…"` attribute — never
 * the rest of the file — before the IPv4 scan runs. It is narrow by
 * construction: a `d` attribute is SVG path-command syntax, never a place a
 * real deployment address would legitimately appear, so stripping it cannot
 * hide one. See "the guard has teeth" for a test that a routable address
 * written *outside* a `d` attribute in the same file is still caught.
 */
const SVG_PATH_DATA = /\bd="[^"]*"/g;

function stripSvgPathData(text: string): string {
  return text.replaceAll(SVG_PATH_DATA, 'd=""');
}

/**
 * `node:path`'s `extname` returns `""` for a dotfile with no further
 * extension (`.gitignore`), which would otherwise fall into "unknown" and
 * fail the coverage test. These are named individually rather than matched
 * by pattern, so a *different* extensionless file added later still fails
 * closed instead of silently inheriting this exemption.
 */
const EXTENSIONLESS_TEXT_BASENAMES: readonly string[] = [".gitignore"];

/**
 * Not read as text. Held instead to existence, non-emptiness, and a byte
 * ceiling that separates "a web derivative" from "an accidentally committed
 * master" — see the file-level doc comment.
 */
const BINARY_EXTENSIONS: readonly string[] = [".ico", ".png", ".jpg", ".jpeg", ".webp"];

/**
 * Generous relative to every derivative this unit actually produced (the
 * largest is the 2400px-wide team photograph WebP, well under 400 KB) and
 * two orders of magnitude below "multi-megabyte" master territory (the team
 * photograph's own master is 4.9 MB). A file that trips this is either a
 * master committed by mistake or a derivative that was never downsized —
 * both worth failing loudly on rather than accepting quietly.
 */
const MAX_BINARY_ASSET_BYTES = 800_000;

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

function gitTrackedPaths(): readonly string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "."], {
    cwd: storefrontDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .filter((line) => line.length > 0);
}

interface IgnoreRules {
  /** `name/` — matches a directory of that name at any depth. */
  readonly directoryNames: readonly string[];
  /** `name`, `*.ext`, `.env.*` — matches a basename at any depth, file or directory. */
  readonly basenameGlobs: readonly string[];
  /** Lines this reader could not express, verbatim and attributed. */
  readonly inexpressible: readonly string[];
}

/**
 * The ignore rules the fallback walk honours, read from the two `.gitignore`
 * files that govern this package, plus `.git` itself.
 *
 * Two pattern forms only, because those are the two the ignore files
 * actually use: a bare `name/` directory, and an anchorless basename that
 * may contain `*`. Anything with a `/` inside it, a `!` negation, or a
 * character class is *not* silently approximated — it is reported, and the
 * coverage test below fails on it. A gitignore reader that guesses is worse
 * than no reader at all here, because the thing it would guess wrong about
 * is which files the publication guard scans.
 */
function ignoreRules(): IgnoreRules {
  const directoryNames = new Set<string>([".git"]);
  const basenameGlobs = new Set<string>();
  const inexpressible: string[] = [];

  for (const path of [join(repoRoot, ".gitignore"), join(storefrontDir, ".gitignore")]) {
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (line.length === 0 || line.startsWith("#")) continue;
      const body = line.endsWith("/") ? line.slice(0, -1) : line;
      const expressible = !body.includes("/") && !/[!?[\]]/.test(body) && !body.includes("**");
      if (!expressible) inexpressible.push(`${basename(dirname(path))}/.gitignore: ${line}`);
      else if (line.endsWith("/")) directoryNames.add(body);
      else basenameGlobs.add(body);
    }
  }

  return {
    directoryNames: [...directoryNames].toSorted(),
    basenameGlobs: [...basenameGlobs].toSorted(),
    inexpressible,
  };
}

/** A gitignore basename glob — `*` only — as an anchored regular expression. */
function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${glob.replaceAll(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*")}$`);
}

function walkedPaths(rules: IgnoreRules): readonly string[] {
  const globs = rules.basenameGlobs.map(globToRegExp);
  const ignored = (name: string, isDirectory: boolean): boolean =>
    (isDirectory && rules.directoryNames.includes(name)) || globs.some((glob) => glob.test(name));

  const found: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignored(entry.name, entry.isDirectory())) continue;
      const relativePath = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(directory, entry.name), relativePath);
      else if (entry.isFile()) found.push(relativePath);
    }
  };
  visit(storefrontDir, "");
  return found;
}

/**
 * Every path under `storefront/` git would track: already-committed files
 * (`--cached`) plus untracked-but-not-ignored ones (`--others
 * --exclude-standard`), so a file created and left staged-or-not by this
 * unit is covered exactly like one from an earlier PR. `.gitignore`d
 * directories (`node_modules/`, `.next/`, …) never appear, which is the
 * "minus gitignored paths" the migration packet asks for, sourced from git's
 * own gitignore engine rather than a reimplementation of it.
 *
 * **The assumption that was load-bearing, and the fallback that replaced
 * it.** `git ls-files` needs a git checkout, and this suite has to be able
 * to run where there is not one: a Docker build context copies the tree
 * without `.git`, and so does a packed tarball or an unpacked `npm pack`.
 * The guard hard-failing there would mean the publication check is the first
 * thing to break in precisely the environments nobody is watching — so a
 * missing repository falls back to walking the directory and skipping the
 * ignored directory names, which is the reimplementation the paragraph above
 * deliberately avoids.
 *
 * It stays a fallback, not the default, because it is strictly weaker: it
 * reads only the two `.gitignore` pattern forms described on `ignoreRules()`,
 * and it cannot tell a deleted-but-still-staged file from a live one. So it
 * fails closed twice over, and the coverage tests below run both guards on
 * every ordinary run rather than waiting for the day the fallback is load
 * bearing: no ignore-file line may exist that the reader could not express,
 * and the two walks must agree file for file wherever git is available. A
 * future `!keep/this` or `build/**\/tmp` breaks the suite loudly rather than
 * quietly scanning, or quietly skipping, the wrong set of files.
 */
const ignoredDirectories = ignoreRules();
const walk = ((): { readonly source: "git" | "directory walk"; readonly paths: readonly string[] } => {
  // `existsSync` rather than `try` alone: a `.git` may also be a file (a
  // worktree or submodule pointer), and git may be absent from `PATH`
  // entirely, which throws the same way an unusable repository does.
  if (existsSync(join(repoRoot, ".git"))) {
    try {
      return { source: "git", paths: gitTrackedPaths().toSorted() };
    } catch {
      // A `.git` that exists but is unusable — a corrupt or partial copy.
    }
  }
  return { source: "directory walk", paths: walkedPaths(ignoredDirectories).toSorted() };
})();
const trackedPaths = walk.paths;

interface ScannedTextFile {
  readonly name: string;
  readonly source: string;
}

interface ScannedBinaryFile {
  readonly name: string;
  readonly bytes: number;
  readonly bytesRead: Buffer;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Chunk types that carry authored or captured metadata rather than pixels:
 * PNG's three text chunks (`tEXt`, `zTXt`, `iTXt` — the last is where XMP
 * lives) and its EXIF chunk, and WebP's `EXIF` and `XMP ` RIFF chunks.
 */
const PNG_METADATA_CHUNKS: readonly string[] = ["tEXt", "zTXt", "iTXt", "eXIf"];
const WEBP_METADATA_CHUNKS: readonly string[] = ["EXIF", "XMP "];

function pngChunkTypes(bytes: Buffer): readonly string[] {
  const types: string[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    types.push(type);
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return types;
}

function isPng(bytes: Buffer): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

/** An ICONDIR header: reserved 0, type 1 (icon), at least one image. */
function isIco(bytes: Buffer): boolean {
  return bytes.length >= 6 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1 && bytes.readUInt16LE(4) > 0;
}

/**
 * The image payloads inside an ICO.
 *
 * `.ico` was previously waved through as "a bare directory of bitmaps with
 * no metadata container at all", which is true of the BMP form and false of
 * the one actually committed: `favicon.ico` is a **PNG-in-ICO** — a 6-byte
 * ICONDIR, one 16-byte ICONDIRENTRY, and a complete 32x32 PNG at its
 * `imageOffset`. A `tEXt` or `eXIf` chunk in that PNG would have ridden into
 * a public repository entirely unseen, because the container check never
 * looked past the directory. Each entry is unwrapped here and handed to the
 * same PNG reader as any other PNG.
 */
function icoImages(bytes: Buffer): readonly Buffer[] {
  const images: Buffer[] = [];
  const count = bytes.readUInt16LE(4);
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    if (entry + 16 > bytes.length) break;
    const size = bytes.readUInt32LE(entry + 8);
    const offset = bytes.readUInt32LE(entry + 12);
    if (offset + size > bytes.length) break;
    images.push(bytes.subarray(offset, offset + size));
  }
  return images;
}

function riffChunkTypes(bytes: Buffer): readonly string[] {
  const types: string[] = [];
  let offset = 12; // "RIFF" + size + "WEBP"
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    types.push(type);
    offset += 8 + length + (length % 2);
  }
  return types;
}

/**
 * Metadata chunk types present in a committed raster, or `[]`.
 *
 * The byte ceiling above cannot see inside a file, and the operator's asset
 * manifest records GPS EXIF on several of the source photographs these
 * derivatives come from. A location, a camera serial or a `Photoshop` XMP
 * packet riding along inside a public web asset is a leak the same shape as
 * a hostname in a comment — invisible in review, permanent once pushed.
 * These files are in fact clean today; nothing asserted it, so nothing kept
 * them that way.
 *
 * Chunk-level, deliberately, rather than a `strings | grep`: running a text
 * search over compressed pixel data false-positives (`hand-cards-480.webp`
 * matches "exif" by chance in its VP8 payload), and a check that cries wolf
 * is a check that gets deleted.
 */
function metadataChunks(file: ScannedBinaryFile): readonly string[] {
  const bytes = file.bytesRead;
  if (isPng(bytes)) {
    return pngChunkTypes(bytes).filter((type) => PNG_METADATA_CHUNKS.includes(type));
  }
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return riffChunkTypes(bytes).filter((type) => WEBP_METADATA_CHUNKS.includes(type));
  }
  if (isIco(bytes)) {
    return icoImages(bytes).flatMap((image) =>
      isPng(image) ? pngChunkTypes(image).filter((type) => PNG_METADATA_CHUNKS.includes(type)) : [],
    );
  }
  // Unreachable while `recognisedContainer` is asserted below; a container
  // this function cannot read must fail there rather than pass here.
  return [];
}

const textFiles: ScannedTextFile[] = [];
const binaryFiles: ScannedBinaryFile[] = [];
const pdfFiles: ScannedBinaryFile[] = [];
const unknownExtensionFiles: string[] = [];

for (const relativePath of trackedPaths) {
  const ext = extname(relativePath);
  const absolutePath = join(storefrontDir, relativePath);
  if (TEXT_EXTENSIONS.includes(ext) || EXTENSIONLESS_TEXT_BASENAMES.includes(basename(relativePath))) {
    textFiles.push({ name: relativePath, source: readFileSync(absolutePath, "utf8") });
  } else if (BINARY_EXTENSIONS.includes(ext)) {
    binaryFiles.push({
      name: relativePath,
      bytes: statSync(absolutePath).size,
      bytesRead: readFileSync(absolutePath),
    });
  } else if (ext === ".pdf") {
    pdfFiles.push({
      name: relativePath,
      bytes: statSync(absolutePath).size,
      bytesRead: readFileSync(absolutePath),
    });
  } else {
    unknownExtensionFiles.push(relativePath);
  }
}

describe("file coverage", () => {
  it("walked a plausible number of tracked files", () => {
    expect(trackedPaths.length).toBeGreaterThan(20);
  });

  it("understood every pattern in the ignore files it may have to honour itself", () => {
    // Asserted whichever walk ran, so the fallback is proven usable *before*
    // the day something has to use it. A pattern this reader cannot express
    // means the fallback would scan or skip the wrong files, silently.
    expect(
      ignoredDirectories.inexpressible,
      `the ${walk.source} walk is in use, but the directory-walk fallback can only express a bare ` +
        "`name/` directory or an anchorless basename glob. Teach ignoreRules() the new form, or accept " +
        "that a checkout without .git would scan the wrong set of files",
    ).toEqual([]);
    expect(ignoredDirectories.directoryNames).toContain("node_modules");
    expect(ignoredDirectories.directoryNames).toContain(".git");
    expect(ignoredDirectories.basenameGlobs).toContain("*.tsbuildinfo");
  });

  it("never misses a file the git walk would have found", () => {
    // The fallback's only job is to be a faithful stand-in where `.git` is
    // absent, and the one place that is checkable is here, where both walks
    // can run. Tested as a superset, not an equality: a developer's global
    // excludes or `.git/info/exclude` can legitimately make git's list the
    // smaller one, and scanning a file too many is harmless where missing
    // one is the whole failure mode this guard exists to prevent.
    if (walk.source !== "git") return;
    const walked = new Set(walkedPaths(ignoredDirectories));
    const missed = trackedPaths.filter((path) => !walked.has(path)).toSorted();
    expect(
      missed,
      "the directory-walk fallback would skip a file git tracks, so a checkout without .git would " +
        "publish it unscanned",
    ).toEqual([]);
  });

  it("found files below every top-level directory this unit knows about", () => {
    for (const root of ["src/", "tests/", "public/"]) {
      expect(
        trackedPaths.some((path) => path.startsWith(root)),
        `expected at least one tracked file under storefront/${root}`,
      ).toBe(true);
    }
  });

  it("knows how to handle every file type it found", () => {
    expect(
      unknownExtensionFiles,
      "add the extension to TEXT_EXTENSIONS or BINARY_EXTENSIONS above, after checking which scan it needs",
    ).toEqual([]);
  });

  it("scans this file too, so the guard cannot exempt itself", () => {
    expect(textFiles.some((file) => file.name === "tests/no-live-hostname.test.ts")).toBe(true);
  });

  it("did not silently drop package-root files that used to be scanned individually", () => {
    for (const name of ["next.config.ts", "next-env.d.ts", "package.json", "tsconfig.json", "vitest.config.ts"]) {
      expect(trackedPaths.includes(name), `${name} was not tracked or was not scanned`).toBe(true);
    }
  });
});

describe("no source file names a hostname outside the allowlist, comments included", () => {
  for (const file of textFiles) {
    it(`${file.name}`, () => {
      const scannable = stripXmlNamespaceUris(file.source);
      const offenders = [
        ...new Set(
          [...scannable.matchAll(HOSTNAME)]
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
  for (const file of textFiles) {
    it(`${file.name}`, () => {
      const offenders = [
        ...new Set(
          [...stripSvgPathData(file.source).matchAll(IPV4)]
            .filter((match) => !isDocumentationOrPrivateAddress(match.slice(1, 5).map(Number)))
            .map((match) => match[0]),
        ),
      ].toSorted();

      expect(offenders, "use an RFC 5737 documentation address").toEqual([]);
    });
  }
});

describe("binary assets are derivatives, not masters", () => {
  it("found at least one committed binary asset to hold to the policy", () => {
    expect(binaryFiles.length).toBeGreaterThan(0);
  });

  for (const file of binaryFiles) {
    it(`${file.name} is non-empty and under ${MAX_BINARY_ASSET_BYTES.toLocaleString()} bytes`, () => {
      expect(file.bytes, `${file.name} is empty`).toBeGreaterThan(0);
      expect(
        file.bytes,
        `${file.name} is ${file.bytes.toLocaleString()} bytes — masters are multi-megabyte and belong in ` +
          "private archival storage, never in this repository; if this is a legitimate large derivative, " +
          "confirm that first and raise MAX_BINARY_ASSET_BYTES deliberately rather than routing around it",
      ).toBeLessThan(MAX_BINARY_ASSET_BYTES);
    });
  }
});

/**
 * The rulebook PDF — `t2-pages`'s one committed PDF, and the first this guard
 * has ever had to handle. It does not fit either existing category:
 *
 * - **Not text.** A PDF's content streams are `FlateDecode`-compressed
 *   binary, so reading it as UTF-8 and running the hostname/IP regex over it
 *   (`TEXT_EXTENSIONS`'s treatment) would scan compressed bytes, not
 *   characters — meaningless, and liable to false-positive on incidental
 *   byte sequences the way `SVG_PATH_DATA` already has to guard against for
 *   coordinate data.
 * - **Not held to `MAX_BINARY_ASSET_BYTES`.** That ceiling (800 KB) is
 *   calibrated for image derivatives; a 25-page rulebook with real
 *   typesetting and diagrams is legitimately larger, and the migration
 *   report states the actual trade-off: recompressing this exact file with
 *   Ghostscript (`gs -dPDFSETTINGS=/ebook`) was tried and measured — it cuts
 *   8,898,253 bytes to 3,210,697, and it also flips `pdfinfo`'s `Tagged:` from
 *   `yes` to `no`, which fails this checkbox's own "tagged and selectable
 *   rather than a scan" requirement outright. Shipping the verified master
 *   byte-for-byte is the correct trade, not a shortcut.
 *
 * So this file gets its own, narrower guarantee: it is a real PDF (the
 * `%PDF-` magic bytes), it is under a ceiling that is generous for a rulebook
 * but would still catch an accidentally-committed multi-file archive, and —
 * in place of a text scan this format cannot support — its exact bytes match
 * the sha256 the migration report records for the operator's verified master,
 * `Tagged: yes`, not encrypted, 25 pages, real extractable text confirmed
 * with `pdfinfo`/`pdftotext` at the moment this hash was pinned. A future
 * accidental substitution (a different file at the same path) fails this
 * hash check immediately, rather than silently shipping something nobody
 * re-verified as tagged and selectable.
 */
const RULEBOOK_MASTER_SHA256 = "40ef85439b4573495227be7ef905ecc0a30737e7477d294609079f01befce2ee";
const MAX_PDF_ASSET_BYTES = 10_000_000;

describe("the committed rulebook PDF is the exact, verified master", () => {
  it("found the rulebook to hold to the policy", () => {
    expect(pdfFiles.length).toBeGreaterThan(0);
  });

  for (const file of pdfFiles) {
    it(`${file.name} is a real PDF, non-empty, and under ${MAX_PDF_ASSET_BYTES.toLocaleString()} bytes`, () => {
      expect(file.bytes, `${file.name} is empty`).toBeGreaterThan(0);
      expect(file.bytesRead.toString("ascii", 0, 5)).toBe("%PDF-");
      expect(file.bytes).toBeLessThan(MAX_PDF_ASSET_BYTES);
    });

    it(`${file.name} matches the sha256 of the verified tagged-and-selectable master`, () => {
      const actual = createHash("sha256").update(file.bytesRead).digest("hex");
      expect(
        actual,
        `${file.name} does not match the master this guard pinned — re-verify it with pdfinfo/pdftotext ` +
          "(Tagged: yes, not encrypted, real extractable text) before updating RULEBOOK_MASTER_SHA256",
      ).toBe(RULEBOOK_MASTER_SHA256);
    });
  }
});

/**
 * A minimal PNG carrying the given chunks, assembled at runtime rather than
 * committed as a fixture — a fixture would itself be a committed raster and
 * would have to fail the very assertion it exists to exercise.
 */
function pngWithChunks(chunks: readonly (readonly [string, Buffer])[]): Buffer {
  const encode = (type: string, payload: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length);
    return Buffer.concat([length, Buffer.from(type, "ascii"), payload, Buffer.alloc(4)]);
  };
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    ...chunks.map(([type, payload]) => encode(type, payload)),
    encode("IEND", Buffer.alloc(0)),
  ]);
}

describe("committed rasters carry no EXIF, XMP or text metadata", () => {
  for (const file of binaryFiles) {
    it(`${file.name}`, () => {
      expect(
        metadataChunks(file),
        `${file.name} carries a metadata chunk — strip it (the source photographs behind these ` +
          "derivatives are recorded as carrying GPS EXIF) before committing the derivative",
      ).toEqual([]);
    });
  }

  const containerOf = (file: ScannedBinaryFile): string => {
    const bytes = file.bytesRead;
    if (isPng(bytes)) return "png";
    if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
    if (isIco(bytes)) return "ico";
    return "unrecognised";
  };

  it("recognises the container of every binary it scanned, so none is exempt by construction", () => {
    // Fail-closed, and the reason it has to be: `.ico` used to fall through
    // to `return []`, which read as "an ICO has no metadata" and meant "this
    // guard does not look at ICOs". `.jpg` and `.jpeg` are in
    // BINARY_EXTENSIONS and would fall through the same way today. An
    // unreadable container has to fail here rather than pass silently.
    const unrecognised = binaryFiles.filter((file) => containerOf(file) === "unrecognised").map((file) => file.name);
    expect(
      unrecognised,
      "this guard cannot read that container, so it cannot say the file carries no metadata — teach " +
        "metadataChunks() to read it, or take its extension out of BINARY_EXTENSIONS",
    ).toEqual([]);

    const containers = binaryFiles.map(containerOf);
    expect(containers).toContain("png");
    expect(containers).toContain("webp");
    expect(containers).toContain("ico");
  });

  it("reads inside a PNG-in-ICO rather than treating the wrapper as metadata-free", () => {
    const favicon = binaryFiles.find((file) => file.name === "public/favicon.ico");
    expect(favicon, "public/favicon.ico was not scanned").toBeTruthy();
    const images = icoImages(favicon!.bytesRead);
    expect(images.length, "the ICO directory yielded no image").toBeGreaterThan(0);
    expect(images.some((image) => isPng(image)), "favicon.ico is a PNG-in-ICO; the reader must see the PNG").toBe(
      true,
    );
  });

  it("would flag a metadata chunk hidden inside an ICO", () => {
    // The exact gap: a tEXt chunk in the PNG payload of a one-image ICO.
    const png = pngWithChunks([["IHDR", Buffer.alloc(13)], ["tEXt", Buffer.from("Artist\0somebody", "ascii")]]);
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    const entry = Buffer.alloc(16);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(22, 12);
    const ico = Buffer.concat([header, entry, png]);

    expect(isIco(ico)).toBe(true);
    expect(metadataChunks({ name: "fixture.ico", bytes: ico.length, bytesRead: ico })).toEqual(["tEXt"]);
  });

  it("would flag a metadata chunk if one were present", () => {
    const png = pngWithChunks([["IHDR", Buffer.alloc(13)], ["tEXt", Buffer.from("Software\0Adobe Photoshop", "ascii")]]);
    expect(metadataChunks({ name: "fixture.png", bytes: png.length, bytesRead: png })).toEqual(["tEXt"]);
  });
});

describe("the guard has teeth", () => {
  const check = (text: string): readonly string[] =>
    [...stripXmlNamespaceUris(text).matchAll(HOSTNAME)]
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

  it("lets the exact SVG namespace URI through without widening ALLOWED_DOMAINS", () => {
    expect(check('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">')).toEqual([]);
    // Assembled at runtime, like the brand fixtures above: this is the W3C's
    // own domain, spelled out to prove it is absent, and this file's own
    // scan (over its own literal source text) would otherwise flag a bare
    // occurrence exactly as it is designed to.
    const w3Domain = ["w3", "org"].join(".");
    expect(ALLOWED_DOMAINS).not.toContain(w3Domain);
  });

  it("does not let the namespace exemption swallow a different, live-looking host on the same domain", () => {
    const w3Domain = ["w3", "org"].join(".");
    expect(check(`https://status.${w3Domain}/incident`)).toEqual([w3Domain]);
  });

  it("does not let the SVG path-data exemption swallow a routable IP written outside a d attribute", () => {
    const routable = [212, 47, 220, 121].join(".");
    const offenders = [...stripSvgPathData(`<path d="M1 1 212.47.220.121"/> ${routable}`).matchAll(IPV4)].map(
      (match) => match[0],
    );
    expect(offenders).toEqual([routable]);
  });
});
