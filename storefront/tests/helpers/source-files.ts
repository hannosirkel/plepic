/**
 * The recursive `src/` walk this suite's whole-tree guards share.
 *
 * Two tests need to assert something about *every* source file rather than
 * about a list someone maintained by hand: `no-hardcoded-price.test.ts`
 * ("no price literal outside `src/lib/catalogue.ts`") and
 * `price-presentation.test.tsx` ("no surface renders the bare figure without
 * the operator's qualification"). The second shipped with a hand-written
 * two-element array in place of a walk, and review pass 1 proved it inert by
 * adding a third surface carrying exactly the defect that unit removed: the
 * suite stayed green. A hand-written list of files cannot fail on a file
 * nobody added to it, which is the one failure both guards exist to catch.
 *
 * So the walk lives here, once, and both import it. It is deliberately a
 * plain readdir rather than a glob dependency — the plan forbids adding one,
 * and the tree is a few dozen files.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every `.ts` and `.tsx` file under `dir`, recursively, as absolute paths in
 * directory-entry order.
 *
 * No filtering beyond the extension: a caller that wants to exempt a file
 * exempts it by name, visibly, rather than by a pattern here that would
 * quietly widen for the next caller too.
 */
export function listSourceFiles(dir: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}
