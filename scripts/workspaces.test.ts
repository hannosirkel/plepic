import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { declaresWorkspace, parseRootPackageJson, readRootPackageJson } from "./workspaces.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("parseRootPackageJson", () => {
  it("parses a package.json object with a name", () => {
    const pkg = parseRootPackageJson('{"name": "example", "workspaces": ["a"]}');
    expect(pkg.name).toBe("example");
    expect(pkg.workspaces).toEqual(["a"]);
  });

  it("rejects JSON without a string name field", () => {
    expect(() => parseRootPackageJson("{}")).toThrow(/name/);
    expect(() => parseRootPackageJson("[]")).toThrow(/name/);
    expect(() => parseRootPackageJson("null")).toThrow(/name/);
  });
});

describe("declaresWorkspace", () => {
  it("is true when the workspace is listed", () => {
    expect(declaresWorkspace({ name: "root", workspaces: ["storefront"] }, "storefront")).toBe(
      true,
    );
  });

  it("is false when the workspace is missing or the field is absent", () => {
    expect(declaresWorkspace({ name: "root", workspaces: ["storefront"] }, "backend")).toBe(
      false,
    );
    expect(declaresWorkspace({ name: "root" }, "storefront")).toBe(false);
  });
});

describe("this repository's package.json", () => {
  it("declares the storefront workspace that later PR units fill in", () => {
    const pkg = readRootPackageJson(repoRoot);
    expect(declaresWorkspace(pkg, "storefront")).toBe(true);
  });
});
