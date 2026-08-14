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

/** Each pinned `uses:` reference paired with the comment line above it. */
function pinAnnotations(name: string): Array<readonly [string, string]> {
  const lines = source(name).split("\n");
  return lines.flatMap((line, index) => {
    const reference = /^\s*uses:\s*(\S+)/.exec(line)?.[1];
    if (reference === undefined) return [];
    const previous = lines[index - 1] ?? "";
    const comment = /^\s*#\s*(.*)$/.exec(previous)?.[1];
    expect(comment, `${name}:${index + 1} pins ${reference} with no comment saying what it is`)
      .toBeDefined();
    return [[reference, comment!] as const];
  });
}

const DEPLOY_TEST = "deploy-test.yml";

describe("every workflow in this repository", () => {
  const names = readdirSync(workflowDirectory).filter((entry) => entry.endsWith(".yml"));

  it("includes the validation and the test-promotion workflows", () => {
    expect(names).toContain("validate.yml");
    expect(names).toContain(DEPLOY_TEST);
  });

  for (const name of names) {
    it(`${name} pins every action to a 40-character commit SHA`, () => {
      // Read from the parsed document, not from the source. A line-anchored
      // `uses:\s*(\S+)$` cannot match a line carrying a trailing comment --
      // which GitHub Actions accepts -- so `uses: x@main # pinned` was never
      // collected and never checked. The parser keeps the comment in the
      // value, which is what makes it fail the pin pattern below.
      const references = usesReferences(workflow(name));
      expect(references.length).toBeGreaterThan(0);
      // Every `uses:` in the file must be one of the references checked: a
      // reference the traversal cannot reach is a reference nothing pins.
      expect(references.length).toBe([...source(name).matchAll(/^\s*uses:/gm)].length);
      for (const reference of references) {
        expect(reference, `${name} does not pin ${reference}`).toMatch(
          /^[^@\s]+@[0-9a-f]{40}$/,
        );
      }
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

describe("the promotion writes exactly one overlay", () => {
  /** The promote step that commits and pushes, as its shell source. */
  function commitScript(): string {
    const commit = steps(DEPLOY_TEST, "promote")
      .map((step) => (typeof step["run"] === "string" ? step["run"] : ""))
      .find((run) => run.includes("git push"));
    expect(commit, "promote has no step that pushes").toBeDefined();
    return commit!;
  }

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
    const commit = commitScript();
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
    const commit = commitScript();
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
