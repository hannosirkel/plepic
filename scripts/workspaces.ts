import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The subset of the root package.json this module cares about: enough to
 * confirm a workspace is declared, nothing more.
 */
export interface RootPackageJson {
  readonly name: string;
  readonly workspaces?: readonly string[];
}

/**
 * Parse raw package.json text into a {@link RootPackageJson}, rejecting
 * anything that is not a JSON object with a string "name" field.
 */
export function parseRootPackageJson(raw: string): RootPackageJson {
  const parsed: unknown = JSON.parse(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { name?: unknown }).name !== "string"
  ) {
    throw new Error('package.json is missing a string "name" field');
  }

  return parsed as RootPackageJson;
}

/** Read and parse the package.json at the root of `rootDir`. */
export function readRootPackageJson(rootDir: string): RootPackageJson {
  return parseRootPackageJson(readFileSync(join(rootDir, "package.json"), "utf8"));
}

/** True when `pkg.workspaces` lists `workspace` verbatim. */
export function declaresWorkspace(pkg: RootPackageJson, workspace: string): boolean {
  return Array.isArray(pkg.workspaces) && pkg.workspaces.includes(workspace);
}
