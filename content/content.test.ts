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
import { pagesByLocale } from "./index.js";
import { legalPages, legalPagesByLocale } from "./legal/index.js";
import { pages } from "./pages.js";
import { proofStrip, quotations } from "./proof.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  RETIRED_ROUTES,
  ROUTE_PATHS,
} from "./routes.js";
import {
  contentFor,
  isLocale,
  isPlaceholderToken,
  LEGAL_ELEMENTS,
  placeholderTokensIn,
  PLACEHOLDER_TABLE,
  PLACEHOLDERS,
  unresolvedPlaceholdersIn,
  type LegalElement,
  type SourceId,
} from "./schema.js";
import type { Locale } from "./routes.js";

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
    for (const token of ["price", "priceLine"] as const) {
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
      "merchantPhoneNumber",
      "returnAddress",
    ] as const) {
      expect(PLACEHOLDERS[token].source).toBe("configuration");
    }
  });

  /**
   * Every configuration-sourced placeholder is a legally required disclosure,
   * and the flag is what tells the renderer to show a named gap instead of
   * dropping the sentence. A new configuration placeholder that is *not* one —
   * a future social handle, say — is a deliberate decision, and this test is
   * where it gets made rather than inherited.
   */
  it("marks every configuration-sourced placeholder as a legally required disclosure", () => {
    const configured = Object.entries(PLACEHOLDER_TABLE).filter(
      ([, placeholder]) => placeholder.source === "configuration",
    );
    expect(configured.length).toBeGreaterThan(5);

    for (const [token, placeholder] of configured) {
      expect(placeholder.legallyRequired, `${token} has no legallyRequired decision`).toBe(true);
    }
  });

  it("marks no catalogue placeholder as a legally required disclosure", () => {
    for (const [token, placeholder] of Object.entries(PLACEHOLDER_TABLE)) {
      if (placeholder.source !== "catalogue") continue;
      expect(placeholder.legallyRequired ?? false, `${token}`).toBe(false);
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

/**
 * Every string a legal page will actually render: its paragraphs, the emphasised
 * `callout` above them, the term/detail pairs of any list, and every cell,
 * caption and note of any table.
 *
 * The list is exhaustive over `LegalSection` on purpose. `items` was added for
 * the browser-storage disclosure and `callout` and `table` for the operator's
 * price presentation and cookie table, and each time, a check written against
 * `body` alone silently stopped covering the new field — which is how a check
 * for the dismantled ODR platform, or for the trader identity, would go quietly
 * blind to the half of a page that a reader actually reads.
 */
function legalProseIn(page: (typeof legalPages)[number]): readonly string[] {
  return page.body.flatMap((section) => [
    section.heading,
    ...section.body,
    ...(section.callout === undefined ? [] : [section.callout.lead, section.callout.detail]),
    ...(section.items ?? []).flatMap((item) => [item.term, item.detail]),
    ...(section.table === undefined
      ? []
      : [
          section.table.caption,
          ...section.table.columns,
          ...section.table.rows.flat(),
          ...(section.table.notes ?? []),
        ]),
  ]);
}

/**
 * The closed-list guarantees, **per edition**.
 *
 * Coverage of `LEGAL_ELEMENTS`, one section per obligation, a caption on
 * every table and one cell per column in every row are properties of a set
 * of legal pages, not of the content package — so they are checked once per
 * locale rather than once for the default one. An edition that translated
 * four of the five notices would otherwise satisfy every check in this file
 * while covering four fifths of the obligations.
 */
/**
 * The words each edition's cookie table must be made of.
 *
 * The *properties* under test are language-independent — four columns in a
 * fixed order, durations hedged rather than asserted about other companies'
 * products, the consent status of every cookie stated beneath — but the
 * strings that carry them are the edition's own. A total `Record<Locale, …>`
 * keeps this honest the same way every registry is kept honest: a third
 * edition does not compile until somebody writes down what its hedged
 * durations look like, rather than inheriting an English regex that can
 * never match and a test that can never fail.
 */
const COOKIE_TABLE_LANGUAGE: Readonly<
  Record<
    Locale,
    {
      readonly columns: readonly string[];
      /** What a hedged duration starts with in this language. */
      readonly hedgedDuration: RegExp;
      /** Substrings of the operator's two consent sentences, one per class. */
      readonly consentStatements: readonly [string, string];
    }
  >
> = {
  en: {
    columns: ["Cookie", "Provider", "Purpose", "Duration"],
    hedgedDuration: /^(?:Up to |Varies)/,
    consentStatements: ["only with your consent", "do not require consent"],
  },
  et: {
    columns: ["Küpsis", "Teenusepakkuja", "Otstarve", "Kestus"],
    hedgedDuration: /^(?:Kuni |Varieerub)/,
    consentStatements: ["ainult sinu nõusolekul", "ega vaja nõusolekut"],
  },
};

/**
 * Phrases naming the dismantled ODR platform, in every published language.
 * One flat list checked against every edition, because a phrase that is
 * wrong in one language is not right in another.
 */
const ODR_PLATFORM_PHRASES = [
  "odr platform",
  "online dispute resolution platform",
  "odr-platvorm",
  "veebipõhise vaidluste lahendamise platvorm",
  "ec.europa",
] as const;

for (const locale of LOCALES) {
  const edition = contentFor(legalPagesByLocale, locale);

  describe(`legal pages (${locale})`, () => {
    it("cover every required element between them", () => {
      const covered = new Set<LegalElement>(edition.flatMap((page) => page.covers));
      const missing = LEGAL_ELEMENTS.filter((element) => !covered.has(element));
      expect(missing).toEqual([]);
    });

    it("claim no element twice, so each obligation has one home", () => {
      const seen = new Set<LegalElement>();
      const duplicated: LegalElement[] = [];

      for (const page of edition) {
        for (const element of page.covers) {
          if (seen.has(element)) duplicated.push(element);
          seen.add(element);
        }
      }

      expect(duplicated).toEqual([]);
    });

    /**
     * The teeth the closed list did not have.
     *
     * `covers` used to be a page-level array that no prose had to justify, so a
     * page could keep claiming an obligation whose section had been deleted, and
     * the two tests above would stay green. Coverage is now declared per section
     * and the page's array must equal the union — which means deleting a section
     * fails **here** (the page claims what nothing carries), and deleting it from
     * the page's array as well fails the closed-list test **above** (the site no
     * longer covers `LEGAL_ELEMENTS`). There is no edit that removes a required
     * disclosure and leaves the suite green.
     */
    it("derive every page's coverage from the sections that actually carry it", () => {
      for (const page of edition) {
        const fromSections = [...new Set(page.body.flatMap((section) => section.covers))].toSorted();
        expect(
          [...page.covers].toSorted(),
          `${page.route}'s covers does not match the union of its sections' covers — ` +
            "either a section carrying an obligation was deleted, or the page claims one no section carries",
        ).toEqual(fromSections);
      }
    });

    it("give every element exactly one section, so deleting that section is the only way to lose it", () => {
      const homes = new Map<LegalElement, string[]>();

      for (const page of edition) {
        for (const section of page.body) {
          for (const element of section.covers) {
            homes.set(element, [...(homes.get(element) ?? []), `${page.route}#${section.anchor}`]);
          }
        }
      }

      for (const element of LEGAL_ELEMENTS) {
        expect(homes.get(element), `${element} has no section carrying it`).toBeDefined();
        expect(homes.get(element), `${element} is claimed by more than one section`).toHaveLength(1);
      }
    });

    it("never let a section claim an obligation while carrying no prose", () => {
      for (const page of edition) {
        for (const section of page.body) {
          if (section.covers.length === 0) continue;
          const words = [
            ...section.body,
            ...(section.callout === undefined ? [] : [section.callout.lead, section.callout.detail]),
            ...(section.items ?? []).map((item) => item.detail),
            ...(section.table === undefined
              ? []
              : [...section.table.rows.flat(), ...(section.table.notes ?? [])]),
          ]
            .join(" ")
            .split(/\s+/)
            .filter((word) => word.length > 0);
          expect(
            words.length,
            `${page.route}#${section.anchor} claims ${section.covers.join(", ")} but has almost no prose`,
          ).toBeGreaterThan(20);
        }
      }
    });

    /**
     * The identity set the second qualified read found short by one (M1, the
     * telephone number). Pinned by name rather than left to prose, because the
     * failure mode is an omission and an omission is invisible to a scan of what
     * *is* written.
     */
    it("state the whole trader identity set on the imprint, telephone number included", () => {
      const imprintPage = edition.find((page) => page.route === "legalImprint");
      expect(imprintPage).toBeDefined();
      const prose = legalProseIn(imprintPage!).join("\n");

      for (const token of [
        "merchantLegalName",
        "merchantRegisteredAddress",
        "merchantRegistrationNumber",
        "merchantVatNumber",
        "merchantContactAddress",
        "merchantPhoneNumber",
      ] as const) {
        expect(prose, `the imprint does not state {${token}}`).toContain(`{${token}}`);
      }
    });

    /**
     * Regulation 524/2013 was repealed by Regulation (EU) 2024/3228 and the ODR
     * platform was dismantled in July 2025. The second read flagged its absence
     * as *correct*, and as exactly the thing a checklist reviewer would wrongly
     * "fix". This is that flag, mechanised.
     */
    it("offer no link to the dismantled ODR platform", () => {
      const corpus = edition.flatMap((page) => legalProseIn(page)).join("\n").toLowerCase();
      for (const phrase of ODR_PLATFORM_PHRASES) {
        expect(corpus, `${phrase} names a platform that no longer exists`).not.toContain(phrase);
      }
    });

    it("keeps the consent obligations on the privacy page", () => {
      const privacyPage = edition.find((page) => page.route === "legalPrivacy");
      expect(privacyPage?.covers).toContain("analytics-lawful-basis");
      expect(privacyPage?.covers).toContain("third-party-processors");
    });

    it("are not marked approved while the merchant's details are still placeholders", () => {
      for (const page of edition) {
        const unresolved = legalProseIn(page).flatMap((paragraph) =>
          unresolvedPlaceholdersIn(paragraph),
        );

        if (unresolved.length > 0) {
          expect(
            page.reviewStatus,
            `${page.route} still needs ${unresolved.join(", ")}`,
          ).toBe("draft-pending-operator-input");
        }
      }
    });

    /**
     * A table with a short row does not throw: it renders as a grid with a hole
     * in it, under whichever column heading the browser happens to line the cell
     * up with. That is a disclosure saying the wrong thing rather than a crash,
     * and it is invisible to a test that only asks whether the words are on the
     * page — which is exactly what the render assertions in
     * `storefront/tests/legal-pages.test.tsx` do.
     */
    it("give every table row exactly one cell per column", () => {
      const tables = edition.flatMap((page) =>
        page.body.flatMap((section) =>
          section.table === undefined ? [] : [{ page: page.route, section, table: section.table }],
        ),
      );

      expect(tables.length, "no legal page carries a table any more").toBeGreaterThan(0);

      for (const { page, section, table } of tables) {
        expect(table.columns.length, `${page}#${section.anchor} has fewer than three columns — use items`).toBeGreaterThan(2);
        expect(table.caption.length, `${page}#${section.anchor}'s table has no caption`).toBeGreaterThan(3);
        for (const [index, row] of table.rows.entries()) {
          expect(
            row.length,
            `${page}#${section.anchor} row ${String(index)} has ${String(row.length)} cells for ${String(table.columns.length)} columns`,
          ).toBe(table.columns.length);
        }
      }
    });

    /**
     * The operator supplied the cookie table on 2026-08-10, and two properties of
     * it are the answer rather than the phrasing: the durations are **hedged**
     * rather than asserted about other companies' products, and the consent
     * status of each cookie is stated rather than left to be inferred from the
     * section around it. An agent had previously asserted both.
     */
    it("hedge every cookie duration and state every cookie's consent status", () => {
      const language = COOKIE_TABLE_LANGUAGE[locale];
      const privacyPage = edition.find((page) => page.route === "legalPrivacy");
      const table = privacyPage?.body.find((section) => section.anchor === "consent")?.table;

      expect(table, "the cookie table is gone from the privacy page").toBeDefined();
      expect(table?.columns).toEqual(language.columns);

      const durations = (table?.rows ?? []).map((row) => row[row.length - 1] ?? "");
      expect(durations.length).toBeGreaterThan(0);
      for (const duration of durations) {
        expect(
          language.hedgedDuration.test(duration),
          `"${duration}" asserts a third party's cookie lifetime rather than hedging it`,
        ).toBe(true);
      }

      const notes = (table?.notes ?? []).join(" ");
      for (const statement of language.consentStatements) {
        expect(notes).toContain(statement);
      }
    });

    /**
     * The price a legal page presents is `{price}` in every language — a
     * figure written into a translation goes stale exactly as silently as
     * one written into the original, and `{priceLine}` is excluded for the
     * reason Minor 2 recorded: it resolves to the unqualified claim the
     * callout already states conditionally.
     */
    it("quote the price only as the {price} placeholder in the VAT section", () => {
      const shippingPage = edition.find((page) => page.route === "legalShipping");
      const vat = shippingPage?.body.find((section) =>
        section.covers.includes("vat-presentation"),
      );
      const strings = [
        vat?.callout?.lead ?? "",
        vat?.callout?.detail ?? "",
        ...(vat?.body ?? []),
      ].join("\n");

      expect(strings, "the VAT section is gone").not.toBe("\n");
      expect(strings).toContain("{price}");
      expect(strings).not.toContain("{priceLine}");
    });

    /**
     * The statutory deadline, as a figure, in the section that discharges
     * `withdrawal-deadline`. A translation that mislays the 14 is not a copy
     * defect but a misstatement of the consumer's rights in the language
     * they will rely on — and a figure survives translation verbatim, so it
     * is the one part of the sentence a language-blind test can hold.
     */
    it("state the 14-day withdrawal period in figures", () => {
      const returnsPage = edition.find((page) => page.route === "legalReturns");
      const section = returnsPage?.body.find((candidate) =>
        candidate.covers.includes("withdrawal-deadline"),
      );
      expect(section, "no section discharges withdrawal-deadline").toBeDefined();
      expect((section?.body ?? []).join(" ")).toContain("14");
    });

    it("declare every section they say they contain", () => {
      for (const page of edition) {
        const anchors = page.body.map((section) => section.anchor);
        for (const anchor of page.sections) {
          expect(anchors, `${page.route} is missing section ${anchor}`).toContain(anchor);
        }
      }
    });
  });
}

/**
 * Edition parity: a translated legal page carries the default edition's exact
 * structure, and the default edition carries the translation's.
 *
 * The `et/` file headers state as fact that anchors, `covers`, sources and
 * every placeholder token are identical to the English pages. That was true
 * and asserted by nobody: the review of this unit demonstrated that deleting
 * a line of the Annex I(B) model withdrawal form — from **either** edition —
 * left all 1798 tests green. Translation loss is a defect class that only
 * exists once a second edition does, and it is exactly the thing a
 * structural comparison catches mechanically: prose is the translator's, but
 * the skeleton under it is the law's.
 *
 * Compared per page against the default edition: section anchors in order,
 * per-section `covers`, `source`, link targets, paragraph count, each
 * paragraph's placeholder-token multiset, callout presence and its tokens,
 * item count, and the table's exact shape. Deliberately *not* compared:
 * titles, headings, prose and `reviewStatus` — the first three are the
 * translation, and approval is a per-edition operator act.
 */
describe("edition parity", () => {
  const tokensIn = (text: string): readonly string[] => placeholderTokensIn(text).toSorted();

  function skeletonOf(page: (typeof legalPages)[number]) {
    return {
      route: page.route,
      indexable: page.indexable,
      sections: [...page.sections],
      covers: [...page.covers].toSorted(),
      body: page.body.map((section) => ({
        anchor: section.anchor,
        covers: [...section.covers].toSorted(),
        source: section.source ?? null,
        paragraphs: section.body.length,
        paragraphTokens: section.body.map(tokensIn),
        callout:
          section.callout === undefined
            ? null
            : { lead: tokensIn(section.callout.lead), detail: tokensIn(section.callout.detail) },
        items: (section.items ?? []).length,
        table:
          section.table === undefined
            ? null
            : {
                columns: section.table.columns.length,
                rows: section.table.rows.map((row) => row.length),
                notes: (section.table.notes ?? []).length,
              },
        links: (section.links ?? []).map((link) => link.target),
      })),
    };
  }

  const reference = contentFor(legalPagesByLocale, DEFAULT_LOCALE);

  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;

    it(`${locale} publishes exactly the default edition's legal routes, in its order`, () => {
      expect(contentFor(legalPagesByLocale, locale).map((page) => page.route)).toEqual(
        reference.map((page) => page.route),
      );
    });

    for (const referencePage of reference) {
      it(`${locale}:${referencePage.route} mirrors the default edition's structure exactly`, () => {
        const counterpart = contentFor(legalPagesByLocale, locale).find(
          (page) => page.route === referencePage.route,
        );
        expect(counterpart, `${locale} does not carry ${referencePage.route}`).toBeDefined();
        expect(
          skeletonOf(counterpart!),
          "a structural difference between editions is either content lost in translation " +
            "or content lost from the source — both are a legally required disclosure " +
            "existing in one language and not the other",
        ).toEqual(skeletonOf(referencePage));
      });
    }
  }
});

describe("the page registry", () => {
  /*
   * "Declared" now means declared and not retired. A retired route keeps its
   * path so links and bookmarks resolve, and publishes no page because it
   * answers a redirect — so requiring a page for it would require the page
   * the retirement exists to remove. The pairing is still exhaustive in both
   * directions; the retired set is simply subtracted from one side, and
   * asserted non-empty so this does not quietly become a no-op if the set is
   * ever emptied.
   */
  it("has exactly one page per declared route that is not retired", () => {
    const routes = pages.map((page) => page.route).toSorted();
    const declared = Object.keys(ROUTE_PATHS)
      .filter((route) => !Object.hasOwn(RETIRED_ROUTES, route))
      .toSorted();
    expect(routes).toEqual(declared);
  });

  it("publishes no page for a retired route, in any edition", () => {
    expect(Object.keys(RETIRED_ROUTES).length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      for (const page of contentFor(pagesByLocale, locale)) {
        expect(
          Object.hasOwn(RETIRED_ROUTES, page.route),
          `${locale} publishes ${page.route}, which is retired`,
        ).toBe(false);
      }
    }
  });

  /*
   * The two properties that make a redirect chain unrepresentable. The plan
   * forbids emitting a chain or a loop; this is where that becomes structural
   * rather than a thing the proxy has to be careful about.
   */
  it("lets no retired route name itself or another retired route", () => {
    for (const [retired, target] of Object.entries(RETIRED_ROUTES)) {
      expect(target, `${retired} redirects to itself`).not.toBe(retired);
      expect(
        Object.hasOwn(RETIRED_ROUTES, target),
        `${retired} redirects to ${target}, which is itself retired -- that is a chain`,
      ).toBe(false);
    }
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

/**
 * The locale dimension.
 *
 * Everything here is written over `LOCALES` rather than over the literal
 * `"en"`, so it states what a published edition must be rather than what
 * today's single edition happens to be — with one deliberate exception, the
 * count, which is pinned because a second locale arriving without a decision
 * is a failure rather than progress.
 */
describe("the locale dimension", () => {
  /**
   * Still pinned, now at two. A locale appearing — or disappearing — without
   * anybody deciding it is a failure, not progress. `et` is the operator's
   * decision of 2026-08-09: the legal set translated for the Estonian
   * consumer, after the second qualified legal read found consumer-facing
   * terms in English only.
   */
  it("has exactly the two decided locales, and the default is the English one", () => {
    expect([...LOCALES]).toEqual(["en", "et"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("names no locale twice, and knows its own members", () => {
    expect(new Set(LOCALES).size).toBe(LOCALES.length);
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    expect(isLocale("not-a-locale")).toBe(false);
  });

  it("defines every locale it declares, and declares every locale it defines", () => {
    expect(Object.keys(LOCALE_DEFINITIONS).toSorted()).toEqual([...LOCALES].toSorted());
  });

  it("includes the default locale in the declared set", () => {
    expect((LOCALES as readonly string[]).includes(DEFAULT_LOCALE)).toBe(true);
  });

  /**
   * The unprefixed URLs are a single, scarce resource: two editions sharing
   * them would be two pages competing for one canonical, which is the exact
   * failure a locale dimension exists to prevent. Exactly one edition holds
   * them, and it is the one everything else calls the default.
   */
  it("gives the unprefixed paths to exactly one locale, the default one", () => {
    const unprefixed = LOCALES.filter(
      (locale) => LOCALE_DEFINITIONS[locale].pathPrefix === "",
    );
    expect(unprefixed).toEqual([DEFAULT_LOCALE]);
  });

  it("gives every other locale a distinct single-segment lowercase prefix", () => {
    const prefixes = LOCALES.map((locale) => LOCALE_DEFINITIONS[locale].pathPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);

    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      const { pathPrefix } = LOCALE_DEFINITIONS[locale];
      expect(pathPrefix, `${locale} has no path prefix`).toMatch(/^\/[a-z0-9-]+$/);
    }
  });

  it("gives every locale a distinct, non-empty language tag", () => {
    const tags = LOCALES.map((locale) => LOCALE_DEFINITIONS[locale].languageTag);
    expect(new Set(tags).size).toBe(tags.length);
    for (const tag of tags) expect(tag).toMatch(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/);
  });

  /**
   * The registration surface, enumerated.
   *
   * `Record<Locale, T>` is total, so these cannot fail while the code
   * compiles — and they are asserted anyway, because `Object.keys` is what a
   * reader of this file can check against `LOCALES`, and because a registry
   * built with a spread or a cast would compile and be wrong.
   */
  it("registers every locale in every locale-keyed registry", () => {
    for (const [name, registry] of [
      ["pagesByLocale", pagesByLocale],
      ["legalPagesByLocale", legalPagesByLocale],
    ] as const) {
      expect(Object.keys(registry).toSorted(), name).toEqual([...LOCALES].toSorted());
    }
  });

  it("returns the registered entry for a locale", () => {
    for (const locale of LOCALES) {
      expect(contentFor(pagesByLocale, locale)).toBe(pagesByLocale[locale]);
    }
    expect(contentFor(legalPagesByLocale, DEFAULT_LOCALE)).toBe(legalPages);
  });

  /**
   * The default edition is the one served at the bare paths, so a route it
   * does not publish has no URL without a prefix — which would be a route
   * this site declares and cannot serve.
   */
  it("publishes every declared route in the default edition, retirements aside", () => {
    const routes = contentFor(pagesByLocale, DEFAULT_LOCALE)
      .map((page) => page.route)
      .toSorted();
    expect(routes).toEqual(
      Object.keys(ROUTE_PATHS)
        .filter((route) => !Object.hasOwn(RETIRED_ROUTES, route))
        .toSorted(),
    );
  });

  for (const locale of LOCALES) {
    describe(`the ${locale} edition`, () => {
      const edition = contentFor(pagesByLocale, locale);

      it("publishes only declared routes, each at most once", () => {
        const routes = edition.map((page) => page.route);
        expect(new Set(routes).size).toBe(routes.length);
        for (const route of routes) {
          expect(Object.hasOwn(ROUTE_PATHS, route), `${route} is not a declared route`).toBe(true);
        }
      });

      /**
       * Uniqueness is a property *within* an edition. Two editions may
       * legitimately share a title — an untranslated proper noun, a brand —
       * and asserting across the whole registry would forbid that while
       * catching nothing a crawler cares about.
       */
      it("gives every page a unique title and a unique description", () => {
        const titles = edition.map((page) => page.title);
        const descriptions = edition.map((page) => page.description);
        expect(new Set(titles).size).toBe(titles.length);
        expect(new Set(descriptions).size).toBe(descriptions.length);
      });

      it("keeps the basket and the checkout out of the index wherever it publishes them", () => {
        for (const route of ["cart", "checkout"] as const) {
          const page = edition.find((candidate) => candidate.route === route);
          if (page === undefined) continue;
          expect(page.indexable).toBe(false);
        }
      });

      it("has at most one canonical product page", () => {
        expect(edition.filter((page) => page.route === "lunarBase").length).toBeLessThanOrEqual(1);
      });

      /**
       * A legal page that exists in an edition but is not in that edition's
       * page registry has no title, no description, no canonical and no
       * sitemap entry — it is content nothing can serve. The reverse (a
       * registered legal route with no page behind it) is the render-time
       * 404 that `storefront/tests/locale-routing.test.ts` covers.
       */
      it("registers every legal page it carries in its own page registry", () => {
        const registered = new Set(edition.map((page) => page.route));
        for (const page of contentFor(legalPagesByLocale, locale)) {
          expect(
            registered.has(page.route),
            `${locale} carries ${page.route} but does not publish it`,
          ).toBe(true);
        }
      });
    });
  }
});
