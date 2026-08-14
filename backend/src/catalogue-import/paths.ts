import { resolve, sep } from "node:path";

import { CatalogueImportRefusal } from "./refusal.js";

/**
 * The one filename shape the import will write. Deliberately narrower than the
 * filesystem allows: lower-case letters, digits, hyphen, underscore and dot,
 * never leading with a dot, and one extension.
 *
 * A charset allowlist is the check that survives being wrong about the others.
 * `..`, an absolute path, a backslash, a percent-encoded traversal, a NUL and a
 * leading or trailing space are each rejected by it without the code having to
 * enumerate them — and each is enumerated anyway in
 * `tests/catalogue-import-archive.test.ts`, because a defence nobody has fired
 * at is a defence nobody has tested.
 */
const SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;

export function isSafeMediaFilename(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 128 &&
    SAFE_FILENAME.test(name) &&
    !name.includes("..") &&
    name !== "." &&
    name !== ".."
  );
}

/**
 * Resolves `relative` inside `root`, or refuses. Returning a path is a promise
 * that the path is inside the assets root; there is no other way to obtain one.
 */
export function resolveWithinRoot(root: string, relative: string): string {
  if (!isSafeMediaFilename(relative)) {
    throw new CatalogueImportRefusal(
      "unsafe-archive-member",
      `refused a filename that is not a plain media file name: ${JSON.stringify(relative)}`,
    );
  }

  const absoluteRoot = resolve(root);
  const candidate = resolve(absoluteRoot, relative);

  // Belt and braces. The charset allowlist above already makes an escape
  // unreachable; this catches a future edit that widens it. `startsWith` is
  // anchored on the separator so `/app/static-backup` is not inside
  // `/app/static`.
  if (candidate !== absoluteRoot && !candidate.startsWith(absoluteRoot + sep)) {
    throw new CatalogueImportRefusal(
      "unsafe-archive-member",
      `refused a filename that resolves outside the assets root: ${JSON.stringify(relative)}`,
    );
  }

  return candidate;
}
