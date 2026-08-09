/**
 * The static half of "read every per-environment value at runtime, never at
 * build time": nothing under `src/` (or `next.config.ts`) may reference
 * `NEXT_PUBLIC_*`, because Next.js inlines that prefix into the client
 * bundle at build time regardless of how carefully the read is written.
 *
 * `tests/build-and-serve.test.ts` is the dynamic half — it actually builds
 * the app and inspects the artifact.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(storefrontDir, "src");

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Strips `/* ... *\/` and `// ...` comments so prose *about* `NEXT_PUBLIC_*`
 * (this file's own module doc, `next.config.ts`'s, several others') does not
 * trip the scan below — the scan is for actual usage, not the word appearing
 * anywhere at all. Naive (does not understand strings containing `//`), which
 * is fine here: a false positive would only make the test stricter, never
 * blinder.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("no NEXT_PUBLIC_ anywhere in the storefront's own source", () => {
  const files = [...listSourceFiles(srcDir), join(storefrontDir, "next.config.ts")];

  it("scanned at least the files this unit added", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  for (const file of files) {
    it(`${file.replace(`${storefrontDir}/`, "")} does not mention NEXT_PUBLIC_ outside a comment`, () => {
      const code = stripComments(readFileSync(file, "utf8"));
      expect(code).not.toMatch(/NEXT_PUBLIC_/);
    });
  }
});
