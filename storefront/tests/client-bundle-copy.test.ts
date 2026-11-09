/**
 * No client component can reach every edition's copy.
 *
 * `content/editions.ts`, `content/index.ts` and `content/legal/index.ts` each
 * import all four editions. A `"use client"` module that imports one of them,
 * directly or through any chain of value imports, puts all of it into the
 * browser bundle, and because Next.js loads every client component a route
 * module imports, that bundle then reaches nearly every page. It cost about
 * 80 KB of compressed JavaScript per page before `src/lib/edition-copy.ts`
 * existed, and was the largest single weight on the mobile Lighthouse score.
 *
 * This walks the same graph the bundler does: from every file that starts
 * with `"use client"`, through each relative value import. `import type` and
 * `export type` are skipped, because they compile away, and so is the inside
 * of a `"use server"` module: a client bundle holds only references to its
 * functions, which run on the server. A module reached this way is in some
 * page's client bundle.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const storefront = dirname(dirname(fileURLToPath(import.meta.url)));
const repository = dirname(storefront);
const srcDir = join(storefront, "src");

/** The modules that hold every edition at once. */
const ALL_EDITIONS = ["content/editions.ts", "content/index.ts", "content/legal/index.ts"];

const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["'](\.[^"']+)["']/gm;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function resolveImport(from: string, specifier: string): string | undefined {
  const target = resolve(dirname(from), specifier);
  const stem = target.replace(/\.js$/, "");
  return [`${stem}.ts`, `${stem}.tsx`, target, join(stem, "index.ts")].find(
    (candidate) => existsSync(candidate) && !candidate.endsWith("/") && /\.(tsx?|json)$/.test(candidate),
  );
}

/** Every module reachable from a client entry, mapped to the module that first imported it. */
function clientGraph(): Map<string, string | null> {
  const entries = sourceFiles(srcDir).filter((file) => /^\s*["']use client["']/.test(readFileSync(file, "utf8")));
  const parent = new Map<string, string | null>(entries.map((entry) => [entry, null]));
  const queue = [...entries];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (!/\.tsx?$/.test(current)) continue;
    const code = readFileSync(current, "utf8");
    if (/^\s*["']use server["']/.test(code)) continue;
    for (const match of code.matchAll(VALUE_IMPORT)) {
      const imported = resolveImport(current, match[1]!);
      if (imported !== undefined && !parent.has(imported)) {
        parent.set(imported, current);
        queue.push(imported);
      }
    }
  }
  return parent;
}

function chain(graph: Map<string, string | null>, module: string): string {
  const links: string[] = [];
  for (let current: string | null | undefined = module; current; current = graph.get(current)) {
    links.push(relative(repository, current));
  }
  return links.join(" <- ");
}

describe("the client bundle", () => {
  const graph = clientGraph();

  it("finds the client components it walks from", () => {
    // A guard on the walk itself: were the entry pattern to stop matching,
    // every assertion below would pass over an empty graph.
    expect(graph.has(join(srcDir, "components", "shop", "CheckoutPageContent.tsx"))).toBe(true);
    expect(graph.has(join(srcDir, "lib", "cart-store.tsx"))).toBe(true);
  });

  it.each(ALL_EDITIONS)("does not reach %s", (module) => {
    const path = join(repository, module);
    expect(graph.has(path) ? chain(graph, path) : null).toBeNull();
  });

  it("does not reach the module that chooses copy for client components", () => {
    // `edition-copy.ts` imports every edition by design; client modules may
    // only import its types.
    const path = join(srcDir, "lib", "edition-copy.ts");
    expect(graph.has(path) ? chain(graph, path) : null).toBeNull();
  });
});
