/**
 * The guard rail under the content model.
 *
 * The type system already makes an absolute URL, a hostname, a price and an
 * unkeyed proof claim unrepresentable as *structure* — there is no field that
 * accepts one. What it cannot see is a raw literal sitting inside a prose
 * string. This suite reads every content source file as text and fails the
 * build on one, which is what turns the plan's prohibitions from a convention
 * into a mechanism.
 *
 * This file is the only content file exempt from its own scanning, for the
 * obvious reason that it contains the patterns.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CAMPAIGN_STATE_PHRASES, NOT_PUBLISHABLE, SOURCES } from "./evidence.js";
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
 * Files exempt from the *phrase* checks, because they define or explain the
 * banned phrases. They are still scanned for URLs, hostnames and prices.
 */
const PHRASE_CHECK_EXEMPT = ["evidence.ts", "schema.ts"];

interface ContentFile {
  readonly name: string;
  readonly text: string;
}

function contentFiles(): readonly ContentFile[] {
  const entries = readdirSync(contentDir, { recursive: true, withFileTypes: true });
  const files: ContentFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;

    const full = join(entry.parentPath, entry.name);
    files.push({
      name: relative(contentDir, full).split(sep).join("/"),
      text: readFileSync(full, "utf8"),
    });
  }

  return files.toSorted((a, b) => a.name.localeCompare(b.name));
}

const files = contentFiles();

/** A trailing `\b` is deliberate on each of these; see the notes per test. */
const TLD = "com|net|org|eu|ee|dk|fi|io|dev|app|co|uk|de|shop|games|info|me|tv";

const FORBIDDEN_LITERALS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "a URL scheme", pattern: /\b[a-z][a-z0-9+.-]*:\/\//i },
  { label: "a protocol-relative URL", pattern: new RegExp(`//[a-z0-9-]+\\.(?:${TLD})\\b`, "i") },
  { label: "a hostname", pattern: new RegExp(`\\b[a-z0-9][a-z0-9-]*\\.(?:${TLD})\\b`, "i") },
  { label: "a mail scheme", pattern: /\bmailto:/i },
  { label: "an email address", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { label: "a currency symbol", pattern: /[€$£¥₽]/ },
  { label: "a currency code", pattern: /\b(?:EUR|USD|GBP)\b/ },
  { label: "a currency word", pattern: /\beuros?\b/i },
  { label: "a money amount", pattern: /\b\d+[.,]\d{2}\b/ },
  { label: "a cent amount", pattern: /\b\d+\s*cents?\b/i },
];

describe("content files carry no literal that belongs in configuration", () => {
  it("finds content files to check", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  for (const file of files) {
    for (const { label, pattern } of FORBIDDEN_LITERALS) {
      it(`${file.name} contains no ${label}`, () => {
        const match = pattern.exec(file.text);
        expect(
          match === null ? null : `${label}: ${JSON.stringify(match[0])}`,
        ).toBeNull();
      });
    }
  }
});

describe("content files carry no unpublishable claim and no campaign-state language", () => {
  const checked = files.filter((file) => !PHRASE_CHECK_EXEMPT.includes(file.name));

  it("exempts only the two files that define the phrase lists", () => {
    const names = files.map((file) => file.name);
    for (const exempt of PHRASE_CHECK_EXEMPT) {
      expect(names).toContain(exempt);
    }
    expect(files.length - checked.length).toBe(PHRASE_CHECK_EXEMPT.length);
  });

  for (const file of checked) {
    it(`${file.name} states no claim the evidence manifest excludes`, () => {
      const lowered = file.text.toLowerCase();
      const hits = NOT_PUBLISHABLE.filter((phrase) => lowered.includes(phrase));
      expect(hits).toEqual([]);
    });

    it(`${file.name} is written in the past tense of a shipped product`, () => {
      const lowered = file.text.toLowerCase();
      const hits = CAMPAIGN_STATE_PHRASES.filter((phrase) => lowered.includes(phrase));
      expect(hits).toEqual([]);
    });
  }
});

describe("substitutions", () => {
  it("every {token} used in content is a declared placeholder", () => {
    const unknown: string[] = [];

    for (const file of files) {
      for (const token of placeholderTokensIn(file.text)) {
        if (!isPlaceholderToken(token)) unknown.push(`${file.name}: {${token}}`);
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

describe("content is TypeScript, and only TypeScript", () => {
  it("renders no MDX", () => {
    const entries = readdirSync(contentDir, { recursive: true, withFileTypes: true });
    const mdx = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
      .map((entry) => entry.name);
    expect(mdx).toEqual([]);
  });
});

describe("evidence", () => {
  it("every registry entry's id matches its key", () => {
    for (const [key, source] of Object.entries(SOURCES)) {
      expect(source.id).toBe(key);
    }
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

  it("does not dress our own commercial terms up as third-party proof", () => {
    const sources: readonly SourceId[] = proofStrip.items.map((item) => item.source);
    expect(sources).not.toContain("task1-commercial-model");
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
