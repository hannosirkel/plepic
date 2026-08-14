import { spawnSync } from "node:child_process";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The digest guard is the only thing standing between a `pull_request_target`
 * job holding a GitOps write token and the deploys repository. Its refusals
 * are the deliverable, so every one of them is exercised here against a real
 * Git fixture rather than asserted in prose.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const guard = join(repoRoot, "scripts", "update-gitops-digest.sh");

const BACKEND_IMAGE = "ghcr.io/hannosirkel/plepic-backend";
const STOREFRONT_IMAGE = "ghcr.io/hannosirkel/plepic-storefront";

const SENTINEL = `sha256:${"0".repeat(64)}`;
const BACKEND_DIGEST = `sha256:${"a".repeat(64)}`;
const STOREFRONT_DIGEST = `sha256:${"b".repeat(64)}`;

const HEADER = [
  "---",
  "apiVersion: kustomize.config.k8s.io/v1beta1",
  "kind: Kustomization",
  "namespace: plepic-test",
  "nameSuffix: -test",
  "resources:",
  "  - ../../base",
  "images:",
].join("\n");

const TRAILER = [
  "patches:",
  "  - target:",
  "      kind: Service",
  "      name: plepic-storefront",
  "    patch: |-",
  "      - op: replace",
  "        path: /spec/ports/0/port",
  "        value: 8111",
  "",
].join("\n");

function imageBlock(name: string, digest: string): string {
  return [`  - name: ${name}`, `    newName: ${name}`, `    digest: ${digest}`].join("\n");
}

function kustomization(backend: string = SENTINEL, storefront: string = SENTINEL): string {
  return [
    HEADER,
    imageBlock(BACKEND_IMAGE, backend),
    imageBlock(STOREFRONT_IMAGE, storefront),
    TRAILER,
  ].join("\n");
}

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "plepic-gitops-guard-"));
  roots.push(root);
  return root;
}

function git(repository: string, ...args: string[]): void {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

interface FixtureOptions {
  /** Extra overlay directories to create and commit, relative to the repository. */
  readonly extraOverlays?: readonly string[];
  /** Replacement content for `plepic/overlays/test/kustomization.yaml`. */
  readonly testOverlayContent?: string;
}

/** Creates a committed, clean Git worktree shaped like `hannosirkel/deploys`. */
function fixture(options: FixtureOptions = {}): string {
  const repository = join(makeRoot(), "deploys");
  const overlays = [
    "plepic/overlays/live",
    "plepic/overlays/test",
    ...(options.extraOverlays ?? []),
  ];
  for (const overlay of overlays) {
    const directory = join(repository, overlay);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "kustomization.yaml"), kustomization());
  }
  if (options.testOverlayContent !== undefined) {
    writeFileSync(
      join(repository, "plepic/overlays/test/kustomization.yaml"),
      options.testOverlayContent,
    );
  }
  git(repository, "init", "--quiet", "--initial-branch=main");
  git(repository, "config", "user.name", "fixture");
  git(repository, "config", "user.email", "fixture@example.invalid");
  git(repository, "config", "commit.gpgsign", "false");
  git(repository, "add", "--all");
  git(repository, "commit", "--quiet", "-m", "fixture");
  return repository;
}

function run(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("sh", [guard, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function overlayFile(repository: string, overlay: string): string {
  return readFileSync(join(repository, overlay, "kustomization.yaml"), "utf8");
}

function porcelain(repository: string): string {
  const result = spawnSync("git", ["-C", repository, "status", "--porcelain"], {
    encoding: "utf8",
  });
  return result.stdout;
}

function numstat(repository: string): string {
  const result = spawnSync("git", ["-C", repository, "diff", "--numstat"], {
    encoding: "utf8",
  });
  return result.stdout.trim();
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("the guard's shape", () => {
  it("is a POSIX shell script allowlisting only this application's overlays", () => {
    const source = readFileSync(guard, "utf8");
    expect(source.split("\n")[0]).toBe("#!/bin/sh");
    expect(source).toMatch(/^ {2}plepic\/overlays\/live\|plepic\/overlays\/test\) ;;$/m);
    expect(source).not.toMatch(/servitium/);
  });
});

describe("the success path", () => {
  it("writes both digests and leaves every other byte alone", () => {
    const repository = fixture();
    const before = overlayFile(repository, "plepic/overlays/test");
    const mode = statSync(join(repository, "plepic/overlays/test/kustomization.yaml")).mode;

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(
      kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST),
    );
    expect(before).toBe(kustomization());
    expect(numstat(repository)).toBe("2\t2\tplepic/overlays/test/kustomization.yaml");
    expect(statSync(join(repository, "plepic/overlays/test/kustomization.yaml")).mode).toBe(mode);
  });

  it("leaves the live overlay untouched when writing the test overlay", () => {
    const repository = fixture();

    expect(
      run(BACKEND_DIGEST, STOREFRONT_DIGEST, join(repository, "plepic/overlays/test")).status,
    ).toBe(0);

    expect(overlayFile(repository, "plepic/overlays/live")).toBe(kustomization());
    expect(porcelain(repository)).toBe(" M plepic/overlays/test/kustomization.yaml\n");
  });

  it("accepts the live overlay too", () => {
    const repository = fixture();

    expect(
      run(BACKEND_DIGEST, STOREFRONT_DIGEST, join(repository, "plepic/overlays/live")).status,
    ).toBe(0);

    expect(overlayFile(repository, "plepic/overlays/live")).toBe(
      kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST),
    );
  });

  it("changes only the image whose digest moved", () => {
    const repository = fixture({
      testOverlayContent: kustomization(BACKEND_DIGEST, SENTINEL),
    });

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).toBe(0);
    expect(numstat(repository)).toBe("1\t1\tplepic/overlays/test/kustomization.yaml");
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(
      kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST),
    );
  });

  it("is a no-op when re-run with the same digests", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");

    expect(run(BACKEND_DIGEST, STOREFRONT_DIGEST, overlay).status).toBe(0);
    git(repository, "add", "--all");
    git(repository, "commit", "--quiet", "-m", "promote");
    const promoted = overlayFile(repository, "plepic/overlays/test");

    const rerun = run(BACKEND_DIGEST, STOREFRONT_DIGEST, overlay);

    expect(rerun.stderr).toBe("");
    expect(rerun.status).toBe(0);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(promoted);
    expect(porcelain(repository)).toBe("");
  });

  it("leaves no temporary files behind", () => {
    const repository = fixture();

    expect(
      run(BACKEND_DIGEST, STOREFRONT_DIGEST, join(repository, "plepic/overlays/test")).status,
    ).toBe(0);

    expect(porcelain(repository)).toBe(" M plepic/overlays/test/kustomization.yaml\n");
  });
});

describe("malformed digests", () => {
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ["too short", `sha256:${"a".repeat(63)}`],
    ["too long", `sha256:${"a".repeat(65)}`],
    ["out of charset", `sha256:${"g".repeat(64)}`],
    ["uppercase", `sha256:${"A".repeat(64)}`],
    ["missing prefix", "a".repeat(64)],
    ["wrong algorithm", `sha512:${"a".repeat(64)}`],
    ["empty", ""],
    ["shell metacharacters", `sha256:${"a".repeat(57)}; id`],
  ];

  for (const [label, digest] of rejected) {
    it(`refuses a ${label} backend digest`, () => {
      const repository = fixture();

      const result = run(digest, STOREFRONT_DIGEST, join(repository, "plepic/overlays/test"));

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/malformed digest/);
      expect(overlayFile(repository, "plepic/overlays/test")).toBe(kustomization());
    });

    it(`refuses a ${label} storefront digest while the backend digest is valid`, () => {
      const repository = fixture();

      const result = run(BACKEND_DIGEST, digest, join(repository, "plepic/overlays/test"));

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/malformed digest/);
      expect(overlayFile(repository, "plepic/overlays/test")).toBe(kustomization());
      expect(porcelain(repository)).toBe("");
    });
  }

  it("refuses the wrong number of arguments", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");

    for (const args of [
      [BACKEND_DIGEST, overlay],
      [BACKEND_DIGEST, STOREFRONT_DIGEST],
      [BACKEND_DIGEST, STOREFRONT_DIGEST, overlay, "extra"],
      [],
    ]) {
      const result = run(...args);
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/usage:/);
    }
    expect(porcelain(repository)).toBe("");
  });
});

describe("linked and replaced kustomizations", () => {
  it("refuses a symlinked kustomization", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");
    renameSync(join(overlay, "kustomization.yaml"), join(overlay, "kustomization-target.yaml"));
    symlinkSync("kustomization-target.yaml", join(overlay, "kustomization.yaml"));
    git(repository, "add", "--all");
    git(repository, "commit", "--quiet", "-m", "symlink");

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, overlay);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/kustomization is unavailable/);
    expect(readFileSync(join(overlay, "kustomization-target.yaml"), "utf8")).toBe(kustomization());
  });

  it("refuses a hard-linked kustomization without touching the other link", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");
    const outside = join(dirname(repository), "hardlink-target.yaml");
    linkSync(join(overlay, "kustomization.yaml"), outside);

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, overlay);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/must not be hard-linked/);
    expect(readFileSync(outside, "utf8")).toBe(kustomization());
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(kustomization());
  });

  it("refuses a missing kustomization", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");
    rmSync(join(overlay, "kustomization.yaml"));

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, overlay);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/kustomization is unavailable/);
  });
});

describe("overlays outside the worktree", () => {
  it("refuses a directory that is not in a Git worktree", () => {
    const outside = join(makeRoot(), "plepic/overlays/test");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "kustomization.yaml"), kustomization());

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, outside);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/not in a Git worktree/);
    expect(readFileSync(join(outside, "kustomization.yaml"), "utf8")).toBe(kustomization());
  });

  it("refuses a directory that does not exist", () => {
    const repository = fixture();

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/absent"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/overlay is unavailable/);
  });

  it("refuses a `..` traversal that lands outside any Git worktree", () => {
    // Four levels up from the overlay is the temporary directory holding the
    // fixture, so this is the not-a-worktree refusal reached by traversal --
    // `/digest update rejected: /` matched every refusal the guard has, and
    // so could not tell which one had fired, or that one had fired at all.
    const repository = fixture();
    const escape = join(repository, "plepic/overlays/test", "..", "..", "..", "..");

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, escape);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/digest update rejected: overlay is not in a Git worktree/);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(kustomization());
    expect(porcelain(repository)).toBe("");
  });

  it("refuses a `..` traversal back to the worktree root", () => {
    // The worktree-escape branch proper: a path that resolves inside a Git
    // worktree but not underneath its top level.
    const repository = fixture();
    const escape = join(repository, "plepic/overlays/test", "..", "..", "..");

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, escape);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/digest update rejected: overlay is outside its Git worktree/);
    expect(porcelain(repository)).toBe("");
  });

  it("resolves `..` before consulting the allowlist", () => {
    const repository = fixture({ extraOverlays: ["otherapp/overlays/test"] });
    const traversal = join(
      repository,
      "plepic/overlays/live",
      "..",
      "..",
      "..",
      "otherapp/overlays/test",
    );

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, traversal);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/overlay is not permitted/);
    expect(overlayFile(repository, "otherapp/overlays/test")).toBe(kustomization());
    expect(porcelain(repository)).toBe("");
  });
});

describe("the overlay allowlist", () => {
  const forbidden = [
    "servitium/overlays/live",
    "servitium/overlays/test",
    "plepic/overlays/preview",
    "plepic/base",
    "overlays/test",
    "otherapp/overlays/test",
  ];

  for (const overlay of forbidden) {
    it(`refuses ${overlay}`, () => {
      const repository = fixture({ extraOverlays: [overlay] });

      const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, join(repository, overlay));

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/overlay is not permitted/);
      expect(overlayFile(repository, overlay)).toBe(kustomization());
      expect(porcelain(repository)).toBe("");
    });
  }

  it("refuses the repository root", () => {
    const repository = fixture();
    writeFileSync(join(repository, "kustomization.yaml"), kustomization());
    git(repository, "add", "--all");
    git(repository, "commit", "--quiet", "-m", "root kustomization");

    const result = run(BACKEND_DIGEST, STOREFRONT_DIGEST, repository);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/overlay is outside its Git worktree/);
    expect(readFileSync(join(repository, "kustomization.yaml"), "utf8")).toBe(kustomization());
  });
});

describe("a dirty checkout", () => {
  it("refuses when an unrelated tracked file is modified", () => {
    const repository = fixture();
    writeFileSync(join(repository, "plepic/overlays/live/kustomization.yaml"), "tampered\n");

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/checkout is not clean/);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(kustomization());
  });

  it("refuses when an untracked file is present", () => {
    const repository = fixture();
    writeFileSync(join(repository, "unexpected.txt"), "untracked\n");

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/checkout is not clean/);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(kustomization());
  });
});

describe("malformed overlays", () => {
  it("refuses an overlay carrying only one image", () => {
    const repository = fixture({
      testOverlayContent: [HEADER, imageBlock(BACKEND_IMAGE, SENTINEL), TRAILER].join("\n"),
    });

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/expected one digest per image/);
    expect(porcelain(repository)).toBe("");
  });

  it("refuses an overlay carrying a duplicated image entry", () => {
    const repository = fixture({
      testOverlayContent: [
        HEADER,
        imageBlock(BACKEND_IMAGE, SENTINEL),
        imageBlock(BACKEND_IMAGE, SENTINEL),
        TRAILER,
      ].join("\n"),
    });
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/expected one image entry/);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(before);
    expect(porcelain(repository)).toBe("");
  });

  it("refuses an overlay carrying a third digest line", () => {
    const repository = fixture({
      testOverlayContent: [
        HEADER,
        imageBlock(BACKEND_IMAGE, SENTINEL),
        imageBlock(STOREFRONT_IMAGE, SENTINEL),
        imageBlock("ghcr.io/hannosirkel/plepic-worker", SENTINEL),
        TRAILER,
      ].join("\n"),
    });

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/expected one digest per image/);
    expect(porcelain(repository)).toBe("");
  });

  it("refuses an overlay naming an unknown image", () => {
    const repository = fixture({
      testOverlayContent: [
        HEADER,
        imageBlock(BACKEND_IMAGE, SENTINEL),
        imageBlock("ghcr.io/hannosirkel/plepic-worker", SENTINEL),
        TRAILER,
      ].join("\n"),
    });

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/expected one image entry/);
    expect(porcelain(repository)).toBe("");
  });

  it("refuses an overlay whose image block has no digest line", () => {
    const repository = fixture({
      testOverlayContent: [
        HEADER,
        `  - name: ${BACKEND_IMAGE}`,
        `    newName: ${BACKEND_IMAGE}`,
        imageBlock(STOREFRONT_IMAGE, SENTINEL),
        TRAILER,
      ].join("\n"),
    });

    const result = run(
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/expected one digest per image/);
    expect(porcelain(repository)).toBe("");
  });
});

describe("the post-write integrity checks", () => {
  /**
   * The guard's own rewriter only ever produces two well-formed digest lines,
   * so from the outside its post-write checks can never be reached: the input
   * that would trip them cannot be expressed. They are reached here by
   * replacing the rewriter -- `node - ORIGINAL CANDIDATE BACKEND STOREFRONT`,
   * the first heredoc -- with a stub that writes chosen bytes and reports a
   * chosen count. Every other `node` call, including the final exactness
   * verification, reaches the real interpreter.
   *
   * That leaves the checks between lines 237 and 326 as the only thing
   * standing between a hostile rewrite and a push to hannosirkel/deploys,
   * which is what they exist for. Delete any one of them and one of these
   * tests goes red.
   */
  interface RewriterStub {
    /** The exact bytes the stubbed rewriter writes to the candidate file. */
    readonly candidate: string;
    /** The number of moved digest lines it claims to have written. */
    readonly changedCount: string;
    /**
     * A tracked file the stubbed rewriter also writes, and its contents. The
     * dirty-checkout refusal runs before the rewriter, so a file that moves
     * *during* the rewrite is the only out-of-band tampering the checks after
     * it can still see.
     */
    readonly tamper?: { readonly file: string; readonly content: string };
  }

  function runWithStubbedRewriter(
    stub: RewriterStub,
    ...args: string[]
  ): { status: number | null; stdout: string; stderr: string } {
    const staging = makeRoot();
    const candidate = join(staging, "candidate.yaml");
    writeFileSync(candidate, stub.candidate);
    const tamperContent = join(staging, "tamper.yaml");
    writeFileSync(tamperContent, stub.tamper?.content ?? "");
    const shim = join(staging, "node");
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        '# `node - ORIGINAL CANDIDATE BACKEND STOREFRONT` is the rewriter; the',
        '# four-argument form is the final verification, and passes through.',
        'if [ "$#" -eq 5 ] && [ "$1" = "-" ]; then',
        '  cat "$GITOPS_STUB_CANDIDATE" >"$3"',
        '  if [ -n "$GITOPS_STUB_TAMPER_TARGET" ]; then',
        '    cat "$GITOPS_STUB_TAMPER_CONTENT" >"$GITOPS_STUB_TAMPER_TARGET"',
        "  fi",
        '  printf "%s" "$GITOPS_STUB_CHANGED_COUNT"',
        "  exit 0",
        "fi",
        'exec "$GITOPS_REAL_NODE" "$@"',
        "",
      ].join("\n"),
    );
    chmodSync(shim, 0o755);
    const realNode = spawnSync("/bin/sh", ["-c", "command -v node"], {
      encoding: "utf8",
    }).stdout.trim();

    const result = spawnSync("sh", [guard, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${staging}:${process.env["PATH"] ?? ""}`,
        GITOPS_REAL_NODE: realNode,
        GITOPS_STUB_CANDIDATE: candidate,
        GITOPS_STUB_CHANGED_COUNT: stub.changedCount,
        GITOPS_STUB_TAMPER_TARGET: stub.tamper?.file ?? "",
        GITOPS_STUB_TAMPER_CONTENT: tamperContent,
      },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  /** Every one of these must leave the deploys checkout exactly as found. */
  function expectUntouched(repository: string, before: string): void {
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(before);
    expect(overlayFile(repository, "plepic/overlays/live")).toBe(kustomization());
    expect(porcelain(repository)).toBe("");
  }

  it("refuses a rewrite that claims to have moved more lines than there are", () => {
    const repository = fixture();
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = runWithStubbedRewriter(
      { candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST), changedCount: "12" },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unexpected update count/);
    expectUntouched(repository, before);
  });

  it("refuses a rewrite that introduces trailing whitespace", () => {
    const repository = fixture();
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = runWithStubbedRewriter(
      {
        candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST).replace(
          `digest: ${STOREFRONT_DIGEST}`,
          `digest: ${STOREFRONT_DIGEST} `,
        ),
        changedCount: "2",
      },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/trailing whitespace/);
    expectUntouched(repository, before);
  });

  it("refuses a rewrite whose diff is a different size from the count it reported", () => {
    const repository = fixture();
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = runWithStubbedRewriter(
      { candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST), changedCount: "1" },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unexpected diff size/);
    expectUntouched(repository, before);
  });

  it("refuses a rewrite whose changed lines do not all reach the diff", () => {
    // The changed-line count and the diff size are close relatives, and this
    // is the gap between them: `grep -Ev '^(---|\+\+\+)'` drops the removal
    // of a line that is itself `---`, because the diff renders it `----`.
    // The document separator therefore vanishes from the counted lines while
    // still being counted by `--numstat`, and only the changed-line check is
    // left to notice that the header was rewritten.
    const repository = fixture({
      testOverlayContent: kustomization(BACKEND_DIGEST, SENTINEL),
    });
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = runWithStubbedRewriter(
      {
        candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST).replace(
          /^---$/m,
          "--- # tampered",
        ),
        changedCount: "2",
      },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unexpected changed lines/);
    expectUntouched(repository, before);
  });

  it("refuses a rewrite that changes a line other than a digest line", () => {
    // Both digests land exactly as asked, so the final verification passes;
    // the namespace does not, and nothing but this check ever looks at it.
    const repository = fixture({
      testOverlayContent: kustomization(BACKEND_DIGEST, SENTINEL),
    });
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = runWithStubbedRewriter(
      {
        candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST).replace(
          "namespace: plepic-test",
          "namespace: plepic-live",
        ),
        changedCount: "2",
      },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/non-digest line changed/);
    expectUntouched(repository, before);
  });

  it("refuses a rewrite that records a digest nobody asked for", () => {
    // Two digest lines, two changed lines, a diff of exactly the expected
    // size -- and the backend image now pinned to an unrelated digest. Only
    // the closing verification reads what was actually written.
    const repository = fixture();
    const before = overlayFile(repository, "plepic/overlays/test");
    const substituted = `sha256:${"c".repeat(64)}`;

    const result = runWithStubbedRewriter(
      { candidate: kustomization(substituted, STOREFRONT_DIGEST), changedCount: "2" },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/replacement was not exact/);
    expectUntouched(repository, before);
  });

  // `changed_count == 0` is the re-promotion path: the overlay already
  // records both digests, so the guard writes nothing and exits successfully.
  // It is the quietest branch in the script and the two refusals guarding it
  // were the only ones with no test. Neither can produce a bad write here --
  // the candidate is never moved into place on this path -- so what they
  // actually protect is the claim that a no-op run is a no-op, and that a
  // deploys checkout which moved under the guard is reported rather than
  // shrugged off.

  it("refuses an unchanged update that rewrote the kustomization anyway", () => {
    // A rewriter reporting no change must produce bytes identical to what is
    // already on disk. Different bytes and a count of zero is a contradiction:
    // one of the two is a lie, and the guard cannot tell which.
    const repository = fixture({
      testOverlayContent: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST),
    });
    const before = overlayFile(repository, "plepic/overlays/test");

    const result = runWithStubbedRewriter(
      {
        candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST).replace(
          "namespace: plepic-test",
          "namespace: plepic-live",
        ),
        changedCount: "0",
      },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(
      /digest update rejected: unchanged update rewrote the kustomization/,
    );
    expectUntouched(repository, before);
  });

  it("refuses an unchanged update that modified a tracked file", () => {
    // The one check on this path that never looks at the candidate. The
    // checkout was clean when the guard inspected it, so a tracked file that
    // has moved by the time the rewriter returns moved during the rewrite --
    // and a no-op run that leaves the deploys checkout dirty would hand the
    // next step a change nobody asked for.
    const repository = fixture({
      testOverlayContent: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST),
    });
    const before = overlayFile(repository, "plepic/overlays/test");
    const live = join(repository, "plepic/overlays/live/kustomization.yaml");

    const result = runWithStubbedRewriter(
      {
        candidate: before,
        changedCount: "0",
        tamper: { file: live, content: "tampered\n" },
      },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(
      /digest update rejected: unchanged update modified a tracked file/,
    );
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(before);
    expect(readFileSync(live, "utf8")).toBe("tampered\n");
  });

  it("still promotes normally when the rewriter writes what it should", () => {
    // The stub is only as convincing as its faithful case: with the bytes the
    // real rewriter would produce, the same path ends in a clean promotion.
    const repository = fixture();

    const result = runWithStubbedRewriter(
      { candidate: kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST), changedCount: "2" },
      BACKEND_DIGEST,
      STOREFRONT_DIGEST,
      join(repository, "plepic/overlays/test"),
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(
      kustomization(BACKEND_DIGEST, STOREFRONT_DIGEST),
    );
    expect(porcelain(repository)).toBe(" M plepic/overlays/test/kustomization.yaml\n");
  });
});

describe("concurrent mutation", () => {
  it("refuses and restores when the kustomization changes under it", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");
    const before = overlayFile(repository, "plepic/overlays/test");

    // A `git` shim that mutates a second tracked file at the moment the guard
    // inspects its own diff, so the post-write verification must refuse and
    // roll the kustomization back without clobbering the concurrent change.
    const binary = join(makeRoot(), "bin");
    mkdirSync(binary, { recursive: true });
    const shim = join(binary, "git");
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        'if [ "${1:-}" = "-C" ] && [ "${3:-}" = "diff" ] && [ "${4:-}" = "--name-only" ]; then',
        '  printf "%s\\n" "concurrent mutation" > "$GITOPS_TEST_MUTATION_FILE"',
        "fi",
        'exec "$GITOPS_REAL_GIT" "$@"',
        "",
      ].join("\n"),
    );
    chmodSync(shim, 0o755);
    const realGit = spawnSync("/bin/sh", ["-c", "command -v git"], {
      encoding: "utf8",
    }).stdout.trim();

    const result = spawnSync("sh", [guard, BACKEND_DIGEST, STOREFRONT_DIGEST, overlay], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binary}:${process.env["PATH"] ?? ""}`,
        GITOPS_REAL_GIT: realGit,
        GITOPS_TEST_MUTATION_FILE: join(repository, "plepic/overlays/live/kustomization.yaml"),
      },
    });

    expect(result.status).not.toBe(0);
    expect(overlayFile(repository, "plepic/overlays/test")).toBe(before);
    expect(overlayFile(repository, "plepic/overlays/live")).toBe("concurrent mutation\n");
  });

  it("preserves a recovery snapshot when the target is replaced by a directory", () => {
    const repository = fixture();
    const overlay = join(repository, "plepic/overlays/test");

    const binary = join(makeRoot(), "bin");
    mkdirSync(binary, { recursive: true });
    const shim = join(binary, "git");
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        'if [ "${1:-}" = "-C" ] && [ "${3:-}" = "diff" ] && [ "${4:-}" = "--name-only" ]; then',
        '  rm -f "$GITOPS_TEST_TARGET"',
        '  mkdir "$GITOPS_TEST_TARGET"',
        "fi",
        'exec "$GITOPS_REAL_GIT" "$@"',
        "",
      ].join("\n"),
    );
    chmodSync(shim, 0o755);
    const realGit = spawnSync("/bin/sh", ["-c", "command -v git"], {
      encoding: "utf8",
    }).stdout.trim();

    const result = spawnSync("sh", [guard, BACKEND_DIGEST, STOREFRONT_DIGEST, overlay], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binary}:${process.env["PATH"] ?? ""}`,
        GITOPS_REAL_GIT: realGit,
        GITOPS_TEST_TARGET: join(overlay, "kustomization.yaml"),
      },
    });

    expect(result.status).not.toBe(0);
    expect(statSync(join(overlay, "kustomization.yaml")).isDirectory()).toBe(true);
    expect(`${result.stderr}`).toMatch(/recovery snapshot preserved:/);
    const snapshot = /recovery snapshot preserved: (\S+)/.exec(result.stderr)?.[1];
    expect(snapshot).toBeDefined();
    expect(readFileSync(snapshot as string, "utf8")).toBe(kustomization());
  });
});
