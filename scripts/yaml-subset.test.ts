import { describe, expect, it } from "vitest";
import { asMapping, asScalar, asSequence, parseYamlSubset, scalars } from "./yaml-subset.js";

/**
 * The workflow assertions in `scripts/workflows.test.ts` are only as good as
 * this reader, so it is held to its own fixtures. A parser that silently
 * returned an empty mapping would make every workflow guarantee vacuous.
 */

describe("parseYamlSubset", () => {
  it("reads nested mappings and keeps scalars as strings", () => {
    const parsed = asMapping(
      parseYamlSubset(["---", "concurrency:", "  group: plepic-gitops-promotion", "  cancel-in-progress: false", ""].join("\n")),
      "document",
    );
    const concurrency = asMapping(parsed["concurrency"]!, "concurrency");
    expect(asScalar(concurrency["group"]!, "group")).toBe("plepic-gitops-promotion");
    expect(asScalar(concurrency["cancel-in-progress"]!, "cancel-in-progress")).toBe("false");
  });

  it("reads block and flow sequences", () => {
    const parsed = asMapping(
      parseYamlSubset(["branches:", "  - main", "  - release", "types: [labeled, unlabeled]", ""].join("\n")),
      "document",
    );
    expect(asSequence(parsed["branches"]!, "branches")).toEqual(["main", "release"]);
    expect(asSequence(parsed["types"]!, "types")).toEqual(["labeled", "unlabeled"]);
  });

  it("reads a sequence of mappings, including the inline first key", () => {
    const parsed = asMapping(
      parseYamlSubset(
        [
          "steps:",
          "  - name: Check out",
          "    uses: actions/checkout@abc",
          "    with:",
          "      ref: main",
          "  - name: Run",
          "    run: echo hello",
          "",
        ].join("\n"),
      ),
      "document",
    );
    const steps = asSequence(parsed["steps"]!, "steps");
    expect(steps).toHaveLength(2);
    const first = asMapping(steps[0]!, "steps[0]");
    expect(asScalar(first["uses"]!, "uses")).toBe("actions/checkout@abc");
    expect(asMapping(first["with"]!, "with")["ref"]).toBe("main");
    expect(asMapping(steps[1]!, "steps[1]")["run"]).toBe("echo hello");
  });

  it("keeps a literal block scalar's lines, including ones that look like keys", () => {
    const parsed = asMapping(
      parseYamlSubset(["run: |", "  set -euo pipefail", "  name: not-a-key", "next: value", ""].join("\n")),
      "document",
    );
    expect(asScalar(parsed["run"]!, "run")).toBe("set -euo pipefail\nname: not-a-key");
    expect(parsed["next"]).toBe("value");
  });

  it("folds a folded block scalar onto one line", () => {
    const parsed = asMapping(
      parseYamlSubset(["if: >-", "  first &&", "  second", "runs-on: ubuntu-24.04", ""].join("\n")),
      "document",
    );
    expect(asScalar(parsed["if"]!, "if")).toBe("first && second");
    expect(parsed["runs-on"]).toBe("ubuntu-24.04");
  });

  it("distinguishes an empty mapping from an absent value", () => {
    const parsed = asMapping(
      parseYamlSubset(["permissions: {}", "outputs:", "environment: test", ""].join("\n")),
      "document",
    );
    expect(asMapping(parsed["permissions"]!, "permissions")).toEqual({});
    expect(parsed["outputs"]).toBe("");
    expect(parsed["environment"]).toBe("test");
  });

  it("unquotes quoted keys and scalars but leaves colons in values alone", () => {
    const parsed = asMapping(
      parseYamlSubset(["'on':", "  push:", "    branches: ['main']", "url: https://example.invalid/x", ""].join("\n")),
      "document",
    );
    const on = asMapping(parsed["on"]!, "on");
    expect(asSequence(asMapping(on["push"]!, "push")["branches"]!, "branches")).toEqual(["main"]);
    expect(parsed["url"]).toBe("https://example.invalid/x");
  });

  it("skips comments outside block scalars and keeps them inside", () => {
    const parsed = asMapping(
      parseYamlSubset(["# a comment", "run: |", "  # kept", "  echo hi", "after: yes", ""].join("\n")),
      "document",
    );
    expect(asScalar(parsed["run"]!, "run")).toBe("# kept\necho hi");
    expect(parsed["after"]).toBe("yes");
  });

  it("refuses what it does not understand rather than returning nothing", () => {
    expect(() => parseYamlSubset(["a: 1", "  b: 2", ""].join("\n"))).toThrow(/unexpected indentation/);
    expect(() => parseYamlSubset(["a: 1", "a: 2", ""].join("\n"))).toThrow(/duplicate mapping key/);
    expect(() => parseYamlSubset(["a: {b: c}", ""].join("\n"))).toThrow(/unsupported flow mapping/);
    expect(() => parseYamlSubset(["just a scalar", ""].join("\n"))).toThrow(/unsupported mapping entry/);
  });

  it("refuses a second document rather than merging it into the first", () => {
    // Merging is the dangerous reading: a second document's `permissions:`
    // would silently overwrite -- or be overwritten by -- the first's.
    expect(() => parseYamlSubset(["a: 1", "---", "b: 2", ""].join("\n"))).toThrow(
      /unsupported second document/,
    );
    expect(() => parseYamlSubset(["---", "a: 1", "---", "b: 2", ""].join("\n"))).toThrow(
      /unsupported second document/,
    );
    expect(() => parseYamlSubset(["---", "a: 1", "---", ""].join("\n"))).toThrow(
      /unsupported second document/,
    );
    expect(asMapping(parseYamlSubset(["---", "a: 1", ""].join("\n")), "document")["a"]).toBe("1");
  });

  it("refuses tab indentation, which YAML does not allow at all", () => {
    expect(() => parseYamlSubset(["a:", "\tb: 2", ""].join("\n"))).toThrow(
      /unsupported tab indentation/,
    );
    expect(() => parseYamlSubset(["a:", "  \tb: 2", ""].join("\n"))).toThrow(
      /unsupported tab indentation/,
    );
    // A tab inside a value, and inside a block scalar's body, is content.
    expect(asMapping(parseYamlSubset(["a: one\ttwo", ""].join("\n")), "document")["a"]).toBe(
      "one\ttwo",
    );
    expect(
      asMapping(parseYamlSubset(["run: |", "  echo one", "  \techo two", ""].join("\n")), "document")[
        "run"
      ],
    ).toBe("echo one\n\techo two");
  });
});

describe("the narrowing helpers", () => {
  it("throw with the path they were given", () => {
    expect(() => asMapping(["a"], "jobs")).toThrow(/jobs is not a mapping/);
    expect(() => asSequence("a", "steps")).toThrow(/steps is not a sequence/);
    expect(() => asScalar({}, "group")).toThrow(/group is not a scalar/);
  });
});

describe("scalars", () => {
  it("collects every scalar reachable from a value", () => {
    expect(scalars({ a: "one", b: ["two", { c: "three" }] })).toEqual(["one", "two", "three"]);
  });
});
