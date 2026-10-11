import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../src");

function styles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? styles(path) : path.endsWith(".css") ? [path] : [];
  });
}

export function caseViolations(path: string, css: string): string[] {
  const clean = css.replaceAll(/\/\*[\s\S]*?\*\//g, " ");
  const violations: string[] = [];
  const rules = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const guards = rules.filter(([, selector, body]) =>
    selector?.trim() === ":lang(tlh)" && /(?:^|;)\s*text-transform\s*:\s*none\s*!important\s*(?:;|$)/i.test(body ?? ""),
  );
  if (path === "styles/global.css" && guards.length !== 1) violations.push("missing :lang(tlh) case guard");
  for (const [, selector = "", body = ""] of rules) {
    if (!/text-transform\s*:/i.test(body)) continue;
    if (/::[a-z-]+/i.test(selector)) violations.push(`${selector.trim()} transforms a pseudo-element`);
    if (/text-transform\s*:[^;{}]*!important/i.test(body) && selector.trim() !== ":lang(tlh)") {
      violations.push(`${selector.trim()} overrides the Klingon guard`);
    }
  }
  return violations;
}

describe("Klingon spelling retains letter case", () => {
  it("rejects missing, important and pseudo-element mutations", () => {
    expect(caseViolations("styles/global.css", "body { color: black; }")).toContain("missing :lang(tlh) case guard");
    expect(caseViolations("styles/extra.css", ".title { text-transform: uppercase !important; }")).toHaveLength(1);
    expect(caseViolations("styles/extra.css", ".title::first-letter { text-transform: uppercase; }")).toHaveLength(1);
  });

  it("guards all descendants against stylesheet case changes", () => {
    for (const path of styles(root)) {
      const name = relative(root, path);
      expect(caseViolations(name, readFileSync(path, "utf8")), name).toEqual([]);
    }
  });
});
