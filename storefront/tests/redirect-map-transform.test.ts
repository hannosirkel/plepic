import {
  linkSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { ROUTE_PATHS } from "../../content/routes.js";
import {
  createRoutePathIndex,
  transformRedirectMap,
} from "../src/config/redirect-map-transform.js";
import { parseRedirectMap, resolveRedirect } from "../src/config/redirect-map.js";

interface TaskEntry {
  readonly drives_storefront_redirect_table: boolean;
  readonly host: string;
  readonly note: string;
  readonly path: string;
  readonly reason: string;
  readonly target: string;
}

const scratchDirectories: string[] = [];
const storefrontRoot = dirname(dirname(fileURLToPath(import.meta.url)));

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function taskEntry(overrides: Partial<TaskEntry> = {}): TaskEntry {
  return {
    drives_storefront_redirect_table: true,
    host: "legacy.example.org",
    note: "Reserved test entry.",
    path: "*",
    reason: "Reserved test reason.",
    target: ROUTE_PATHS.lunarBase,
    ...overrides,
  };
}

function taskInput(
  storefrontEntries: readonly unknown[],
  unusedEntries: readonly unknown[] = [],
): unknown {
  return {
    metadata: {
      counts: {
        storefront_redirects: 99_999,
        unresolved_pending_task_2_legal_paths: 99_999,
      },
    },
    storefront_redirect_table: storefrontEntries,
    shop_plepic_manifest_unused: unusedEntries,
  };
}

function withoutKey(entry: TaskEntry, key: keyof TaskEntry): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...entry };
  delete copy[key];
  return copy;
}

function scratchDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "plepic-redirect-transform-"));
  scratchDirectories.push(directory);
  return directory;
}

function writeOperatorInput(path: string): string {
  const contents = JSON.stringify(
    taskInput([
      taskEntry({ host: "redirect.example.org", path: "*" }),
      taskEntry({
        host: "redirect.example.org",
        path: "/old-rules",
        target: ROUTE_PATHS.rulebook,
      }),
    ]),
  );
  writeFileSync(path, contents, "utf8");
  return contents;
}

function runCli(inputPath: string, outputPath: string) {
  return spawnSync(
    "npm",
    [
      "run",
      "redirect-map:transform",
      "--",
      "--input",
      inputPath,
      "--output",
      outputPath,
    ],
    { cwd: storefrontRoot, encoding: "utf8" },
  );
}

describe("transformRedirectMap", () => {
  it("selects flagged entries, groups lowercase hosts, and puts exact paths before catch-alls", () => {
    const transformed = transformRedirectMap(
      taskInput(
        [
          taskEntry({ host: "LEGACY.EXAMPLE.ORG", path: "*" }),
          taskEntry({
            host: "legacy.example.org",
            path: "/old-rules",
            target: ROUTE_PATHS.rulebook,
          }),
          taskEntry({
            drives_storefront_redirect_table: false,
            host: "ignored.example.org",
          }),
        ],
        [
          taskEntry({ host: "second.example.org", path: "*", target: ROUTE_PATHS.home }),
          taskEntry({
            host: "second.example.org",
            path: "/old-about",
            target: ROUTE_PATHS.about,
          }),
        ],
      ),
      "reserved-task-1-map",
    );

    expect(transformed).toEqual({
      hosts: {
        "legacy.example.org": [
          { path: "/old-rules", target: "rulebook" },
          { path: "*", target: "lunarBase" },
        ],
        "second.example.org": [
          { path: "/old-about", target: "about" },
          { path: "*", target: "home" },
        ],
      },
    });
    expect(parseRedirectMap(transformed, "transformed-test-map")).toEqual(transformed);
    expect(resolveRedirect("legacy.example.org", "/old-rules", transformed)).toEqual({
      matchKind: "exact",
      targetPath: ROUTE_PATHS.rulebook,
    });
    expect(resolveRedirect("legacy.example.org", "/anything-else", transformed)).toEqual({
      matchKind: "catch-all",
      targetPath: ROUTE_PATHS.lunarBase,
    });
    expect(resolveRedirect("ignored.example.org", "/", transformed)).toBeNull();
  });

  it("rejects duplicate source host/path pairs after host normalization", () => {
    expect(() =>
      transformRedirectMap(
        taskInput([
          taskEntry({ host: "LEGACY.EXAMPLE.ORG", path: "*" }),
          taskEntry({ host: "legacy.example.org", path: "*" }),
        ]),
        "duplicate-map",
      ),
    ).toThrow(/duplicate/i);
  });

  it("rejects a target path outside the real ROUTE_PATHS vocabulary", () => {
    expect(() =>
      transformRedirectMap(
        taskInput([taskEntry({ target: "/not-a-storefront-route" })]),
        "unresolvable-map",
      ),
    ).toThrow(/does not resolve to a unique RouteId/);
  });

  it("rejects a mapped host without a catch-all through the real parser", () => {
    expect(() =>
      transformRedirectMap(
        taskInput([taskEntry({ path: "/old-home", target: ROUTE_PATHS.home })]),
        "missing-catch-all-map",
      ),
    ).toThrow(/catch-all/);
  });

  it("rejects malformed entries instead of silently skipping them", () => {
    const malformed = taskInput([taskEntry()]) as {
      storefront_redirect_table: Array<Record<string, unknown>>;
    };
    malformed.storefront_redirect_table[0] = {
      ...malformed.storefront_redirect_table[0],
      unexpected: "field",
    };

    expect(() => transformRedirectMap(malformed, "malformed-map")).toThrow(/unexpected key/);
  });

  it("accepts real-shape unflagged rows whose only absent key is note", () => {
    const unusedWithoutNotes = [
      withoutKey(
        taskEntry({
          drives_storefront_redirect_table: false,
          host: "unused-one.example.org",
          path: "/old-one",
        }),
        "note",
      ),
      withoutKey(
        taskEntry({
          drives_storefront_redirect_table: false,
          host: "unused-two.example.org",
          path: "/old-two",
        }),
        "note",
      ),
      withoutKey(
        taskEntry({
          drives_storefront_redirect_table: false,
          host: "unused-three.example.org",
          path: "/old-three",
        }),
        "note",
      ),
    ];

    const transformed = transformRedirectMap(
      taskInput(
        [
          taskEntry({ host: "active.example.org", path: "*" }),
          taskEntry({ host: "active.example.org", path: "/old-home", target: ROUTE_PATHS.home }),
        ],
        unusedWithoutNotes,
      ),
      "real-shape-map",
    );

    expect(transformed).toEqual({
      hosts: {
        "active.example.org": [
          { path: "/old-home", target: "home" },
          { path: "*", target: "lunarBase" },
        ],
      },
    });
  });

  it("still requires note on a selected row", () => {
    expect(() =>
      transformRedirectMap(
        taskInput([withoutKey(taskEntry(), "note")]),
        "selected-missing-note-map",
      ),
    ).toThrow(/missing key "note"/);
  });

  it("rejects any other missing key on an unflagged row", () => {
    expect(() =>
      transformRedirectMap(
        taskInput(
          [taskEntry()],
          [withoutKey(taskEntry({ drives_storefront_redirect_table: false }), "reason")],
        ),
        "unflagged-missing-reason-map",
      ),
    ).toThrow(/missing key "reason"/);
  });

  it.each([
    ["/old/../admin", "dot segments"],
    ["/%2e%2e/admin", "encoded dot traversal"],
    ["/old\\..\\admin", "backslashes"],
    ["/old\npath", "control characters"],
  ])("rejects an exact source path with %s (%s)", (path) => {
    expect(() =>
      transformRedirectMap(
        taskInput([
          taskEntry({ path: "*" }),
          taskEntry({ path, target: ROUTE_PATHS.home }),
        ]),
        "normalized-path-map",
      ),
    ).toThrow(/runtime-normalized pathname/);
  });

  it("rejects ambiguous route vocabularies", () => {
    expect(() => createRoutePathIndex({ first: "/same", second: "/same" }, "ambiguous-routes"))
      .toThrow(/ambiguous/i);
  });
});

describe("redirect-map transform CLI", () => {
  it("writes deterministic JSON atomically with restrictive permissions", () => {
    const directory = scratchDirectory();
    const inputPath = join(directory, "operator-map.json");
    const outputPath = join(directory, "runtime-map.json");
    writeOperatorInput(inputPath);
    writeFileSync(outputPath, "old contents\n", { mode: 0o644 });

    const run = () => runCli(inputPath, outputPath);

    const first = run();
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    const firstOutput = readFileSync(outputPath, "utf8");
    const second = run();
    expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);

    expect(readFileSync(outputPath, "utf8")).toBe(firstOutput);
    expect(firstOutput).toBe(
      `${JSON.stringify(
        {
          hosts: {
            "redirect.example.org": [
              { path: "/old-rules", target: "rulebook" },
              { path: "*", target: "lunarBase" },
            ],
          },
        },
      )}\n`,
    );
    expect(statSync(outputPath).mode & 0o777).toBe(0o600);
    expect(readdirSync(directory).toSorted()).toEqual([
      "operator-map.json",
      "runtime-map.json",
    ]);
  });

  it("refuses identical input and output paths without changing the source", () => {
    const directory = scratchDirectory();
    const inputPath = join(directory, "operator-map.json");
    const original = writeOperatorInput(inputPath);

    const result = runCli(inputPath, inputPath);

    expect(result.status).toBe(1);
    expect(readFileSync(inputPath, "utf8")).toBe(original);
    expect(readdirSync(directory)).toEqual(["operator-map.json"]);
  });

  it("refuses an output symlink to the input without replacing either path", () => {
    const directory = scratchDirectory();
    const inputPath = join(directory, "operator-map.json");
    const outputPath = join(directory, "runtime-map.json");
    const original = writeOperatorInput(inputPath);
    symlinkSync(inputPath, outputPath);

    const result = runCli(inputPath, outputPath);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(readFileSync(inputPath, "utf8")).toBe(original);
    expect(lstatSync(outputPath).isSymbolicLink()).toBe(true);
    expect(readFileSync(outputPath, "utf8")).toBe(original);
  });

  it("refuses an output hardlink to the input without replacing either path", () => {
    const directory = scratchDirectory();
    const inputPath = join(directory, "operator-map.json");
    const outputPath = join(directory, "runtime-map.json");
    const original = writeOperatorInput(inputPath);
    linkSync(inputPath, outputPath);

    const result = runCli(inputPath, outputPath);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(readFileSync(inputPath, "utf8")).toBe(original);
    expect(readFileSync(outputPath, "utf8")).toBe(original);
    expect(statSync(inputPath).ino).toBe(statSync(outputPath).ino);
  });

  it("refuses an input symlink to the output target without changing the target", () => {
    const directory = scratchDirectory();
    const outputPath = join(directory, "operator-map.json");
    const inputPath = join(directory, "operator-map-link.json");
    const original = writeOperatorInput(outputPath);
    symlinkSync(outputPath, inputPath);

    const result = runCli(inputPath, outputPath);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(readFileSync(outputPath, "utf8")).toBe(original);
    expect(lstatSync(inputPath).isSymbolicLink()).toBe(true);
    expect(readFileSync(inputPath, "utf8")).toBe(original);
  });
});
