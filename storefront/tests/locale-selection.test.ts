import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(import.meta.dirname, "../src");
const localeReaders = new Set([
  "lib/urls.ts",
  "app/localized-routes.tsx",
  "app/[locale]/layout.tsx",
  "components/forms/form-locale.tsx",
]);
// No request-derived language or location reads are approved today.
const negotiatedReaders = new Set<string>();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

function executableSource(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, " ");
}

export function forbiddenReads(source: string): string[] {
  const code = executableSource(source);
  const headers = /(?:accept-language|x-forwarded-for|x-real-ip|cf-ipcountry|cf-connecting-ip)/gi;
  const findings: string[] = [];
  for (const match of code.matchAll(headers)) {
    const context = code.slice(Math.max(0, match.index - 100), match.index + match[0].length + 30);
    if (/(?:headers?\s*(?:\.|\[)|\.get\s*\(|\.has\s*\(|\.geo\b)/i.test(context)) findings.push(match[0]);
  }
  if (/\b(?:request|req|nextRequest)\s*(?:\?\.|\.)\s*geo\b/i.test(code)) findings.push("request.geo");
  return findings;
}

describe("the URL alone chooses the edition", () => {
  it("has no request language, address or geolocation readers", () => {
    for (const path of sourceFiles(sourceRoot)) {
      const name = relative(sourceRoot, path);
      if (negotiatedReaders.has(name)) continue;
      expect(forbiddenReads(readFileSync(path, "utf8")), name).toEqual([]);
    }
  });

  it("reports a newly introduced language-header read", () => {
    expect(forbiddenReads('request.headers.get("accept-language")')).toEqual(["accept-language"]);
  });

  it("keeps edition validation at the named routing and form boundaries", () => {
    for (const path of sourceFiles(sourceRoot)) {
      const name = relative(sourceRoot, path);
      if (localeReaders.has(name)) continue;
      const code = executableSource(readFileSync(path, "utf8"));
      expect(code.match(/\b(?:isLocale|localeForPathSegment)\s*\(/g) ?? [], name).toEqual([]);
    }
  });
});
