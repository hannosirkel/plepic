/**
 * The guard rail under the content model.
 *
 * The type system already makes an absolute URL, a hostname, a price and an
 * unkeyed proof claim unrepresentable as *structure* — there is no field that
 * accepts one. What it cannot see is a raw literal sitting inside a prose
 * string. This suite catches that, and it does so by **importing every content
 * module and walking the strings it actually exports**, not by reading the
 * source text.
 *
 * That distinction is the fix for two real holes in the first revision. A
 * source-text scan restricted to `.ts` let a `.tsx` or a `.json` under
 * `content/` through untouched — and `.tsx` is exactly what the next unit adds.
 * It also let `"plepicgames.com"` and `"E" + "UR 25.00"` past, because the
 * literal only exists after evaluation. Walking resolved values closes both:
 * whatever gymnastics produced the string, the string is what gets checked.
 *
 * A source-text pass is kept as well, because comments are not values and a
 * hostname in a comment still leaks. It is secondary; the value scan is what is
 * load-bearing.
 *
 * `EXTENSIONS` is closed and asserted against the directory, so a file type
 * nobody thought about fails the build rather than skipping the scan.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_STATE_PHRASES,
  COMMERCIAL_TERMS,
  NOT_PUBLISHABLE,
  SOURCES,
} from "./evidence.js";
import { legalPages } from "./legal/index.js";
import { pages } from "./pages.js";
import { proofStrip, quotations } from "./proof.js";
import { ROUTE_PATHS } from "./routes.js";
import {
  isPlaceholderToken,
  LEGAL_ELEMENTS,
  placeholderTokensIn,
  PLACEHOLDERS,
  unresolvedPlaceholdersIn,
  type LegalElement,
  type SourceId,
} from "./schema.js";

const contentDir = dirname(fileURLToPath(import.meta.url));

/**
 * Every extension allowed under `content/`, and how each is handled.
 *
 * `module`  — imported, and every string it exports is scanned.
 * `data`    — parsed as JSON, and every string in it is scanned.
 * `document`— editorial prose for humans, never rendered. It has no exported
 *              values, so only its source text is scanned — and the two
 *              documents named in `PHRASE_CHECK_EXEMPT` are exempt from that
 *              too, because their job is to quote the campaign copy that was
 *              removed and to record the commercial model for the editorial
 *              gate. A new, unlisted document is scanned like anything else.
 * `self`    — this file, which contains the patterns.
 */
const EXTENSIONS: Readonly<Record<string, "module" | "data" | "document">> = {
  ".ts": "module",
  ".tsx": "module",
  ".mts": "module",
  ".cts": "module",
  ".js": "module",
  ".jsx": "module",
  ".mjs": "module",
  ".json": "data",
  ".md": "document",
};

interface ContentFile {
  readonly name: string;
  readonly path: string;
  readonly kind: "module" | "data" | "document" | "self" | "unknown";
}

function listContentFiles(): readonly ContentFile[] {
  const entries = readdirSync(contentDir, { recursive: true, withFileTypes: true });
  const files: ContentFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const path = join(entry.parentPath, entry.name);
    const name = relative(contentDir, path).split(sep).join("/");
    const kind = name.endsWith(".test.ts")
      ? ("self" as const)
      : (EXTENSIONS[extname(name)] ?? ("unknown" as const));

    files.push({ name, path, kind });
  }

  return files.toSorted((a, b) => a.name.localeCompare(b.name));
}

const files = listContentFiles();

interface Walked {
  readonly strings: string[];
  /** Where a function was found, so a failure names the export. */
  readonly functions: string[];
}

/**
 * Every string reachable from `value`, and every function on the way.
 *
 * `Reflect.ownKeys` rather than `Object.values` so symbol-keyed and
 * non-enumerable properties are seen, and `Map`/`Set` are walked explicitly
 * because neither exposes its contents as own properties. A getter that throws
 * is skipped rather than allowed to abort the walk.
 *
 * Functions are collected rather than called. A content package should not
 * export any, which is both simpler to assert and a better rule than trying to
 * invoke them safely.
 */
function walk(value: unknown, path: string, seen: Set<object>, out: Walked): void {
  if (typeof value === "string") {
    out.strings.push(value);
    return;
  }
  if (typeof value === "function") {
    out.functions.push(path);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (value instanceof Map) {
    let index = 0;
    for (const [key, nested] of value) {
      walk(key, `${path}.<mapKey ${index}>`, seen, out);
      walk(nested, `${path}.<mapValue ${index}>`, seen, out);
      index += 1;
    }
    return;
  }

  if (value instanceof Set) {
    let index = 0;
    for (const nested of value) {
      walk(nested, `${path}.<setValue ${index}>`, seen, out);
      index += 1;
    }
    return;
  }

  for (const key of Reflect.ownKeys(value)) {
    let nested: unknown;
    try {
      nested = (value as Record<PropertyKey, unknown>)[key];
    } catch {
      continue;
    }
    walk(nested, `${path}.${String(key)}`, seen, out);
  }
}

function walkModule(value: unknown): Walked {
  const out: Walked = { strings: [], functions: [] };
  walk(value, "", new Set<object>(), out);
  return out;
}

interface ScannedFile {
  readonly name: string;
  /** Strings the module or data file actually exports. */
  readonly values: readonly string[];
  /** Function exports found on the way, by path. */
  readonly functions: readonly string[];
  /** Raw file text, comments included. */
  readonly source: string;
}

const scanned: ScannedFile[] = [];

for (const file of files) {
  const source = readFileSync(file.path, "utf8");

  if (file.kind === "module") {
    const walked = walkModule(await import(pathToFileURL(file.path).href));
    scanned.push({ name: file.name, values: walked.strings, functions: walked.functions, source });
  } else if (file.kind === "data") {
    const walked = walkModule(JSON.parse(source));
    scanned.push({ name: file.name, values: walked.strings, functions: walked.functions, source });
  } else if (file.kind === "document") {
    scanned.push({ name: file.name, values: [], functions: [], source });
  }
}

/**
 * Files exempt from the *phrase* checks, because they define or explain the
 * banned phrases. They are still scanned for URLs, hostnames and prices, and
 * the editorial documents are exempt because their job is to quote the copy
 * that was removed.
 */
const PHRASE_CHECK_EXEMPT = [
  "evidence.ts",
  "schema.ts",
  "README.md",
  "content-document.md",
];

const TLD = [
  "com", "net", "org", "info", "biz", "io", "dev", "app", "co", "me", "tv",
  "shop", "games", "eu", "ee", "dk", "fi", "se", "no", "lv", "lt", "de", "nl",
  "fr", "at", "it", "es", "pl", "cz", "ie", "uk", "us", "ru", "cn",
].join("|");

const FORBIDDEN_LITERALS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "URL scheme", pattern: /\b[a-z][a-z0-9+.-]*:\/\// },
  { label: "protocol-relative URL", pattern: new RegExp(`//[a-z0-9-]+\\.(?:${TLD})\\b`, "i") },
  { label: "hostname", pattern: new RegExp(`\\b[a-z0-9][a-z0-9-]*\\.(?:${TLD})\\b`, "i") },
  { label: "mail scheme", pattern: /\bmailto:/i },
  { label: "email address", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { label: "currency symbol", pattern: /[€$£¥₽₹]/ },
  { label: "currency code", pattern: /\b(?:EUR|USD|GBP|CHF|SEK|DKK|NOK|PLN)\b/ },
  { label: "currency word", pattern: /\beuros?\b|\bdollars?\b|\bpounds sterling\b/i },
  { label: "money amount", pattern: /\b\d+[.,]\d{2}\b/ },
  { label: "cent amount", pattern: /\b\d+\s*(?:cents?|pence)\b/i },
];

function firstMatch(strings: readonly string[], pattern: RegExp): string | null {
  for (const candidate of strings) {
    const match = pattern.exec(candidate);
    if (match !== null) return match[0];
  }
  return null;
}

describe("file coverage", () => {
  it("knows how to handle every file under content/", () => {
    const unknown = files.filter((file) => file.kind === "unknown").map((file) => file.name);
    expect(
      unknown,
      "add the extension to EXTENSIONS, or the scan silently skips these files",
    ).toEqual([]);
  });

  it("scans a value set from every module and data file", () => {
    const expected = files.filter(
      (file) => file.kind === "module" || file.kind === "data",
    ).length;
    const withValues = scanned.filter((file) => file.values.length > 0).length;
    expect(expected).toBeGreaterThan(8);
    expect(withValues).toBe(expected);
  });

  it("renders no MDX", () => {
    expect(files.filter((file) => file.name.endsWith(".mdx"))).toEqual([]);
  });

  /**
   * A content package exports data. A function is a place a string can hide
   * from the walk above, and there is no honest reason for copy to be computed,
   * so the rule is simply that content exports none.
   *
   * `schema.ts` is the one exception: it holds the model's placeholder helpers
   * and no copy. `index.ts` inherits them by re-export, and is held to
   * introducing none of its own.
   */
  it("exports no functions outside the model", () => {
    const offenders = scanned
      .filter((file) => file.name !== "schema.ts" && file.name !== "index.ts")
      .flatMap((file) => file.functions.map((path) => `${file.name}${path}`));

    expect(offenders).toEqual([]);
  });

  it("lets the barrel re-export the model's helpers and add none of its own", () => {
    const names = (file: string) =>
      new Set(
        (scanned.find((candidate) => candidate.name === file)?.functions ?? []).map(
          (path) => path.split(".").pop() ?? path,
        ),
      );

    const model = names("schema.ts");
    expect(model.size).toBeGreaterThan(0);
    for (const exported of names("index.ts")) {
      expect(model.has(exported), `index.ts exports ${exported}, which schema.ts does not`).toBe(
        true,
      );
    }
  });
});

describe("no exported string carries a literal that belongs in configuration", () => {
  for (const file of scanned) {
    if (file.values.length === 0) continue;

    for (const { label, pattern } of FORBIDDEN_LITERALS) {
      it(`${file.name} exports no ${label}`, () => {
        const hit = firstMatch(file.values, pattern);
        expect(hit === null ? null : `${label}: ${JSON.stringify(hit)}`).toBeNull();
      });
    }
  }
});

describe("no source file mentions one either, comments included", () => {
  for (const file of scanned) {
    for (const { label, pattern } of FORBIDDEN_LITERALS) {
      if (PHRASE_CHECK_EXEMPT.includes(file.name) && file.name.endsWith(".md")) continue;

      it(`${file.name} contains no ${label}`, () => {
        const match = pattern.exec(file.source);
        expect(match === null ? null : `${label}: ${JSON.stringify(match[0])}`).toBeNull();
      });
    }
  }
});

describe("no unpublishable claim and no campaign-state language", () => {
  const checked = scanned.filter((file) => !PHRASE_CHECK_EXEMPT.includes(file.name));

  it("exempts only the files that define or quote the phrase lists", () => {
    const names = scanned.map((file) => file.name);
    for (const exempt of PHRASE_CHECK_EXEMPT) expect(names).toContain(exempt);
    expect(scanned.length - checked.length).toBe(PHRASE_CHECK_EXEMPT.length);
  });

  for (const file of checked) {
    it(`${file.name} states no claim the evidence manifest excludes`, () => {
      const haystack = [...file.values, file.source].join("\n").toLowerCase();
      expect(NOT_PUBLISHABLE.filter((phrase) => haystack.includes(phrase))).toEqual([]);
    });

    it(`${file.name} is written in the past tense of a shipped product`, () => {
      const haystack = [...file.values, file.source].join("\n").toLowerCase();
      expect(CAMPAIGN_STATE_PHRASES.filter((phrase) => haystack.includes(phrase))).toEqual([]);
    });
  }
});

describe("substitutions", () => {
  it("every placeholder used in content is declared", () => {
    const unknown: string[] = [];

    for (const file of scanned) {
      for (const candidate of [...file.values, file.source]) {
        for (const token of placeholderTokensIn(candidate)) {
          if (!isPlaceholderToken(token)) unknown.push(`${file.name}: ${token}`);
        }
      }
    }

    expect(unknown).toEqual([]);
  });

  it("every price-bearing placeholder resolves from the catalogue, not from content", () => {
    for (const token of ["price", "priceLine", "taxNote"] as const) {
      expect(PLACEHOLDERS[token].source).toBe("catalogue");
    }
  });

  it("every merchant identity placeholder resolves from configuration", () => {
    for (const token of [
      "merchantLegalName",
      "merchantRegisteredAddress",
      "merchantRegistrationNumber",
      "merchantVatNumber",
      "merchantContactAddress",
      "returnAddress",
    ] as const) {
      expect(PLACEHOLDERS[token].source).toBe("configuration");
    }
  });
});

describe("evidence", () => {
  it("every registry entry's id matches its key", () => {
    for (const [key, source] of Object.entries(SOURCES)) {
      expect(source.id).toBe(key);
    }
  });

  it("keeps commitments out of the evidence registry and evidence out of the commitments", () => {
    const evidenceIds = new Set(Object.keys(SOURCES));
    for (const term of Object.keys(COMMERCIAL_TERMS)) {
      expect(evidenceIds.has(term), `${term} is in both registries`).toBe(false);
    }
  });

  it("cites every commercial term somewhere in the copy", () => {
    const corpus = scanned
      .filter((file) => file.name !== "evidence.ts")
      .flatMap((file) => file.values);
    const cited = new Set(corpus);

    const uncited = Object.keys(COMMERCIAL_TERMS).filter((term) => !cited.has(term)).toSorted();
    expect(
      uncited,
      "an uncited commercial term is a promise nothing on the site makes — delete it or cite it",
    ).toEqual([]);
  });

  it("no source may be presented as an award, because that value does not exist", () => {
    for (const source of Object.values(SOURCES)) {
      expect(source.presentation).not.toContain("award");
    }
  });

  it("every quotation is attributed and keyed to a source that permits quotation", () => {
    expect(quotations.length).toBeGreaterThan(0);

    for (const quotation of quotations) {
      const source = SOURCES[quotation.source];
      expect(source, `unknown source ${quotation.source}`).toBeDefined();
      expect(quotation.attribution.length).toBeGreaterThan(0);
      expect(quotation.text.length).toBeGreaterThan(0);
      expect(source.presentation).toContain("quotation");
    }
  });

  it("the one unverifiable review carries its context inline", () => {
    for (const quotation of quotations) {
      if (SOURCES[quotation.source].unverifiableByVisitor === true) {
        expect(quotation.context, `${quotation.source} needs context`).toBeTruthy();
      }
    }
  });
});

describe("the proof strip is chosen, not accumulated", () => {
  it("carries two or three items", () => {
    expect(proofStrip.items.length).toBeGreaterThanOrEqual(2);
    expect(proofStrip.items.length).toBeLessThanOrEqual(3);
  });

  it("keys every item to the evidence registry", () => {
    for (const item of proofStrip.items) {
      expect(SOURCES[item.source]).toBeDefined();
      expect(item.headline.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeGreaterThan(0);
    }
  });

  it("headlines nothing a visitor cannot check for themselves", () => {
    for (const item of proofStrip.items) {
      expect(
        SOURCES[item.source].unverifiableByVisitor ?? false,
        `${item.source} stands on our word alone and cannot headline`,
      ).toBe(false);
    }
  });

  it("does not dress our own commitments up as third-party proof", () => {
    // Structural: ProofItem.source is a SourceId, and no CommercialTermId is a
    // SourceId, so this cannot compile wrong. Asserted anyway, because the
    // guarantee is only as good as the two unions staying disjoint.
    const commitments = new Set<string>(Object.keys(COMMERCIAL_TERMS));
    for (const item of proofStrip.items) {
      expect(commitments.has(item.source), `${item.source} is a commitment`).toBe(false);
    }
  });

  it("never heads an item with a source that may only support one", () => {
    for (const item of proofStrip.items) {
      expect(
        SOURCES[item.source].supportingOnly ?? false,
        `${item.source} may support a claim but not head one`,
      ).toBe(false);
    }
  });

  it("keys every supporting figure to the registry", () => {
    for (const item of proofStrip.items) {
      for (const support of item.supporting ?? []) {
        expect(SOURCES[support], `unknown supporting source ${support}`).toBeDefined();
      }
    }
  });

  /**
   * A claim a visitor can go and check is worth more than the figure in it.
   * Throwing that away by not linking is the failure this prevents.
   */
  it("links any item whose evidence a visitor could check", () => {
    for (const item of proofStrip.items) {
      const ids: readonly SourceId[] = [item.source, ...(item.supporting ?? [])];
      const checkable = ids
        .map((id) => SOURCES[id].checkableAt)
        .filter((target): target is NonNullable<typeof target> => target !== undefined);

      if (checkable.length === 0) continue;

      expect(item.link, `${item.source} cites checkable evidence but offers no link`).toBeDefined();
      expect(item.link?.target.kind).toBe("external");
      const target = item.link?.target;
      expect(target?.kind === "external" ? target.to : undefined).toBe(checkable[0]);
    }
  });

  it("gives a reason for every verified item it leaves out", () => {
    expect(proofStrip.rejected.length).toBeGreaterThan(0);

    const chosen = new Set<SourceId>(proofStrip.items.map((item) => item.source));

    for (const rejection of proofStrip.rejected) {
      expect(SOURCES[rejection.source]).toBeDefined();
      expect(chosen.has(rejection.source), `${rejection.source} is both used and rejected`).toBe(
        false,
      );
      expect(rejection.reason.length).toBeGreaterThan(40);
    }
  });
});

describe("legal pages", () => {
  it("cover every required element between them", () => {
    const covered = new Set<LegalElement>(legalPages.flatMap((page) => page.covers));
    const missing = LEGAL_ELEMENTS.filter((element) => !covered.has(element));
    expect(missing).toEqual([]);
  });

  it("claim no element twice, so each obligation has one home", () => {
    const seen = new Set<LegalElement>();
    const duplicated: LegalElement[] = [];

    for (const page of legalPages) {
      for (const element of page.covers) {
        if (seen.has(element)) duplicated.push(element);
        seen.add(element);
      }
    }

    expect(duplicated).toEqual([]);
  });

  it("keeps the consent obligations on the privacy page", () => {
    const privacyPage = legalPages.find((page) => page.route === "legalPrivacy");
    expect(privacyPage?.covers).toContain("analytics-lawful-basis");
    expect(privacyPage?.covers).toContain("third-party-processors");
  });

  it("are not marked approved while the merchant's details are still placeholders", () => {
    for (const page of legalPages) {
      const unresolved = page.body
        .flatMap((section) => section.body)
        .flatMap((paragraph) => unresolvedPlaceholdersIn(paragraph));

      if (unresolved.length > 0) {
        expect(
          page.reviewStatus,
          `${page.route} still needs ${unresolved.join(", ")}`,
        ).toBe("draft-pending-operator-input");
      }
    }
  });

  it("declare every section they say they contain", () => {
    for (const page of legalPages) {
      const anchors = page.body.map((section) => section.anchor);
      for (const anchor of page.sections) {
        expect(anchors, `${page.route} is missing section ${anchor}`).toContain(anchor);
      }
    }
  });
});

describe("the page registry", () => {
  it("has exactly one page per declared route", () => {
    const routes = pages.map((page) => page.route).toSorted();
    const declared = Object.keys(ROUTE_PATHS).toSorted();
    expect(routes).toEqual(declared);
  });

  it("gives every page a unique title", () => {
    const titles = pages.map((page) => page.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("gives every page a unique description", () => {
    const descriptions = pages.map((page) => page.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("keeps the basket and the checkout out of the index", () => {
    for (const route of ["cart", "checkout"] as const) {
      const page = pages.find((candidate) => candidate.route === route);
      expect(page?.indexable).toBe(false);
    }
  });

  it("keeps the two legacy fragment anchors on the product page", () => {
    const product = pages.find((page) => page.route === "lunarBase");
    expect(product?.sections).toContain("aboutgame");
    expect(product?.sections).toContain("video_trailer");
  });

  it("has exactly one canonical product page", () => {
    const productPages = pages.filter((page) => page.route === "lunarBase");
    expect(productPages).toHaveLength(1);
  });
});
