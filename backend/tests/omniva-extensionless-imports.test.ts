import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the one thing `backend/src/modules/omniva/index.ts`'s own docstring
 * and `backend/src/config/runtime.ts`'s own header both already explain in
 * prose, and that this branch broke anyway: every file `medusa-config.ts`
 * reaches through ts-node's type-generation pass must import its first-party
 * relative dependencies **extensionless**.
 *
 * ## Why this exists
 *
 * `medusa build`'s "Generating types" phase loads every declared module
 * through a require chain that begins at `medusa-config.ts` and is
 * monkey-patched into MikroORM's `ConfigurationLoader.registerTsNode`
 * (`@medusajs/framework/dist/mikro-orm-cli/bin.js`) -- see `index.ts`'s own
 * header for the full story of finding this the first time, for `./service`.
 * That loader resolves a relative specifier the way plain Node does: a
 * bare `./shipping-model` gets ts-node's registered `.ts` resolution tried
 * against it, but a specifier that already carries `.js` is asked for
 * *literally*, and there is no compiled `shipping-model.js` sitting beside
 * the source for it to find. The failure is "Cannot find module
 * './shipping-model.js'", it happens during `medusa build`, and it happens
 * nowhere else -- not `tsc --noEmit`, not `vitest run`, not `medusa develop`.
 * That is exactly why it reached `main` once already: three review passes
 * and the full unit suite pass on a `.js`-suffixed import in this graph,
 * because none of them build the image. Only `bash scripts/store-smoke` (or
 * a real `medusa build`) does, and it is not part of `bash scripts/validate`.
 *
 * `backend/src/commerce/product-model.ts` carried exactly this defect,
 * introduced when the Omniva feature gave `modules/omniva/service.ts` a
 * reason to import it -- which dragged the whole `commerce/` tree onto a
 * path that, before that, only `runtime.ts` (already extensionless, already
 * documented) had to worry about. Fixed in the same commit that added this
 * guard. `backend/src/commerce/tax-model.ts` carries the identical
 * `"./shipping-model.js"` import today and is deliberately **not** touched
 * by that fix -- it is not reachable from `modules/omniva/index.ts` yet, so
 * changing it now would be speculative. This test is what stands in its
 * place: the day something imports `tax-model.ts` into this graph, this
 * guard fails naming it, instead of the next build in the cluster.
 *
 * ## What this does and does not check
 *
 * A regex over `from "..."` clauses, not a real parser -- deliberately: this
 * is a lint over a graph of files this codebase already writes in a single,
 * consistent style (one `import`/`export ... from "..."` clause per line or
 * per multi-line block, always a double- or single-quoted string literal),
 * not a general-purpose module resolver. It follows every **relative**
 * specifier (starting with `.`) reachable from
 * `backend/src/modules/omniva/index.ts`, staying inside `backend/src`; a
 * bare package specifier (`@medusajs/framework/utils`, `redis`, ...) is left
 * alone; it is external, and `medusa build`'s ts-node pass never tries to
 * map it onto a sibling `.ts` file the way it does a relative one.
 */

const SRC_ROOT = join(__dirname, "..", "src");
const ENTRY = join(SRC_ROOT, "modules", "omniva", "index.ts");

/**
 * `text` with every `/** ... *‍/` block comment blanked out (replaced with
 * nothing, not merely hidden) before the import regex ever sees it.
 *
 * Every docstring in this codebase is a `/**` block, house style being what
 * it is (see `service.ts`'s own header), and several of them *say* things
 * like `` `export { X } from "./shipping-model.js"` `` in prose -- describing
 * a form deliberately not written, not writing it. Without this, this file's
 * own regex the coordinator sanctioned ("a lint, not a compiler") reads that
 * prose as a real import and blames the wrong file. Line comments (`//`) are
 * deliberately left alone: nothing in this codebase's reachable graph puts a
 * `from "./…"`-shaped string after one (checked by hand), and blanking them
 * too would risk truncating a real code line that merely contains `//`
 * inside a string literal, such as `client.ts`'s tracking URL template.
 */
function withoutBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every relative (`.`-prefixed) specifier a `from "..."` clause names in `filePath`. */
function relativeImportSpecifiers(filePath: string): string[] {
  const text = withoutBlockComments(readFileSync(filePath, "utf8"));
  const specifiers: string[] = [];
  const pattern = /from\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const specifier = match[1] ?? "";
    if (specifier.startsWith(".")) specifiers.push(specifier);
  }
  return specifiers;
}

/**
 * `specifier`, resolved against `fromFile`'s directory, the way ts-node's
 * extensionless resolution finds a sibling `.ts`/`.tsx` file or an `index`
 * inside a directory. `null` when nothing on disk matches any candidate --
 * not this guard's concern (a specifier naming a file that does not exist at
 * all is a `tsc` failure, caught elsewhere) and not walked any further.
 */
function resolveExtensionless(fromFile: string, specifier: string): string | null {
  const resolved = join(dirname(fromFile), specifier);
  const candidates = [`${resolved}.ts`, `${resolved}.tsx`, join(resolved, "index.ts"), join(resolved, "index.tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

interface ExtensionlessImportViolation {
  readonly file: string;
  readonly specifier: string;
}

interface ImportGraphWalk {
  readonly visited: readonly string[];
  readonly violations: readonly ExtensionlessImportViolation[];
}

/**
 * A breadth-first walk of every first-party file reachable from `entry`
 * through relative imports. Each `.js`-suffixed relative specifier is
 * recorded as a violation and **not** followed -- there is nothing on disk
 * for it to resolve to (that is the whole defect), so there is nothing
 * further to walk through it.
 */
function walkFirstPartyImportGraph(entry: string): ImportGraphWalk {
  const visited = new Set<string>();
  const violations: ExtensionlessImportViolation[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);

    for (const specifier of relativeImportSpecifiers(current)) {
      if (specifier.endsWith(".js")) {
        violations.push({ file: relative(SRC_ROOT, current), specifier });
        continue;
      }
      const resolved = resolveExtensionless(current, specifier);
      if (resolved !== null) queue.push(resolved);
    }
  }

  return { visited: [...visited], violations };
}

describe("the first-party import graph medusa build's ts-node pass reaches through modules/omniva", () => {
  it("actually walks more than the entry file, and reaches product-model.ts", () => {
    // A guard that visited only its own entry point would pass trivially,
    // whatever `resolveExtensionless` does -- this is the check that would
    // catch that guard being broken, not the feature it exists to protect.
    const { visited } = walkFirstPartyImportGraph(ENTRY);
    expect(visited.length).toBeGreaterThan(5);
    expect(visited).toContainEqual(expect.stringContaining(join("commerce", "product-model.ts")));
  });

  it("imports every first-party relative dependency extensionlessly", () => {
    const { violations } = walkFirstPartyImportGraph(ENTRY);
    const message = violations
      .map((violation) => `${violation.file}: imports "${violation.specifier}" -- drop the ".js"`)
      .join("\n");
    expect(violations, message).toEqual([]);
  });
});
