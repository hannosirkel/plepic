import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getRuntimeConfig } from "../src/config/runtime-config.js";
import { RUNTIME_ENV_VARS } from "../src/config/runtime-env.js";
import {
  CLIENT_RUNTIME_CONFIG_KEYS,
  toClientRuntimeConfig,
} from "../src/lib/client-runtime-config.js";
import { buildContentSecurityPolicy } from "../src/lib/csp.js";

describe("getRuntimeConfig", () => {
  it("has null runtime integration values when unconfigured, never a literal", () => {
    const config = getRuntimeConfig({});
    expect(config.analytics.measurementId).toBeNull();
    expect(config.turnstile.siteKey).toBeNull();
    expect(config.medusa).toEqual({ backendUrl: null, publishableKey: null });
    expect(config.stripe).toEqual({ publishableKey: null });

    /*
     * Every one of the seven, not just the contact address. A merchant field
     * that defaulted to a literal would put a fabricated trader identity on
     * the imprint of every unconfigured deployment, which is worse than the
     * gap it would be hiding.
     */
    expect(Object.values(config.merchant)).toEqual([null, null, null, null, null, null, null]);

    /*
     * And the one external destination a legal obligation depends on. A
     * fabricated default here would be worse than the gap it hides: the page
     * would offer a consumer a way to reach a dispute-resolution body that
     * goes somewhere nobody chose.
     */
    expect(config.externalTargets["consumer-disputes-committee"]).toBeNull();

    /*
     * And the four destinations the site's own copy links to. A default here
     * would be a guess at somebody's social profile; `null` renders the label
     * as inert text, which is what an unconfigured deployment should show.
     */
    expect(config.externalTargets["kickstarter-campaign"]).toBeNull();
    expect(config.externalTargets.instagram).toBeNull();
    expect(config.externalTargets.facebook).toBeNull();
    expect(config.externalTargets["origin-story"]).toBeNull();
  });

  it("reads every field from the environment given to it, not from process.env of the test runner", () => {
    const config = getRuntimeConfig({
      SITE_BASE_URL: "https://canonical.example.net",
      SITE_CANONICAL_HOST: "canonical.example.net",
      ANALYTICS_MEASUREMENT_ID: "G-EXAMPLE1",
      TURNSTILE_SITE_KEY: "0x0000000000000000000AA",
      MEDUSA_BACKEND_URL: "http://plepic-backend:8102",
      MEDUSA_PUBLISHABLE_API_KEY: "pk_example_runtime",
      STRIPE_PUBLISHABLE_KEY: "pk_test_example_runtime",
      MERCHANT_CONTACT_ADDRESS: "hello@canonical.example.net",
      MERCHANT_LEGAL_NAME: "Example Trader OU",
      MERCHANT_PHONE_NUMBER: "+000 00 000000",
      MERCHANT_REGISTERED_ADDRESS: "1 Example Street, Example Town",
      MERCHANT_REGISTRATION_NUMBER: "EXAMPLE-12345678",
      MERCHANT_RETURN_ADDRESS: "2 Example Street, Example Town",
      MERCHANT_VAT_NUMBER: "EXAMPLE-VAT-1",
      EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE: "https://disputes.example.org/committee",
      EXTERNAL_URL_KICKSTARTER_CAMPAIGN: "https://campaign.example.org/lunar-base",
      EXTERNAL_URL_INSTAGRAM: "https://social.example.org/instagram",
      EXTERNAL_URL_FACEBOOK: "https://social.example.org/facebook",
      EXTERNAL_URL_ORIGIN_STORY: "https://stories.example.org/origin",
    });

    expect(config).toEqual({
      baseUrl: "https://canonical.example.net",
      canonicalHost: "canonical.example.net",
      analytics: { measurementId: "G-EXAMPLE1" },
      turnstile: { siteKey: "0x0000000000000000000AA" },
      medusa: {
        backendUrl: "http://plepic-backend:8102",
        publishableKey: "pk_example_runtime",
      },
      stripe: { publishableKey: "pk_test_example_runtime" },
      merchant: {
        legalName: "Example Trader OU",
        registeredAddress: "1 Example Street, Example Town",
        registrationNumber: "EXAMPLE-12345678",
        vatNumber: "EXAMPLE-VAT-1",
        contactAddress: "hello@canonical.example.net",
        phoneNumber: "+000 00 000000",
        returnAddress: "2 Example Street, Example Town",
      },
      externalTargets: {
        "consumer-disputes-committee": "https://disputes.example.org/committee",
        "kickstarter-campaign": "https://campaign.example.org/lunar-base",
        instagram: "https://social.example.org/instagram",
        facebook: "https://social.example.org/facebook",
        "origin-story": "https://stories.example.org/origin",
      },
    });
  });

  it("two calls with different environments never share a value — nothing is memoised at module scope", () => {
    const first = getRuntimeConfig({ ANALYTICS_MEASUREMENT_ID: "G-FIRST" });
    const second = getRuntimeConfig({ ANALYTICS_MEASUREMENT_ID: "G-SECOND" });
    expect(first.analytics.measurementId).toBe("G-FIRST");
    expect(second.analytics.measurementId).toBe("G-SECOND");
  });

  it("selects either environment's authoritative backend Service target from the same source", () => {
    const live = getRuntimeConfig({ MEDUSA_BACKEND_URL: "http://plepic-backend:8102" });
    const test = getRuntimeConfig({ MEDUSA_BACKEND_URL: "http://plepic-backend-test:8112" });

    expect(live.medusa.backendUrl).toBe("http://plepic-backend:8102");
    expect(test.medusa.backendUrl).toBe("http://plepic-backend-test:8112");
  });
});

/**
 * `src/app/layout.tsx` serializes this object into the HTML of **every**
 * route. It used to build it by spreading `RuntimeConfig` wholesale, so every
 * field the configuration object had — and every field it would ever gain —
 * was published to the browser on `/cart`, `/checkout` and every legal page by
 * default. `merchant.contactAddress` was already in it, and nothing
 * client-side read it: `curl https://<canonical-host>/checkout | grep @`
 * returned the merchant's address from a page that never quotes it.
 *
 * The address is a public business address that must appear on the Imprint by
 * law, so that was not a leak. The **default** was the defect, and
 * `RuntimeConfig` is exactly where Task 5's Stripe and Medusa configuration
 * lands. So the assertion is the key set, not one omitted field: a field added
 * to `RuntimeConfig` reaches the browser only when somebody adds it here too.
 */
describe("only a named subset of the runtime config is published to the browser", () => {
  const config = getRuntimeConfig({
    SITE_BASE_URL: "https://canonical.example.net",
    SITE_CANONICAL_HOST: "canonical.example.net",
    ANALYTICS_MEASUREMENT_ID: "G-EXAMPLE1",
    TURNSTILE_SITE_KEY: "0x0000000000000000000AA",
    MEDUSA_BACKEND_URL: "http://plepic-backend:8102",
    MEDUSA_PUBLISHABLE_API_KEY: "pk_example_runtime",
    STRIPE_PUBLISHABLE_KEY: "pk_test_example_runtime",
    MERCHANT_CONTACT_ADDRESS: "hello@canonical.example.net",
  });
  const client = toClientRuntimeConfig(config, true);

  it("publishes exactly the declared key set and nothing else", () => {
    expect(Object.keys(client).sort()).toEqual([...CLIENT_RUNTIME_CONFIG_KEYS].sort());
  });

  it("carries no merchant contact address, in any nesting, anywhere in the blob", () => {
    expect(JSON.stringify(client)).not.toContain("hello@canonical.example.net");
    expect(JSON.stringify(client)).not.toContain("merchant");
  });

  it("still carries every value a browser genuinely needs", () => {
    expect(client).toEqual({
      baseUrl: "https://canonical.example.net",
      canonicalHost: "canonical.example.net",
      analytics: { measurementId: "G-EXAMPLE1" },
      turnstile: { siteKey: "0x0000000000000000000AA" },
      medusa: { basePath: "/store-api", publishableKey: "pk_example_runtime" },
      stripe: { publishableKey: "pk_test_example_runtime" },
      isTestHost: true,
    });
  });

  it("is a projection and not a spread — a new configuration field is not published by default", () => {
    const widened = { ...config, futureSecret: "must-not-be-published" };
    expect(JSON.stringify(toClientRuntimeConfig(widened, false))).not.toContain("must-not-be-published");
  });
});

describe("Stripe browser boundary", () => {
  it("permits only Stripe's script, frame, and API origins needed by Elements", () => {
    const csp = buildContentSecurityPolicy("nonce-example");
    const directives = new Map(
      csp.split("; ").map((directive) => {
        const [name, ...sources] = directive.split(" ");
        return [name, sources];
      }),
    );

    expect(directives.get("script-src")).toContain("https://js.stripe.com");
    expect(directives.get("frame-src")).toEqual(
      expect.arrayContaining(["https://js.stripe.com", "https://hooks.stripe.com"]),
    );
    expect(directives.get("connect-src")).toContain("https://api.stripe.com");

    // The wildcard is a separate requirement from the bare host, and asserting
    // the bare host does not cover it: a CSP host-source matches one exact
    // host and never its subdomains. Stripe's security guide requires
    // `https://*.js.stripe.com` in both directives because Stripe.js opens
    // frames on different origins under that suffix, which is how Link renders
    // inside the Payment Element. Without it those frames are refused while
    // card -- served from the bare host -- keeps working, so the symptom is a
    // payment method quietly missing rather than anything that looks like a
    // policy error.
    expect(directives.get("script-src")).toContain("https://*.js.stripe.com");
    expect(directives.get("frame-src")).toContain("https://*.js.stripe.com");
    expect(directives.get("form-action")).toEqual(["'self'"]);
  });
});

/**
 * The catalogue used to live here, as `CATALOGUE_MOCK_PRICE_AMOUNT`,
 * `_PRICE_CURRENCY`, `_AVAILABILITY` and `_PRODUCT_NAME`, feeding the product
 * page's `Product`/`Offer` structured data while the visible page read
 * `storefront/mock/catalogue.json`. Two sources for one fact, and they
 * disagreed in practice — one page served `"price":"29.00"`,
 * `"priceCurrency":"USD"` and `"availability":"OutOfStock"` to a crawler
 * beside "€25.00 / In stock" for a person, with nothing failing.
 *
 * The old tests here proved the *configuration* layer never defaulted a
 * price. That property is now structural rather than tested: there is no
 * configuration layer for the price at all, and no environment variable that
 * can move it away from the committed, reviewed catalogue.
 * `tests/product-jsonld.test.ts` imports the JSON-LD builder and the page's
 * own catalogue and asserts they agree.
 */
describe("no environment variable can change what price this site publishes", () => {
  it("declares no catalogue variable at all", () => {
    expect(RUNTIME_ENV_VARS.filter((name) => name.startsWith("CATALOGUE_"))).toEqual([]);
  });

  it("publishes the same configuration whether or not the retired variables are set", () => {
    const retired = {
      CATALOGUE_MOCK_PRICE_AMOUNT: "2900",
      CATALOGUE_MOCK_PRICE_CURRENCY: "USD",
      CATALOGUE_MOCK_AVAILABILITY: "OutOfStock",
      CATALOGUE_MOCK_PRODUCT_NAME: "Lunar Base Deluxe",
    };
    expect(getRuntimeConfig(retired)).toEqual(getRuntimeConfig({}));
  });

  it("carries no price, currency, availability or product name in the serialized runtime config", () => {
    const serialized = JSON.stringify(getRuntimeConfig({}));
    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("Currency");
    expect(serialized).not.toContain("availability");
    expect(serialized).not.toContain("Lunar Base");
  });
});

/**
 * The anti-drift half of the build-time canary set.
 *
 * `tests/build-and-serve.test.ts` asserts every name in `RUNTIME_ENV_VARS`
 * has a canary in its build. That is only worth anything if `RUNTIME_ENV_VARS`
 * is itself complete, which this asserts by scanning for every literal handed
 * to a reader in `src/config/env.ts`. Between them, a variable added anywhere
 * under `src/` — Task 5's Stripe and Medusa publishable keys being the case
 * the plan explicitly warns about — cannot reach an image without a test
 * proving it is not baked into one.
 */
describe("RUNTIME_ENV_VARS is the complete set of variables src/ reads", () => {
  const srcDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "src");

  function listSourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...listSourceFiles(path));
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
    }
    return files;
  }

  const READER_CALL = /\b(?:readEnv|optionalEnv|readEnvList)\(\s*"([A-Z0-9_]+)"/g;

  const files = listSourceFiles(srcDir);
  const found = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(READER_CALL)) {
      if (match[1] !== undefined) found.add(match[1]);
    }
  }

  it("scanned the source tree and found reads to check", () => {
    expect(files.length).toBeGreaterThan(15);
    expect(found.size).toBeGreaterThan(5);
  });

  it("declares every variable src/ actually reads", () => {
    const declared: readonly string[] = RUNTIME_ENV_VARS;
    const undeclared = [...found].filter((name) => !declared.includes(name)).toSorted();
    expect(
      undeclared,
      "add these to src/config/runtime-env.ts, then give each one a canary in build-and-serve.test.ts",
    ).toEqual([]);
  });

  it("declares nothing src/ does not read", () => {
    const unread = RUNTIME_ENV_VARS.filter((name) => !found.has(name)).toSorted();
    expect(unread, "these are listed in runtime-env.ts but nothing reads them").toEqual([]);
  });

  it("reads no environment variable outside config/, so the scan above is exhaustive", () => {
    // Comments stripped: several modules explain in prose that they never
    // touch `process.env`, which is the opposite of an offence.
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    const configDir = join("src", "config");
    const offenders = files.filter(
      (file) => !file.includes(configDir) && /process\.env/.test(stripComments(readFileSync(file, "utf8"))),
    );

    expect(
      offenders.map((file) => file.replace(`${srcDir}/`, "")),
      "read configuration through src/config so RUNTIME_ENV_VARS stays the complete list",
    ).toEqual([]);
  });
});

/**
 * What the records say an unset `EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE`
 * does, checked against what it does.
 *
 * The behaviour is asserted in `tests/legal-pages.test.tsx`, both states, and
 * has been right since the ruling landed: an unset address renders one link
 * fewer, no gap marker and no incompleteness notice. **Three doc comments went
 * on describing the mechanism that was deleted**, and one of them sat in the
 * operator-facing "Open inputs" table in `content/content-document.md`, where
 * it told an operator that `/legal/terms` announces itself incomplete until the
 * address is supplied. A correct implementation and a false record of it is
 * still a defect: the record is what an operator acts on, and acting on this
 * one means holding approval for an input that was ruled optional.
 *
 * A green rendering suite could not catch that, because nothing in it reads
 * prose. This does. It fails on the specific false claim, in the specific files
 * that carried it, rather than policing how the variable is described in
 * general.
 *
 * ## A fourth record, and what it changed about this guard's reach
 *
 * The first version of this guard covered three files and keyed on the name of
 * the address. Review then found a **fourth** copy of the same false claim, in
 * the `externalTargets` prop doc comment of
 * `src/components/pages/LegalPageContent.tsx` — *"Absent is the same as
 * unconfigured, which for a required target is a named gap rather than a
 * dropped link"* — in a file whose own main doc comment, two paragraphs above,
 * already stated the correct rule. The module contradicted itself.
 *
 * That is evidence about the guard rather than just another line to fix, and it
 * says two things:
 *
 * 1. **The file list was too short**, so the fourth file is in `RECORDS`.
 * 2. **More importantly, the claim does not need the address to be made.** The
 *    three original records named the variable or its target id; this one said
 *    *"a required target"* and named nothing, which is why a selector keyed on
 *    the address could never have reached it however many files it covered. The
 *    selector now also matches passages about external targets generally, which
 *    is the actual class the false claim belongs to.
 *
 * The blocklist stays exact phrases rather than becoming a pattern that hunts
 * paraphrase — that decision is argued at the assertion itself, and a seventh
 * unrelated wording would still escape it. The positive check below is the
 * counterweight, and is why "say nothing at all" is not a way to pass.
 */
describe("no record claims an unconfigured external target gates page completeness", () => {
  const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

  const RECORDS = [
    join("storefront", "src", "config", "runtime-env.ts"),
    join("storefront", "src", "config", "runtime-config.ts"),
    join("content", "content-document.md"),
    join("storefront", "src", "components", "pages", "LegalPageContent.tsx"),
  ] as const;

  /**
   * The paragraphs, table rows and list items that discuss the address — or
   * external destinations as a class, since the fourth record made the claim
   * without naming anything.
   *
   * A `.tsx` block comment has no blank line in it (its separator lines carry a
   * `*`), so a doc comment arrives here as one passage rather than several.
   * That costs precision in the failure message and nothing in correctness: the
   * claims below are exact strings, and a wider passage cannot manufacture one.
   */
  function passagesAboutExternalTargets(record: string): readonly string[] {
    return readFileSync(join(repoRoot, record), "utf8")
      .split(/\n\s*\n|\n(?=\|)/)
      .filter((block) =>
        /EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE|consumer-disputes-committee|Consumer Disputes Committee|external target|externalTargets|ExternalTargetUrls/.test(
          block,
        ),
      );
  }

  it("found the passages to check in every record", () => {
    for (const record of RECORDS) {
      expect(
        passagesAboutExternalTargets(record).length,
        `${record} no longer discusses external destinations, so this guard is inert for it`,
      ).toBeGreaterThan(0);
    }
  });

  it("says nowhere that an unset destination produces a gap or the incompleteness notice", () => {
    /*
     * Exact phrases, not paraphrase-catching patterns, and deliberately so.
     * The first draft of this guard matched "page shows … incompleteness
     * notice" within sixty characters, which is true of the sentence that
     * asserts the notice and equally true of the sentence that denies it — and
     * it duly failed on the corrected prose. A pattern that cannot tell a claim
     * from its negation is not a weaker guard, it is a wrong one.
     *
     * These six are the wordings the four records actually carried, verbatim
     * from the revisions this unit corrects. Restoring any of them — which is
     * what reverting the fix does — turns this red.
     */
    const FALSE_CLAIMS: readonly string[] = [
      "a named gap and the incompleteness notice",
      "Absent is not optional here either",
      "treated like an unset registration number",
      "the page names the gap and shows the incompleteness notice",
      "the same treatment as an unset registration number",
      "for a required target is a named gap",
    ];

    for (const record of RECORDS) {
      for (const passage of passagesAboutExternalTargets(record)) {
        for (const claim of FALSE_CLAIMS) {
          expect(
            passage.toLowerCase().includes(claim.toLowerCase()),
            `${record} says "${claim}" of an external destination. The operator ruled on ` +
              "2026-08-10 that naming the forum without an access method satisfies Article " +
              "6(1)(t) CRD, and the enforcing mechanism was deleted: an unset destination " +
              `renders one link fewer and nothing else. Passage:\n${passage.trim()}`,
          ).toBe(false);
        }
      }
    }
  });

  it("states the true claim, so the check above is not merely an absence", () => {
    /*
     * A blocklist alone passes on a record that says nothing at all, and
     * "nothing at all" is how the false claim got read as authoritative in the
     * first place — the correction lived only in a pull request body. Each
     * record has to say, in its own words, that the absence is tolerated.
     */
    const SAYS_IT_IS_OPTIONAL =
      /no (?:gap marker|incompleteness notice)|not(?:hing)? (?:gate|change)|does not gate|enhancement, not|an enhancement/i;

    for (const record of RECORDS) {
      const passages = passagesAboutExternalTargets(record).join("\n");
      expect(
        SAYS_IT_IS_OPTIONAL.test(passages),
        `${record} no longer states that an unset external destination leaves the page ` +
          "complete. Silence is what let the deleted mechanism be believed in for two units, " +
          "and is what let a fourth copy of the claim sit two paragraphs below the correct rule.",
      ).toBe(true);
    }
  });
});
