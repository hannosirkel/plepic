import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { asMapping, asScalar, asSequence, parseYamlSubset, scalars, type YamlValue } from "./yaml-subset.js";

/**
 * `Deploy Test` runs on `pull_request_target`: with the base repository's token
 * and secrets, on a pull request an outside contributor may have authored. Its
 * safety is entirely structural — which job holds which credential, which
 * revision the guard is read from, which overlay is written — so it is asserted
 * against the parsed document rather than by reading the file.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDirectory = join(repoRoot, ".github", "workflows");

function source(name: string): string {
  return readFileSync(join(workflowDirectory, name), "utf8");
}

function workflow(name: string): { readonly [key: string]: YamlValue } {
  return asMapping(parseYamlSubset(source(name)), name);
}

function jobs(name: string): { readonly [key: string]: YamlValue } {
  return asMapping(workflow(name)["jobs"]!, `${name} jobs`);
}

function job(name: string, id: string): { readonly [key: string]: YamlValue } {
  const found = jobs(name)[id];
  if (found === undefined) throw new Error(`${name} has no ${id} job`);
  return asMapping(found, `${name}.${id}`);
}

function steps(name: string, id: string): Array<{ readonly [key: string]: YamlValue }> {
  return asSequence(job(name, id)["steps"]!, `${name}.${id}.steps`).map((step, index) =>
    asMapping(step, `${name}.${id}.steps[${index}]`),
  );
}

/** Everything the job's steps would run or reference, as one searchable string. */
function jobText(name: string, id: string): string {
  return scalars(job(name, id)).join("\n");
}

/** Every value of a `uses` key reachable from `value`, at any depth. */
function usesReferences(value: YamlValue): string[] {
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap((item) => usesReferences(item));
  return Object.entries(value).flatMap(([key, item]) =>
    key === "uses" ? [asScalar(item, "uses")] : usesReferences(item),
  );
}

/** Every mapping key reachable from `value`, at any depth. */
function keysOf(value: YamlValue): string[] {
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap((item) => keysOf(item));
  return Object.entries(value).flatMap(([key, item]) => [key, ...keysOf(item)]);
}

/** A step's `with:` block, or an empty mapping when it declares none. */
function withBlock(
  step: { readonly [key: string]: YamlValue },
  path: string,
): { readonly [key: string]: YamlValue } {
  return step["with"] === undefined ? {} : asMapping(step["with"], `${path}.with`);
}

/**
 * A `uses:` line, however the step is laid out. When `uses` is a step's first
 * key it carries the sequence dash — `- uses: …` — which GitHub Actions
 * accepts and an expression anchored to `^\s*uses:` does not match.
 */
const USES_LINE = /^\s*(?:-\s+)?uses:/gm;

/** The pin check, as applied to one workflow's source. */
function expectEveryActionPinned(name: string, text: string): void {
  // Read from the parsed document, not from the source. A line-anchored
  // `uses:\s*(\S+)$` cannot match a line carrying a trailing comment --
  // which GitHub Actions accepts -- so `uses: x@main # pinned` was never
  // collected and never checked. The parser keeps the comment in the
  // value, which is what makes it fail the pin pattern below.
  const references = usesReferences(parseYamlSubset(text));
  expect(references.length).toBeGreaterThan(0);
  // Every `uses:` in the file must be one of the references checked: a
  // reference the traversal cannot reach is a reference nothing pins. The
  // cross-check has to recognise every way a step may be written, or it
  // fails a correctly pinned action for its layout instead of its pin.
  expect(references.length).toBe([...text.matchAll(USES_LINE)].length);
  for (const reference of references) {
    expect(reference, `${name} does not pin ${reference}`).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
  }
}

/** Each pinned `uses:` reference paired with the comment line above it. */
function pinAnnotations(name: string): Array<readonly [string, string]> {
  const lines = source(name).split("\n");
  return lines.flatMap((line, index) => {
    const reference = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line)?.[1];
    if (reference === undefined) return [];
    const previous = lines[index - 1] ?? "";
    const comment = /^\s*#\s*(.*)$/.exec(previous)?.[1];
    expect(comment, `${name}:${index + 1} pins ${reference} with no comment saying what it is`)
      .toBeDefined();
    return [[reference, comment!] as const];
  });
}

const DEPLOY_TEST = "deploy-test.yml";
const RELEASE = "release.yml";

/** Each `run:` body in one job, paired with the step index holding it. */
function jobScripts(name: string, id: string): Array<readonly [number, string]> {
  return steps(name, id).flatMap((step, index) =>
    step["run"] === undefined
      ? []
      : [[index, asScalar(step["run"], `${name}.${id}.steps[${index}].run`)] as const],
  );
}

/** Every `run:` body in a workflow, paired with where it was found. */
function everyScript(name: string): Array<readonly [string, string]> {
  return Object.keys(jobs(name)).flatMap((id) =>
    jobScripts(name, id).map(([index, script]) => [`${id}.steps[${index}]`, script] as const),
  );
}

/**
 * Shell lines with `\` continuations folded, so one command is one entry, and
 * comment lines dropped, so prose about a command is not mistaken for one.
 *
 * The dropping matters: every check below is a search for something a script
 * must not do, and a comment saying "this deliberately does not run `npm
 * install`" is the sentence most likely to be written next to a script that
 * deliberately does not run `npm install`.
 */
function commands(script: string): string[] {
  const folded: string[] = [];
  for (const line of script.split("\n")) {
    const previous = folded[folded.length - 1];
    if (previous !== undefined && previous.endsWith("\\")) {
      folded[folded.length - 1] = `${previous.slice(0, -1).trimEnd()} ${line.trim()}`;
    } else {
      folded.push(line.trim());
    }
  }
  return folded.filter((line) => !line.startsWith("#"));
}

/**
 * Every `run:` body that interpolates a workflow expression into the shell.
 *
 * `${{ … }}` is substituted into the script *before* a shell ever sees it, so
 * an expression carrying head-controlled text — a branch name, a commit
 * message, a pull request title — becomes head-controlled shell in a job that
 * may hold a credential. Nothing in this repository needs it: every workflow
 * here passes values through `env:`, where they arrive as shell variables and
 * stay data. That makes the rule "never", which is the only version of it that
 * can be checked without judgement.
 */
function interpolationOffences(scripts: ReadonlyArray<readonly [string, string]>): string[] {
  return scripts.filter(([, body]) => body.includes("${{")).map(([where]) => where);
}

/**
 * One folded line split at the shell's own command boundaries, so a check on
 * "the command" is not fooled by `true && git fetch origin`.
 */
function logicalCommands(line: string): string[] {
  return line
    .split(/&&|\|\||[;|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Everything a promoting job is allowed to do with `git`.
 *
 * This is an **allowlist**, and it replaced a blacklist of forbidden
 * subcommands that leaked in the one direction this repository actually writes
 * git commands in: the blacklist required the subcommand to follow `git`
 * immediately, so `git -C gitops fetch origin pull/1/head` walked straight past
 * it — and `git -C <path>` is the form `scripts/update-gitops-digest.sh` uses
 * throughout. Listing what the job does instead of guessing what an attacker
 * would means a subcommand nobody considered is refused by default.
 */
const GIT_SUBCOMMANDS: readonly string[] = ["config", "add", "diff", "commit", "push"];

/**
 * `git` as the start of a command: at the start of a logical command, after
 * whitespace, or inside a substitution — `staged="$(git diff …)"` is a real
 * invocation and must be checked. Deliberately not `\bgit\b`, which also
 * matches the `.git` at the end of a push URL and would fail the one line the
 * job exists to run.
 */
const GIT_INVOCATION = /(?:^|[\s(`{])git\s+/g;

/** Every `git` invocation in one logical command that is not on the allowlist. */
function gitOffences(command: string): string[] {
  const offences: string[] = [];
  for (const match of command.matchAll(GIT_INVOCATION)) {
    const rest = command.slice(match.index + match[0].length).trim().split(/\s+/);
    // `-C <path>` is tolerated and nothing else is: it selects the worktree,
    // not the operation, and this repository's own guard writes every one of
    // its git calls that way.
    const subcommand = rest[0] === "-C" ? rest[2] : rest[0];
    if (subcommand === undefined || !GIT_SUBCOMMANDS.includes(subcommand)) {
      offences.push(`git ${subcommand ?? "(nothing)"}`);
    }
  }
  return offences;
}

const FORBIDDEN_COMMANDS: ReadonlyArray<readonly [string, RegExp]> = [
  ["reaches GitHub through the gh CLI", /\bgh\s+(?:pr|repo|api|run|release)\b/],
  ["pipes a download into an interpreter", /\bcurl\b[^\n]*\|\s*(?:sh|bash|node|python3?)\b/],
  ["runs a Node package manager", /\b(?:npm|npx|pnpm|yarn)\b/],
  ["builds or runs a container", /\bdocker\s+(?:build|run)\b/],
];

/**
 * Everything wrong with the `run:` bodies of a job that holds the GitOps
 * credential: code arriving, or an expression being interpolated into a shell.
 */
function codeImportOffences(scripts: ReadonlyArray<readonly [number, string]>): string[] {
  const offences: string[] = [];
  for (const [index, script] of scripts) {
    for (const line of commands(script)) {
      for (const [what, pattern] of FORBIDDEN_COMMANDS) {
        if (pattern.test(line)) offences.push(`steps[${index}] ${what}: ${line}`);
      }
      for (const command of logicalCommands(line)) {
        for (const offence of gitOffences(command)) {
          offences.push(`steps[${index}] runs ${offence}: ${command}`);
        }
      }
    }
  }
  return offences;
}

describe("every workflow in this repository", () => {
  const names = readdirSync(workflowDirectory).filter((entry) => entry.endsWith(".yml"));

  it("includes the validation, the test-promotion and the release workflows", () => {
    expect(names).toContain("validate.yml");
    expect(names).toContain(DEPLOY_TEST);
    expect(names).toContain(RELEASE);
  });

  for (const name of names) {
    it(`${name} interpolates no expression into any run: body`, () => {
      expect(
        interpolationOffences(everyScript(name)),
        `${name} interpolates a workflow expression into a shell script`,
      ).toEqual([]);
    });
  }

  for (const name of names) {
    it(`${name} pins every action to a 40-character commit SHA`, () => {
      expectEveryActionPinned(name, source(name));
    });

    it(`${name} says in a comment which release each pinned SHA is`, () => {
      // The comment is the only human-readable statement of what is pinned,
      // so it must name the same action and must not contradict another file
      // pinning the same commit.
      for (const [reference, comment] of pinAnnotations(name)) {
        const action = reference.split("@")[0]!;
        expect(comment, `${name} annotates ${reference} as "${comment}"`).toMatch(
          new RegExp(`^${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} v\\S+$`),
        );
      }
    });

    it(`${name} declares explicit permissions for every job`, () => {
      // A job inherits the workflow-level grant when it declares none, so the
      // effective grant is what matters -- and it must always be written down.
      const fallback = workflow(name)["permissions"];
      for (const [id, body] of Object.entries(jobs(name))) {
        const permissions = asMapping(body, `${name}.${id}`)["permissions"] ?? fallback;
        expect(permissions, `${name}.${id} has no effective permissions`).toBeDefined();
        for (const scope of Object.values(asMapping(permissions!, `${name}.${id}.permissions`))) {
          expect(["read", "write", "none"]).toContain(asScalar(scope, "permission"));
        }
      }
    });
  }

  it("annotates one commit SHA the same way in every workflow", () => {
    // Two files pinning the same SHA to different releases means at least one
    // comment is false, and a false comment is worse than none: it is what a
    // reader checks the pin against.
    const annotations = new Map<string, Map<string, string[]>>();
    for (const name of names) {
      for (const [reference, comment] of pinAnnotations(name)) {
        const byComment = annotations.get(reference) ?? new Map<string, string[]>();
        byComment.set(comment, [...(byComment.get(comment) ?? []), name]);
        annotations.set(reference, byComment);
      }
    }
    for (const [reference, byComment] of annotations) {
      expect(
        [...byComment].map(([comment, where]) => `${comment} (${where.join(", ")})`),
        `${reference} is annotated inconsistently`,
      ).toHaveLength(1);
    }
  });
});

describe("the pin check itself", () => {
  // The check above is only as good as what it accepts and what it refuses,
  // and neither is observable from workflows that all happen to be written
  // one way. These drive it with sources this repository does not contain.

  /** A minimal single-job workflow wrapped around the given `steps:` lines. */
  function workflowAround(step: readonly string[]): string {
    return [
      "---",
      "name: Fixture",
      "'on': push",
      "permissions: {}",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-24.04",
      "    steps:",
      ...step,
      "",
    ].join("\n");
  }

  const PINNED = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";

  it("accepts a correctly pinned step whose first key is `uses`", () => {
    // `- uses: …` is ordinary GitHub Actions. A cross-check anchored to
    // `^\s*uses:` never matched the line, so the parsed reference had no
    // counterpart in the source and the count disagreed -- rejecting a
    // properly pinned action for how its step is laid out.
    expect(() =>
      expectEveryActionPinned(
        "fixture.yml",
        workflowAround([
          "      # actions/checkout v7.0.1",
          `      - uses: ${PINNED}`,
          "        with:",
          "          persist-credentials: false",
        ]),
      ),
    ).not.toThrow();
  });

  it("still refuses a mutable ref hidden behind a trailing comment", () => {
    expect(() =>
      expectEveryActionPinned(
        "fixture.yml",
        workflowAround([
          "      - name: Set up Buildx",
          "        # docker/setup-buildx-action v4.2.0",
          "        uses: docker/setup-buildx-action@main # unpinned, mutable ref",
        ]),
      ),
    ).toThrow(/does not pin/);
  });

  it("refuses a mutable ref on a step whose first key is `uses`", () => {
    expect(() =>
      expectEveryActionPinned(
        "fixture.yml",
        workflowAround([
          "      # docker/setup-buildx-action v4.2.0",
          "      - uses: docker/setup-buildx-action@main # unpinned, mutable ref",
        ]),
      ),
    ).toThrow(/does not pin/);
  });
});

describe("Deploy Test's trigger and concurrency", () => {
  it("fires only on a label applied to a pull request targeting main", () => {
    const document = workflow(DEPLOY_TEST);
    expect(document["name"]).toBe("Deploy Test");
    const on = asMapping(document["on"]!, "on");
    expect(Object.keys(on)).toEqual(["pull_request_target"]);
    const trigger = asMapping(on["pull_request_target"]!, "pull_request_target");
    expect(asSequence(trigger["branches"]!, "branches")).toEqual(["main"]);
    expect(asSequence(trigger["types"]!, "types")).toEqual(["labeled"]);
  });

  it("shares one non-cancelling GitOps promotion lane with Release", () => {
    const concurrency = asMapping(workflow(DEPLOY_TEST)["concurrency"]!, "concurrency");
    expect(concurrency["group"]).toBe("plepic-gitops-promotion");
    expect(concurrency["cancel-in-progress"]).toBe("false");
  });

  it("grants the workflow no permissions by default", () => {
    expect(asMapping(workflow(DEPLOY_TEST)["permissions"]!, "permissions")).toEqual({});
  });

  it("runs the gate only for the deploy-test label on an open pull request", () => {
    const condition = asScalar(job(DEPLOY_TEST, "gate")["if"]!, "gate.if");
    expect(condition).toMatch(/github\.event\.label\.name == 'deploy-test'/);
    expect(condition).toMatch(/github\.event\.pull_request\.state == 'open'/);
  });
});

describe("Deploy Test's job permissions", () => {
  const expected: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["gate", { actions: "read", contents: "read", "pull-requests": "read" }],
    ["build", { contents: "read", packages: "write" }],
    ["recheck", { "pull-requests": "read" }],
    ["promote", {}],
  ];

  it("declares exactly these four jobs", () => {
    expect(Object.keys(jobs(DEPLOY_TEST))).toEqual(expected.map(([id]) => id));
  });

  for (const [id, permissions] of expected) {
    it(`gives ${id} exactly ${JSON.stringify(permissions)}`, () => {
      expect(asMapping(job(DEPLOY_TEST, id)["permissions"]!, `${id}.permissions`)).toEqual(
        permissions,
      );
    });
  }

  it("scopes the deployer credential to the promote job's test environment", () => {
    for (const id of ["gate", "build", "recheck"]) {
      expect(job(DEPLOY_TEST, id)["environment"]).toBeUndefined();
      expect(jobText(DEPLOY_TEST, id)).not.toMatch(/PLEPIC_DEPLOYER_/);
    }
    expect(job(DEPLOY_TEST, "promote")["environment"]).toBe("test");
    expect(jobText(DEPLOY_TEST, "promote")).toMatch(/PLEPIC_DEPLOYER_CLIENT_ID/);
    expect(jobText(DEPLOY_TEST, "promote")).toMatch(/PLEPIC_DEPLOYER_PRIVATE_KEY/);
  });
});

describe("the gate reads the guard from the base SHA", () => {
  it("checks nothing out and runs no head code", () => {
    for (const step of steps(DEPLOY_TEST, "gate")) {
      expect(step["uses"]).toBeUndefined();
    }
    expect(jobText(DEPLOY_TEST, "gate")).not.toMatch(/npm (ci|test)|docker build/);
  });

  it("fetches scripts/update-gitops-digest.sh at the base SHA, never the head SHA", () => {
    const gate = jobText(DEPLOY_TEST, "gate");
    expect(gate).toMatch(/BASE_SHA/);
    expect(gate).toMatch(/github\.event\.pull_request\.base\.sha/);
    expect(gate).toMatch(/contents\/scripts\/update-gitops-digest\.sh\?ref=\$\{BASE_SHA\}/);
    expect(gate).not.toMatch(/update-gitops-digest\.sh\?ref=\$\{HEAD_SHA\}/);
    expect(gate).toMatch(/grep -qx '#!\/bin\/sh'/);
  });

  it("verifies the pull request is open, same-repository and targets main", () => {
    const gate = jobText(DEPLOY_TEST, "gate");
    expect(gate).toMatch(/\[ "\$BASE_REF" = main \]/);
    expect(gate).toMatch(/\[ "\$HEAD_REPOSITORY" = "\$REPOSITORY" \]/);
    expect(gate).toMatch(/\.state == "open"/);
    expect(gate).toMatch(/\.head\.repo\.full_name == \$repository/);
    expect(gate).toMatch(/\.head\.sha == \$head_sha/);
    expect(gate).toMatch(/\^\[0-9a-f\]\{40\}\$/);
  });

  it("requires that head SHA's Validate run to have concluded success", () => {
    const gate = jobText(DEPLOY_TEST, "gate");
    expect(gate).toMatch(/head_sha=\$\{HEAD_SHA\}/);
    expect(gate).toMatch(/select\(\.name == "Validate"/);
    expect(gate).toMatch(/\[ "\$conclusion" = success \]/);
  });

  it("hands the guard to the promotion, and only to the promotion", () => {
    expect(asMapping(job(DEPLOY_TEST, "gate")["outputs"]!, "gate.outputs")["guard"]).toBe(
      "${{ steps.verify.outputs.guard }}",
    );
    expect(jobText(DEPLOY_TEST, "build")).not.toMatch(/guard/);
    expect(jobText(DEPLOY_TEST, "promote")).toMatch(/needs\.gate\.outputs\.guard/);
    expect(jobText(DEPLOY_TEST, "promote")).not.toMatch(/needs\.build\.outputs\.guard/);
  });
});

describe("the build holds no GitOps credential", () => {
  it("checks out the gated head SHA without persisting credentials", () => {
    const checkout = steps(DEPLOY_TEST, "build").find((step) =>
      typeof step["uses"] === "string" && step["uses"].startsWith("actions/checkout@"),
    );
    expect(checkout).toBeDefined();
    const withBlock = asMapping(checkout!["with"]!, "build checkout with");
    expect(withBlock["ref"]).toBe("${{ needs.gate.outputs.head_sha }}");
    expect(withBlock["persist-credentials"]).toBe("false");
  });

  it("never checks out or writes the deploys repository", () => {
    const build = jobText(DEPLOY_TEST, "build");
    expect(build).not.toMatch(/hannosirkel\/deploys/);
    expect(build).not.toMatch(/plepic\/overlays/);
  });

  it("builds and publishes both images with attestations", () => {
    const build = jobText(DEPLOY_TEST, "build");
    expect(build).toMatch(/--provenance=mode=min/);
    expect(build).toMatch(/--sbom=true/);
    expect(build).not.toMatch(/--provenance=false/);
    expect(build).toMatch(/ghcr\.io\/hannosirkel\/plepic-backend/);
    expect(build).toMatch(/ghcr\.io\/hannosirkel\/plepic-storefront/);
    expect(build).toMatch(/\^sha256:\[0-9a-f\]\{64\}\$/);
    const outputs = asMapping(job(DEPLOY_TEST, "build")["outputs"]!, "build.outputs");
    expect(Object.keys(outputs).sort()).toEqual(["backend_digest", "storefront_digest"]);
  });

  it("scans both published digests at CRITICAL before the promotion job", () => {
    const scanned = steps(DEPLOY_TEST, "build")
      .filter((step) => typeof step["uses"] === "string" && step["uses"].includes("trivy-action@"))
      .map((step) => asMapping(step["with"]!, "trivy with"));
    expect(scanned).toHaveLength(2);
    expect(scanned.map((scan) => scan["image-ref"])).toEqual([
      "ghcr.io/hannosirkel/plepic-backend@${{ steps.build.outputs.backend_digest }}",
      "ghcr.io/hannosirkel/plepic-storefront@${{ steps.build.outputs.storefront_digest }}",
    ]);
    for (const scan of scanned) {
      expect(scan["severity"]).toBe("CRITICAL");
      expect(scan["exit-code"]).toBe("1");
      expect(scan["ignore-unfixed"]).toBe("true");
      expect(scan["scanners"]).toBe("vuln");
    }
    expect(asSequence(job(DEPLOY_TEST, "promote")["needs"]!, "promote.needs")).toContain("build");
  });
});

/** The promote step that commits and pushes, as its shell source. */
function commitScript(name: string): string {
  const commit = steps(name, "promote")
    .map((step) => (typeof step["run"] === "string" ? step["run"] : ""))
    .find((run) => run.includes("git push"));
  expect(commit, `${name} promote has no step that pushes`).toBeDefined();
  return commit!;
}

describe("the promotion writes exactly one overlay", () => {
  it("re-verifies the pull request before spending the credential", () => {
    const recheck = jobText(DEPLOY_TEST, "recheck");
    expect(recheck).toMatch(/\.state == "open"/);
    expect(recheck).toMatch(/any\(\.labels\[\]; \.name == "deploy-test"\)/);
    expect(asSequence(job(DEPLOY_TEST, "promote")["needs"]!, "promote.needs")).toEqual([
      "gate",
      "build",
      "recheck",
    ]);
  });

  it("mints a token scoped to the deploys repository alone", () => {
    const promote = jobText(DEPLOY_TEST, "promote");
    expect(promote).toMatch(/"repositories":\["deploys"\]/);
    expect(promote).toMatch(/::add-mask::/);
    const checkouts = steps(DEPLOY_TEST, "promote").filter(
      (step) => typeof step["uses"] === "string" && step["uses"].startsWith("actions/checkout@"),
    );
    expect(checkouts, "promote checks out more than one tree").toHaveLength(1);
    const inputs = withBlock(checkouts[0]!, "promote checkout");
    expect(inputs["repository"]).toBe("hannosirkel/deploys");
    expect(inputs["path"]).toBe("gitops");
    expect(inputs["persist-credentials"]).toBe("false");
    expect(inputs["ref"]).toBeUndefined();
  });

  it("runs no head code in the job that holds the GitOps credential", () => {
    // The security claim in this workflow's own header and in README.md.
    // Checking the *first* checkout in the job proves nothing: a second one,
    // later in the same job, would put head-authored code on disk next to a
    // write token for hannosirkel/deploys. So every step is examined, and
    // examined for all three of the ways head code could arrive.
    const promoteSteps = steps(DEPLOY_TEST, "promote");
    for (const [index, step] of promoteSteps.entries()) {
      const path = `promote.steps[${index}]`;
      const action = step["uses"];
      if (action !== undefined) {
        expect(asScalar(action, `${path}.uses`), `${path} runs an action other than a checkout`)
          .toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
        expect(
          withBlock(step, path)["repository"],
          `${path} checks out something other than the GitOps repository`,
        ).toBe("hannosirkel/deploys");
      }
      expect(keysOf(step), `${path} names a revision to check out`).not.toContain("ref");
      for (const [key, value] of Object.entries(withBlock(step, path))) {
        expect(
          scalars(value).join("\n"),
          `${path}.with.${key} hands the head revision to an action`,
        ).not.toMatch(/head_sha/);
      }
    }
  });

  it("names the head revision only as an argument to git commit", () => {
    // The test above reads the declarative surface -- `uses`, any `ref`, and
    // every `with:` input. It does not read `run:` bodies, and `promote`'s
    // env carries `HEAD_SHA` so the commit message can record it. That gap
    // admits a step such as
    //
    //   run: git clone … && git -C head checkout "$HEAD_SHA" && bash head/hook.sh
    //
    // which is head-authored code executing in the one job that holds a write
    // token for hannosirkel/deploys, with every declarative assertion still
    // green. The head revision is a value this job *records*; it is never a
    // value this job acts on, so its only legitimate appearance in a script
    // is inside the `git commit -m` invocation.
    const offending: string[] = [];
    for (const [index, script] of jobScripts(DEPLOY_TEST, "promote")) {
      for (const command of commands(script)) {
        if (!/head_sha/i.test(command)) continue;
        if (/^git commit -m /.test(command)) continue;
        offending.push(`promote.steps[${index}]: ${command}`);
      }
    }
    expect(offending, "promote acts on the head revision outside its commit message")
      .toEqual([]);
  });

  it("brings no code into the job that holds the GitOps credential", () => {
    // The confinement above turns on the head SHA being named, and a clone of
    // the pull request's branch names no SHA at all. So the fetch itself is
    // refused: the only tree `promote` reads is the one `actions/checkout`
    // placed there from hannosirkel/deploys, and the only direction code
    // moves in this job is out. See `codeImportOffences`.
    expect(codeImportOffences(jobScripts(DEPLOY_TEST, "promote"))).toEqual([]);
  });

  it("runs the base-SHA guard against the test overlay with both digests", () => {
    const promote = jobText(DEPLOY_TEST, "promote");
    expect(promote).toMatch(
      /"\$guard" "\$BACKEND_DIGEST" "\$STOREFRONT_DIGEST" "\$GITHUB_WORKSPACE\/gitops\/plepic\/overlays\/test"/,
    );
    expect(promote).not.toMatch(/"\$guard".*plepic\/overlays\/live/);
  });

  it("stages, validates and commits only the test overlay", () => {
    const promote = jobText(DEPLOY_TEST, "promote");
    expect(promote).toMatch(/git add plepic\/overlays\/test\/kustomization\.yaml/);
    expect(promote).not.toMatch(/git add plepic\/overlays\/live\/kustomization\.yaml/);
    expect(promote).not.toMatch(/git add --all|git commit -a\b/);
    expect(promote).toMatch(
      /deploy\(test\): PR #\$\{PR_NUMBER\} \$\{HEAD_SHA\} \$\{BACKEND_DIGEST\} \$\{STOREFRONT_DIGEST\}/,
    );
    expect(promote).not.toMatch(/--force|git rebase/);
  });

  it("renders both overlays and runs the manifest tests before pushing", () => {
    const commit = commitScript(DEPLOY_TEST);
    const order = (needle: string): number => commit.indexOf(needle);
    const push = order("git push");
    for (const before of [
      "bash plepic/tests/manifests.sh",
      "kubectl kustomize plepic/overlays/live",
      "kubectl kustomize plepic/overlays/test",
      "git diff --check",
      "git diff --cached --check",
    ]) {
      expect(order(before), `${before} must run before git push`).toBeGreaterThanOrEqual(0);
      expect(order(before)).toBeLessThan(push);
    }
  });

  it("treats an already-recorded digest pair as nothing to promote", () => {
    // The message is not the behaviour: without the `exit 0` the script falls
    // through to `git commit`, which fails on an empty index and turns a
    // re-labelled pull request into a red run. Assert the early exit itself.
    const commit = commitScript(DEPLOY_TEST);
    expect(commit).toMatch(
      /if \[ -z "\$staged" \]; then\n\s+echo '[^']*nothing to promote'\n\s+exit 0\n\s*fi\n/,
    );
    expect(commit.indexOf("exit 0")).toBeLessThan(commit.indexOf("git commit"));
  });
});

describe("Deploy Test never reaches another application", () => {
  it("names no repository or overlay outside plepic and deploys", () => {
    const text = source(DEPLOY_TEST);
    expect(text).not.toMatch(/servitium/);
    expect(text).not.toMatch(/hannosirkel\/(?!deploys|plepic)/);
  });

  it("publishes no image and writes no overlay from the validation workflow", () => {
    const text = source("validate.yml");
    expect(text).not.toMatch(/pull_request_target/);
    expect(text).not.toMatch(/packages: write/);
    expect(text).not.toMatch(/update-gitops-digest/);
    expect(text).not.toMatch(/plepic\/overlays/);
  });
});

describe("the code-import ban itself", () => {
  // The ban is only as good as what it refuses and what it lets through, and
  // neither is observable from a workflow that happens to be written correctly.
  // These drive it with scripts this repository does not contain.

  /** One `run:` body, in the shape `codeImportOffences` reads. */
  function script(...lines: readonly string[]): Array<readonly [number, string]> {
    return [[0, lines.join("\n")] as const];
  }

  it("refuses a fetch written the way this repository writes git commands", () => {
    // The bypass the previous revision had. Its blacklist matched
    // `git\s+(?:clone|fetch|…)`, which requires the subcommand to follow `git`
    // immediately — so the `-C <path>` form walked past it, and `-C` is the
    // form the guard beside this file uses on every one of its git calls.
    expect(
      codeImportOffences(
        script('git -C gitops fetch origin "pull/1/head"', "git -C gitops checkout FETCH_HEAD"),
      ),
    ).toEqual([
      "steps[0] runs git fetch: git -C gitops fetch origin \"pull/1/head\"",
      "steps[0] runs git checkout: git -C gitops checkout FETCH_HEAD",
    ]);
  });

  it("accepts the git commands the promoting job actually runs", () => {
    expect(
      codeImportOffences(
        script(
          "git config user.name 'plepic-deployer[bot]'",
          "git -C gitops diff --check",
          "git add plepic/overlays/live/kustomization.yaml",
          'staged="$(git diff --cached --name-only)"',
          "git commit -m 'deploy(live): …'",
          'git push "https://x-access-token:${APP_TOKEN}@github.com/hannosirkel/deploys.git" HEAD:main',
        ),
      ),
    ).toEqual([]);
  });

  it("refuses a forbidden command hidden behind a shell operator", () => {
    expect(codeImportOffences(script("true && git clone https://example.test/x head"))).toEqual([
      "steps[0] runs git clone: git clone https://example.test/x head",
    ]);
  });

  it("does not fail a script for a comment that mentions a forbidden command", () => {
    // The over-reach the previous revision had. `promote` deliberately runs no
    // package manager, and saying so beside the script that does not run one
    // turned the file red.
    expect(
      codeImportOffences(
        script(
          "# This job installs nothing: no npm install, no docker build, no gh api.",
          "git diff --check",
        ),
      ),
    ).toEqual([]);
  });

  it("refuses an expression interpolated into a shell script", () => {
    // Driven directly, because no workflow in this repository contains one and
    // a rule with no failing case is a rule nothing has ever exercised. The
    // commit message is the example on purpose: it is head-controlled text
    // that reaches a workflow expression on every push.
    expect(
      interpolationOffences([["promote.steps[0]", "echo ${{ github.event.head_commit.message }}"]]),
    ).toEqual(["promote.steps[0]"]);
  });

  it("accepts the same value passed through env, which is how it is written here", () => {
    expect(interpolationOffences([["promote.steps[0]", 'echo "$COMMIT_MESSAGE"']])).toEqual([]);
  });
});

/**
 * `Release` runs on every push to `main`. Nothing about it is conditional and
 * nothing about it can be undone by removing a label: the merge is the
 * approval, and the digests it writes are the ones the live environment runs.
 */
describe("Release's trigger and concurrency", () => {
  it("fires only on a push to main", () => {
    const document = workflow(RELEASE);
    expect(document["name"]).toBe("Release");
    const on = asMapping(document["on"]!, "on");
    expect(Object.keys(on)).toEqual(["push"]);
    expect(asSequence(asMapping(on["push"]!, "push")["branches"]!, "branches")).toEqual(["main"]);
  });

  it("shares one non-cancelling GitOps promotion lane with Deploy Test", () => {
    const concurrency = asMapping(workflow(RELEASE)["concurrency"]!, "concurrency");
    expect(concurrency["group"]).toBe("plepic-gitops-promotion");
    expect(concurrency["cancel-in-progress"]).toBe("false");
    // Not merely equal to a string: equal to the *other* workflow's, because
    // the point of the group is that the two never write `deploys` at once.
    expect(concurrency["group"]).toBe(
      asMapping(workflow(DEPLOY_TEST)["concurrency"]!, "concurrency")["group"],
    );
  });

  it("grants the workflow no permissions by default", () => {
    expect(asMapping(workflow(RELEASE)["permissions"]!, "permissions")).toEqual({});
  });
});

describe("Release's job permissions", () => {
  const expected: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["validate", { contents: "read" }],
    ["gate", { contents: "read" }],
    ["build", { contents: "read", packages: "write" }],
    ["promote", {}],
  ];

  it("declares exactly these four jobs", () => {
    expect(Object.keys(jobs(RELEASE))).toEqual(expected.map(([id]) => id));
  });

  for (const [id, permissions] of expected) {
    it(`gives ${id} exactly ${JSON.stringify(permissions)}`, () => {
      expect(asMapping(job(RELEASE, id)["permissions"]!, `${id}.permissions`)).toEqual(permissions);
    });
  }

  it("scopes the deployer credential to the promote job's live environment", () => {
    for (const id of ["validate", "gate", "build"]) {
      expect(job(RELEASE, id)["environment"]).toBeUndefined();
      expect(jobText(RELEASE, id)).not.toMatch(/PLEPIC_DEPLOYER_/);
    }
    expect(job(RELEASE, "promote")["environment"]).toBe("live");
    expect(jobText(RELEASE, "promote")).toMatch(/PLEPIC_DEPLOYER_CLIENT_ID/);
    expect(jobText(RELEASE, "promote")).toMatch(/PLEPIC_DEPLOYER_PRIVATE_KEY/);
  });
});

describe("Release validates and builds before it promotes", () => {
  it("runs the canonical validation on the pushed revision", () => {
    const validate = jobText(RELEASE, "validate");
    expect(validate).toMatch(/npm ci/);
    expect(validate).toMatch(/bash scripts\/validate/);
    for (const id of ["build", "promote"]) {
      expect(asSequence(job(RELEASE, id)["needs"]!, `${id}.needs`)).toContain("validate");
    }
  });

  it("reads the digest guard from the pushed SHA, checking nothing out to do it", () => {
    for (const step of steps(RELEASE, "gate")) {
      expect(step["uses"]).toBeUndefined();
    }
    const gate = jobText(RELEASE, "gate");
    expect(gate).toMatch(/github\.sha/);
    expect(gate).toMatch(/contents\/scripts\/update-gitops-digest\.sh\?ref=\$\{SOURCE_SHA\}/);
    expect(gate).toMatch(/grep -qx '#!\/bin\/sh'/);
    expect(gate).toMatch(/\^\[0-9a-f\]\{40\}\$/);
    expect(asMapping(job(RELEASE, "gate")["outputs"]!, "gate.outputs")["guard"]).toBe(
      "${{ steps.verify.outputs.guard }}",
    );
    expect(jobText(RELEASE, "build")).not.toMatch(/guard/);
    expect(jobText(RELEASE, "promote")).toMatch(/needs\.gate\.outputs\.guard/);
  });

  it("builds and publishes both images with attestations, and no build argument", () => {
    const build = jobText(RELEASE, "build");
    expect(build).toMatch(/--provenance=mode=min/);
    expect(build).toMatch(/--sbom=true/);
    expect(build).not.toMatch(/--provenance=false/);
    expect(build).toMatch(/ghcr\.io\/hannosirkel\/plepic-backend/);
    expect(build).toMatch(/ghcr\.io\/hannosirkel\/plepic-storefront/);
    expect(build).toMatch(/\^sha256:\[0-9a-f\]\{64\}\$/);
    // The images serve either environment, so nothing may be handed to a
    // build. `--build-arg` at all is the check, because a build argument is
    // the only way a value reaches `docker buildx build` from outside.
    expect(source(RELEASE)).not.toMatch(/--build-arg|NEXT_PUBLIC_/);
    const outputs = asMapping(job(RELEASE, "build")["outputs"]!, "build.outputs");
    expect(Object.keys(outputs).sort()).toEqual(["backend_digest", "storefront_digest"]);
  });

  it("scans both published digests at CRITICAL before the promotion job", () => {
    const scanned = steps(RELEASE, "build")
      .filter((step) => typeof step["uses"] === "string" && step["uses"].includes("trivy-action@"))
      .map((step) => asMapping(step["with"]!, "trivy with"));
    expect(scanned).toHaveLength(2);
    expect(scanned.map((scan) => scan["image-ref"])).toEqual([
      "ghcr.io/hannosirkel/plepic-backend@${{ steps.build.outputs.backend_digest }}",
      "ghcr.io/hannosirkel/plepic-storefront@${{ steps.build.outputs.storefront_digest }}",
    ]);
    for (const scan of scanned) {
      expect(scan["severity"]).toBe("CRITICAL");
      expect(scan["exit-code"]).toBe("1");
      expect(scan["ignore-unfixed"]).toBe("true");
      expect(scan["scanners"]).toBe("vuln");
    }
    expect(asSequence(job(RELEASE, "promote")["needs"]!, "promote.needs")).toEqual([
      "validate",
      "gate",
      "build",
    ]);
  });
});

describe("Release promotes exactly one overlay, and it is live", () => {
  it("mints a token scoped to the deploys repository alone", () => {
    const promote = jobText(RELEASE, "promote");
    expect(promote).toMatch(/"repositories":\["deploys"\]/);
    expect(promote).toMatch(/::add-mask::/);
    const checkouts = steps(RELEASE, "promote").filter(
      (step) => typeof step["uses"] === "string" && step["uses"].startsWith("actions/checkout@"),
    );
    expect(checkouts, "promote checks out more than one tree").toHaveLength(1);
    const inputs = withBlock(checkouts[0]!, "promote checkout");
    expect(inputs["repository"]).toBe("hannosirkel/deploys");
    expect(inputs["path"]).toBe("gitops");
    expect(inputs["persist-credentials"]).toBe("false");
    expect(inputs["ref"]).toBeUndefined();
  });

  it("runs no repository code in the job that holds the GitOps credential", () => {
    for (const [index, step] of steps(RELEASE, "promote").entries()) {
      const path = `promote.steps[${index}]`;
      const action = step["uses"];
      if (action !== undefined) {
        expect(asScalar(action, `${path}.uses`), `${path} runs an action other than a checkout`)
          .toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
        expect(
          withBlock(step, path)["repository"],
          `${path} checks out something other than the GitOps repository`,
        ).toBe("hannosirkel/deploys");
      }
      expect(keysOf(step), `${path} names a revision to check out`).not.toContain("ref");
      for (const [key, value] of Object.entries(withBlock(step, path))) {
        expect(
          scalars(value).join("\n"),
          `${path}.with.${key} hands the built revision to an action`,
        ).not.toMatch(/source_sha/);
      }
    }
  });

  it("names the source revision only as an argument to git commit", () => {
    // The same confinement `Deploy Test` gets, for the same reason: the source
    // SHA is a value this job *records*, never one it acts on. A `git checkout
    // "$SOURCE_SHA"` here would be repository code executing beside a write
    // token for hannosirkel/deploys.
    const offending: string[] = [];
    for (const [index, script] of jobScripts(RELEASE, "promote")) {
      for (const command of commands(script)) {
        if (!/source_sha/i.test(command)) continue;
        if (/^git commit -m /.test(command)) continue;
        offending.push(`promote.steps[${index}]: ${command}`);
      }
    }
    expect(offending, "promote acts on the source revision outside its commit message").toEqual([]);
  });

  it("brings no code into the job that holds the GitOps credential", () => {
    expect(codeImportOffences(jobScripts(RELEASE, "promote"))).toEqual([]);
  });

  it("runs the guard against the live overlay with both digests", () => {
    const promote = jobText(RELEASE, "promote");
    expect(promote).toMatch(
      /"\$guard" "\$BACKEND_DIGEST" "\$STOREFRONT_DIGEST" "\$GITHUB_WORKSPACE\/gitops\/plepic\/overlays\/live"/,
    );
    expect(promote).not.toMatch(/"\$guard".*plepic\/overlays\/test/);
  });

  it("stages, validates and commits only the live overlay", () => {
    const promote = jobText(RELEASE, "promote");
    expect(promote).toMatch(/git add plepic\/overlays\/live\/kustomization\.yaml/);
    expect(promote).not.toMatch(/git add plepic\/overlays\/test\/kustomization\.yaml/);
    expect(promote).not.toMatch(/git add --all|git commit -a\b/);
    expect(promote).not.toMatch(/--force|git rebase/);
  });

  it("records the source SHA and both digests in the commit message", () => {
    expect(jobText(RELEASE, "promote")).toMatch(
      /deploy\(live\): \$\{SOURCE_SHA\} \$\{BACKEND_DIGEST\} \$\{STOREFRONT_DIGEST\}/,
    );
  });

  it("runs the guard before anything is staged, and both renders before the push", () => {
    const commit = commitScript(RELEASE);
    const order = (needle: string): number => commit.indexOf(needle);
    const push = order("git push");
    for (const before of [
      "bash plepic/tests/manifests.sh",
      "kubectl kustomize plepic/overlays/live",
      "kubectl kustomize plepic/overlays/test",
      "git diff --check",
      "git diff --cached --check",
    ]) {
      expect(order(before), `${before} must run before git push`).toBeGreaterThanOrEqual(0);
      expect(order(before)).toBeLessThan(push);
    }

    // The guard writes the digest lines, so it has to be a step *earlier* than
    // the one that stages them — a guard that ran after `git add` would be
    // checking a file the index no longer reflects.
    const scripts = jobScripts(RELEASE, "promote");
    const guardStep = scripts.find(([, body]) => body.includes('"$guard" "$BACKEND_DIGEST"'));
    const commitStep = scripts.find(([, body]) => body.includes("git push"));
    expect(guardStep, "promote never runs the guard").toBeDefined();
    expect(guardStep![0]).toBeLessThan(commitStep![0]);
  });

  it("treats an already-recorded digest pair as nothing to promote", () => {
    const commit = commitScript(RELEASE);
    expect(commit).toMatch(
      /if \[ -z "\$staged" \]; then\n\s+echo '[^']*nothing to promote'\n\s+exit 0\n\s*fi\n/,
    );
    expect(commit.indexOf("exit 0")).toBeLessThan(commit.indexOf("git commit"));
  });

  it("names no repository or overlay outside plepic and deploys", () => {
    const text = source(RELEASE);
    expect(text).not.toMatch(/servitium/);
    expect(text).not.toMatch(/hannosirkel\/(?!deploys|plepic)/);
  });
});
