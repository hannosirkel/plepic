import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readBackendRuntimeConfig } from "../backend/src/config/runtime.js";
import { asMapping, asScalar, asSequence, parseYamlSubset, type YamlValue } from "./yaml-subset.js";

/**
 * The two images this repository publishes, the ignore-files that decide what
 * reaches them, and the data services the local stack and CI share.
 *
 * These are properties a Dockerfile cannot state for itself and a comment
 * cannot enforce. Four of them are load-bearing well beyond this repository:
 *
 * 1. **`WORKDIR /app` in the backend image.** The catalogue import derives its
 *    media root from Medusa's own base directory — `<base>/static` — rather
 *    than from a variable, so that the import writes exactly where Medusa
 *    serves. The `deploys` manifests mount the assets PVC at `/app/static`
 *    with `subPath: media`. Those two facts meet only if the working directory
 *    is `/app`. A base image that moved it would leave imported media on the
 *    container's own filesystem, under a path no volume backs: media would
 *    still upload, still render in the pod that wrote it, and vanish on the
 *    next restart — with nothing in CI failing, because CI never mounts a PVC.
 * 2. **No build argument anywhere.** Next.js inlines every `NEXT_PUBLIC_*`
 *    value at build time, so a per-environment value delivered as a build
 *    argument is a per-environment value baked into an image that is supposed
 *    to serve both environments. `storefront/tests/no-next-public-env.test.ts`
 *    and `storefront/tests/build-and-serve.test.ts` hold the source and the
 *    built artifact to the same rule; this holds the *build*.
 * 3. **No `ENTRYPOINT` other than an empty one.** The `deploys` manifests
 *    choose what each workload runs with `args:` — the API, the worker, the
 *    predeploy Job and the import Job are one image and four argument lists.
 *    Kubernetes `args` replaces `CMD` and leaves `ENTRYPOINT` prefixed, so an
 *    entrypoint would turn every one of those into an argument list for
 *    something else, and the `node` base image ships one by default.
 * 4. **`ENV` names only structural variables — every name of every `ENV`, in
 *    every stage.** This is the file's half of *"Nothing that differs between
 *    environments may be baked into an image"*, and for a value inlined in a
 *    Dockerfile it is the only check there is:
 *    `storefront/tests/no-live-hostname.test.ts` scans `storefront/`, and
 *    `backend/Dockerfile` is not under it. It is also depended on from another
 *    suite — `backend/tests/deployment-contract.test.ts` reads the compile
 *    instruction's inline assignments and is exhaustive *because* no
 *    configuration variable can reach the compiler as `ENV` or `ARG` instead.
 *    Weakening this weakens that, silently, which is why `environmentNames`
 *    below carries the argument it does.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

interface Image {
  readonly name: string;
  readonly dockerfile: string;
  readonly workdir: string;
  readonly command: string;
  readonly port: string;
}

const IMAGES: readonly Image[] = [
  {
    name: "backend",
    dockerfile: "backend/Dockerfile",
    workdir: "/app",
    command: 'CMD ["npm", "run", "start"]',
    port: "9000",
  },
  {
    name: "storefront",
    dockerfile: "storefront/Dockerfile",
    workdir: "/app",
    command: 'CMD ["node", "server.js"]',
    port: "3000",
  },
];

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

/**
 * A Dockerfile's instructions, with comments and continuations resolved.
 *
 * Source text rather than a path, so the fold can be asserted against inputs
 * neither of this repository's Dockerfiles contains. See "the parse every
 * assertion here rests on" below.
 *
 * **A comment or blank line inside a continued instruction is dropped, not
 * appended**, and the order of those two steps is the whole of it. The skip has
 * to come *before* the continuation join, because the interior line does not
 * itself end in `\`: appending it both corrupts the instruction and terminates
 * the continuation, splitting the tail of a `RUN` into instructions of its own.
 * The builder strips both — measured with `podman build`, which prints
 * `RUN echo START MIDDLE END` for a comment line and for a blank line alike
 * between `RUN echo START \` and `MIDDLE \` and `END`.
 */
function fold(source: string): string[] {
  const folded: string[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const previous = folded[folded.length - 1];
    if (previous !== undefined && previous.endsWith("\\")) {
      folded[folded.length - 1] = `${previous.slice(0, -1).trimEnd()} ${line}`;
      continue;
    }
    folded.push(line);
  }
  return folded.map((line) => line.replace(/\s+/g, " ").trim());
}

function instructions(dockerfile: string): string[] {
  return fold(read(dockerfile));
}

const ENV_ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=/;

/**
 * Every variable name **one** `ENV` instruction sets.
 *
 * `ENV a=1 b=2` is legal and sets both, so reading a name as
 * `entry.split("=")[0]` saw `a` and nothing else — and that one line was the
 * hole through which the rule below could be defeated entirely. Appending to
 * the single permitted `ENV` of the stage that ships,
 *
 *     ENV NODE_ENV=production STRIPE_SECRET_KEY=sk_live_… \
 *         MEDUSA_BACKEND_URL=https://<the live host>
 *
 * registered as `NODE_ENV`, and a live key and a live hostname baked into the
 * published backend image left every gate in this repository green: 37/37 here,
 * 18/18 in `backend/tests/deployment-contract.test.ts`, 2664/2664 across all 81
 * files. That is the plan's *"Nothing that differs between environments may be
 * baked into an image"*, and nothing else was going to catch it — the Dockerfile
 * is the last place a value can be inlined without appearing in
 * `storefront/tests/no-live-hostname.test.ts`'s scan, which covers
 * `storefront/` only.
 *
 * Two forms have to be told apart, because `ENV` has two. `ENV a=1 b=2` is any
 * number of assignments; the legacy `ENV a b c` is exactly one variable whose
 * value is the whole rest of the line. Quoting and backslash-escaping are
 * resolved rather than ignored, so a legitimate `ENV GREETING="hello world"`
 * reads as one assignment instead of being red-flagged as two — the failure the
 * over-strict half of this same hole produced next door.
 *
 * A token this cannot account for is returned as it stands, so an `ENV` shape
 * nobody has thought of yet fails the allowlist rather than parsing to nothing.
 */
function environmentNames(entry: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < entry.length; index += 1) {
    const character = entry[index]!;
    if (character === "\\" && index + 1 < entry.length) {
      current += entry[index + 1]!;
      started = true;
      index += 1;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      started = true;
      continue;
    }
    if (character === " ") {
      if (started) tokens.push(current);
      current = "";
      started = false;
      continue;
    }
    current += character;
    started = true;
  }
  if (started) tokens.push(current);

  if (tokens.length === 0) return [];
  if (!ENV_ASSIGNMENT.test(tokens[0]!)) return [tokens[0]!];
  return tokens.map((token) => ENV_ASSIGNMENT.exec(token)?.[1] ?? token);
}

/**
 * The instructions of the **last** stage — the one that becomes the published
 * image, and the only one whose `USER`, `WORKDIR`, `EXPOSE`, `ENTRYPOINT` and
 * `CMD` a runtime ever sees.
 *
 * Reasoning over a Dockerfile's instructions file-wide reads as strictly
 * stronger and is not: a build stage's `USER` and a runtime stage's `USER` are
 * not the same statement, and a file-wide list cannot tell them apart. The
 * concrete hole that opened is one stage long — append
 *
 *     FROM node@sha256:… AS final
 *     COPY --from=runtime / /
 *
 * and every file-wide assertion below still holds (the base is pinned, there
 * is one base, `USER 10001:10001` appears exactly once, `ENTRYPOINT` is
 * `[]`, `EXPOSE` names the port) while the image that ships runs as **root**
 * from `/` with the base image's own entrypoint restored. Splitting at `FROM`
 * is what makes those assertions statements about the shipped image.
 */
function finalStage(dockerfile: string): string[] {
  const lines = instructions(dockerfile);
  const last = lines.findLastIndex((line) => /^FROM\s/i.test(line));
  expect(last, `${dockerfile} declares no build stage`).toBeGreaterThanOrEqual(0);
  return lines.slice(last);
}

function directivesIn(lines: readonly string[], keyword: string): string[] {
  const prefix = new RegExp(`^${keyword}\\s+`, "i");
  return lines.filter((line) => prefix.test(line)).map((line) => line.replace(prefix, ""));
}

/** Every instruction of one kind in the whole file, without its keyword. */
function directives(dockerfile: string, keyword: string): string[] {
  return directivesIn(instructions(dockerfile), keyword);
}

/** Every instruction of one kind in the stage that becomes the image. */
function finalDirectives(dockerfile: string, keyword: string): string[] {
  return directivesIn(finalStage(dockerfile), keyword);
}

/**
 * The path the backend image serves media from, derived from the image rather
 * than written down twice.
 *
 * Medusa's file provider resolves `<base>/static`, where `<base>` is its own
 * working directory, so this is the shipping stage's last `WORKDIR` plus
 * `static` — and it is the path the assets PVC is mounted at in
 * `hannosirkel/deploys` and the path `compose.yaml` has to mount its local
 * stand-in at. Both of those agreements are checked against this, so moving
 * the working directory fails them together instead of quietly separating the
 * place media is written from the place it is served.
 */
function backendMediaRoot(): string {
  const workdirs = finalDirectives("backend/Dockerfile", "WORKDIR");
  const workdir = workdirs[workdirs.length - 1];
  expect(
    workdir,
    "backend/Dockerfile sets no working directory in the stage that ships",
  ).toBeDefined();
  return `${workdir}/static`;
}

/**
 * The parse every assertion in this file rests on, held to inputs the two
 * Dockerfiles here do not contain.
 *
 * These are tests of a test, which needs justifying, and the justification is
 * that both halves below were silently wrong and the file stayed green either
 * way. Every assertion in this suite is a statement about `fold`'s output, and
 * a statement about a corrupted fold is worth nothing; the `ENV` rule in
 * particular was defeated outright by a one-line reading of a name. Neither
 * defect could be shown on `backend/Dockerfile` or `storefront/Dockerfile`,
 * because neither file has a multi-variable `ENV` or an interior comment — so
 * the only place to hold the parse is against the input, and adding either
 * shape to a shipped Dockerfile to make a test fail would be changing the image
 * to test the test.
 */
describe("the parse every assertion here rests on", () => {
  it("drops a comment inside a continued instruction rather than truncating it", () => {
    // Docker permits this and strips the comment; the fold used to append it,
    // which also ended the continuation, so `MIDDLE \` and `END` became
    // instructions of their own and the `RUN` this file reasons about was a
    // fragment. Reproduced on the real file: one comment line above
    // `REDIS_HOST=` in `backend/Dockerfile`'s compile instruction made all
    // three assertions in `backend/tests/deployment-contract.test.ts` fail
    // against a Dockerfile that builds.
    expect(
      fold(["RUN echo START \\", "# an interior comment", "  MIDDLE \\", "  END"].join("\n")),
    ).toEqual(["RUN echo START MIDDLE END"]);
    // A blank line in the same position is stripped the same way. Measured, not
    // assumed: `podman build` prints `RUN echo START MIDDLE END` for both.
    expect(fold(["RUN echo START \\", "", "  MIDDLE \\", "  END"].join("\n"))).toEqual([
      "RUN echo START MIDDLE END",
    ]);
    // And a comment between two instructions is still a comment.
    expect(fold(["RUN a", "# between", "RUN b"].join("\n"))).toEqual(["RUN a", "RUN b"]);
  });

  it("reads every name a multi-variable ENV sets", () => {
    expect(
      environmentNames("NODE_ENV=production MEDUSA_BACKEND_URL=https://storefront.example.test"),
    ).toEqual(["NODE_ENV", "MEDUSA_BACKEND_URL"]);
    // A quoted value containing a space is one assignment, not two — the
    // over-strict direction, which red-flags a Dockerfile that is fine.
    expect(environmentNames('GREETING="hello world" PORT=9000')).toEqual(["GREETING", "PORT"]);
    expect(environmentNames("GREETING=hello\\ world PORT=9000")).toEqual(["GREETING", "PORT"]);
    // The legacy form names one variable and swallows the rest of the line.
    expect(environmentNames("NODE_ENV production value")).toEqual(["NODE_ENV"]);
    // A shape this cannot account for surfaces rather than vanishing, so it
    // fails the allowlist instead of parsing to nothing.
    expect(environmentNames("A=1 not-an-assignment")).toEqual(["A", "not-an-assignment"]);
  });
});

describe("both images are built from a pinned base and run as a non-root user", () => {
  for (const image of IMAGES) {
    describe(image.name, () => {
      it("pins every base image by digest", () => {
        const bases = directives(image.dockerfile, "FROM").map((from) => from.split(/\s+AS\s+/i)[0]!);
        expect(bases.length).toBeGreaterThan(0);
        for (const base of bases) {
          expect(base, `${image.dockerfile} does not pin ${base} by digest`).toMatch(
            /^[^@\s]+@sha256:[0-9a-f]{64}$/,
          );
        }
      });

      it("says in a comment which release each pinned digest is", () => {
        // The same rule the workflows are held to. A digest is unreadable, so
        // the line above it is the only statement of what was pinned, and it
        // must name the same image.
        const lines = read(image.dockerfile).split("\n");
        const annotated = lines.flatMap((line, index) => {
          const reference = /^FROM\s+(\S+)/.exec(line.trim())?.[1];
          if (reference === undefined) return [];
          const comment = /^\s*#\s*(.*)$/.exec(lines[index - 1] ?? "")?.[1];
          expect(comment, `${image.dockerfile}:${index + 1} pins ${reference} with no comment`)
            .toBeDefined();
          return [[reference, comment!] as const];
        });
        expect(annotated.length).toBeGreaterThan(0);
        for (const [reference, comment] of annotated) {
          expect(reference).toContain(comment);
        }
      });

      it("uses one base image for every stage", () => {
        // Two different bases would mean two different digests to keep fresh,
        // and the Trivy gate in `release.yml` fails the whole promotion on
        // either of them.
        const bases = new Set(
          directives(image.dockerfile, "FROM").map((from) => from.split(/\s+AS\s+/i)[0]!),
        );
        expect([...bases]).toHaveLength(1);
      });

      it("runs as UID 10001, matching every workload that runs it", () => {
        // Of the *final* stage, not of the file: a `USER` in a stage that is
        // only copied out of says nothing about the user the image runs as.
        expect(finalDirectives(image.dockerfile, "USER")).toEqual(["10001:10001"]);
        // And it is the *last* thing that could be root: an instruction after
        // `USER` that needed root would have to change it back.
        const lines = finalStage(image.dockerfile);
        expect(lines.findIndex((line) => /^USER /i.test(line))).toBeGreaterThan(
          lines.findLastIndex((line) => /^RUN /i.test(line)),
        );
      });

      it("clears the base image's entrypoint and declares its command", () => {
        expect(finalDirectives(image.dockerfile, "ENTRYPOINT")).toEqual(["[]"]);
        expect(finalStage(image.dockerfile)).toContain(image.command);
      });

      it("declares the port the deploys manifests target", () => {
        expect(finalDirectives(image.dockerfile, "EXPOSE")).toEqual([image.port]);
      });

      it("declares no build argument at all", () => {
        // Not "no NEXT_PUBLIC_ build argument" — no build argument. A build
        // argument is the only route a value has into a build from outside,
        // so refusing the mechanism is what makes "nothing per-environment is
        // baked in" a property of the file rather than of a reviewer.
        expect(directives(image.dockerfile, "ARG")).toEqual([]);
        // Instructions, not the file: the storefront Dockerfile's header
        // explains at length why `NEXT_PUBLIC_*` may not appear, and a scan
        // that cannot tell an instruction from a comment about instructions
        // punishes the file for documenting the rule it obeys.
        expect(instructions(image.dockerfile).join("\n")).not.toMatch(/NEXT_PUBLIC_/);
      });

      it("sets no environment variable that differs between environments", () => {
        // Every name of every `ENV`, not the first name of each. See
        // `environmentNames`: reading one name per instruction is how a live key
        // and a live hostname passed all 2664 tests in this repository.
        const names = directives(image.dockerfile, "ENV").flatMap(environmentNames);
        const permitted = [
          "NODE_ENV",
          "HOME",
          "PORT",
          "HOSTNAME",
          "MEDUSA_DISABLE_TELEMETRY",
          "NODE_PATH",
          "npm_config_cache",
          "npm_config_update_notifier",
        ];
        for (const name of names) {
          expect(permitted, `${image.dockerfile} bakes in ${name}`).toContain(name);
        }
      });

      it("builds from the repository root, so the lockfile is the dependency tree", () => {
        const copied = directives(image.dockerfile, "COPY").filter(
          (line) => !line.startsWith("--from="),
        );
        expect(copied.some((line) => line.startsWith("package.json package-lock.json"))).toBe(true);
        // Every `npm` call in every `RUN`, allowlisted by what it does rather
        // than blocklisted by what it is spelled.
        //
        // The rule: a dependency install is `npm ci`. `npm install` would
        // resolve afresh and could publish a dependency tree no lockfile
        // describes, and the plan's whole argument for rebuilding live from
        // source rather than re-tagging the tested digest rests on that not
        // happening.
        //
        // Enforcing it by searching for the string `npm install` cannot work,
        // and this file argues elsewhere why: a check by name only catches
        // what it was told to look for. npm accepts 57 aliases, of which
        // eleven mean `install` — `add`, `i`, `in`, `ins`, `inst`, `insta`,
        // `instal`, and the `isnt…` typo chain — so `npm i left-pad` is a
        // dependency install that no search for `npm install` will ever see.
        //
        // So the subcommand is read and checked against what these two files
        // are allowed to do, which is three things: install the locked tree,
        // run a script, and pin the package manager itself to an exact
        // version. The last is not a dependency install at all; the backend
        // image needs it because npm is its entrypoint and the base image's
        // npm vendors a `tar` the Trivy gate fails on. Exact rather than a
        // range, because a floating package manager would make two builds of
        // one source revision differ — the same property this protects.
        //
        // Anything else fails, including a spelling nobody has thought of yet.
        // Widening this list is a deliberate edit, which is the point.
        for (const run of directives(image.dockerfile, "RUN")) {
          // `npm` as a command, not as the tail of a path: the removal
          // instructions name `/usr/local/lib/node_modules/npm`, and that is
          // not a call.
          for (const [call, subcommand] of run.matchAll(/(?<![\w@./-])npm\s+([^\s&|;]+)[^&|;]*/g)) {
            if (subcommand === "ci" || subcommand === "run") continue;
            expect(
              call.trim(),
              `${image.dockerfile} runs \`npm ${subcommand}\`, which is neither a locked install nor a script nor an exact package-manager pin`,
            ).toMatch(/^npm install --global npm@\d+\.\d+\.\d+$/);
          }
        }
        expect(directives(image.dockerfile, "RUN").some((line) => line.includes("npm ci"))).toBe(
          true,
        );
      });
    });
  }

  it("puts the backend at /app, where the assets PVC is mounted", () => {
    // The one assertion in this file whose failure mode is silent in
    // production. See this suite's header.
    expect(backendMediaRoot()).toBe("/app/static");
    // And the served media root is created there, owned by the runtime user,
    // so a run without a volume still resolves `<base>/static`.
    expect(
      finalDirectives("backend/Dockerfile", "RUN").some((line) =>
        line.includes(`mkdir -p ${backendMediaRoot()}`),
      ),
    ).toBe(true);
  });

  it("puts the storefront at /app, where its writable cache is mounted", () => {
    const workdirs = finalDirectives("storefront/Dockerfile", "WORKDIR");
    expect(workdirs[workdirs.length - 1]).toBe("/app");
    expect(
      finalDirectives("storefront/Dockerfile", "RUN").some((line) =>
        line.includes("mkdir -p /app/.next/cache"),
      ),
    ).toBe(true);
  });

  it("builds the storefront as a standalone server", () => {
    // The Dockerfile copies `.next/standalone`; `next.config.ts` is what makes
    // that directory exist. Neither is any use without the other.
    expect(read("storefront/next.config.ts")).toMatch(/output:\s*"standalone"/);
    expect(read("storefront/Dockerfile")).toContain(".next/standalone");
  });
});

/**
 * What the shipping images are held to **not** contain.
 *
 * These three instructions each clear a CRITICAL that the Trivy gate in
 * `release.yml` fails a promotion on, and none of the three is reachable from
 * `package.json`: two are npm's own vendored `tar`, arriving through the base
 * image, and one is the Go standard library compiled into esbuild's platform
 * binary, arriving as a *production* transitive dependency that `--omit=dev`
 * does not remove.
 *
 * They are asserted here because deleting any one of them leaves every other
 * check in this repository green. The only other thing that would notice is
 * the gate itself — and the gate runs **after** `Release` has already built
 * and published both images, so a regression caught there is a promotion that
 * has already put the vulnerable image on the registry. That is exactly how
 * these findings arrived. A silent regression to a passing suite is worth less
 * than a red one here.
 */
describe("the shipping images carry no tooling their runtime does not use", () => {
  /**
   * What each image is allowed to still have of the four package managers the
   * `node` base image ships, and what it must have proved it removed.
   *
   * The lists differ by exactly one entry, and that entry is the whole design.
   * The storefront runs `node server.js` and so keeps none of them; the backend
   * is run as `args: [npm, run, <script>]` by all four of its `deploys`
   * workloads, so npm there is the entrypoint and could not be removed — which
   * is why it is pinned and upgraded instead. Everything neither image runs is
   * gone from both, because a package manager nothing invokes is a vendored
   * dependency tree that `package-lock.json` does not describe, no `overrides`
   * entry governs, and the gate will eventually fail a promotion on. That is
   * precisely what npm's own vendored `tar` did.
   */
  const PACKAGE_MANAGERS: Readonly<
    Record<string, { readonly removed: readonly string[]; readonly kept: readonly string[] }>
  > = {
    "storefront/Dockerfile": {
      removed: ["npm", "npx", "corepack", "yarn", "yarnpkg"],
      kept: ["node"],
    },
    "backend/Dockerfile": {
      removed: ["corepack", "yarn", "yarnpkg"],
      kept: ["npm", "node"],
    },
  };

  for (const [dockerfile, { removed, kept }] of Object.entries(PACKAGE_MANAGERS)) {
    it(`removes ${removed.join(", ")} from the ${dockerfile.split("/")[0]} image`, () => {
      const runs = finalDirectives(dockerfile, "RUN");
      for (const manager of removed) {
        // Each removal proves itself at build time. Asserting on the proof
        // rather than on the `rm` is deliberate: an `rm -rf` of a path that
        // moved in a new base image succeeds and removes nothing, while
        // `! command -v npm` is a statement about the filesystem that results.
        expect(
          runs.some((line) => line.includes(`! command -v ${manager}`)),
          `${dockerfile} does not prove ${manager} is gone from the image it ships`,
        ).toBe(true);
      }
      for (const survivor of kept) {
        // And what the image actually runs is proved to have survived, so a
        // removal that reached too far fails here rather than in a
        // crash-looping Deployment.
        expect(
          runs.some((line) => line.includes(`&& command -v ${survivor}`)),
          `${dockerfile} does not prove ${survivor} survived the removal`,
        ).toBe(true);
        expect(runs.some((line) => line.includes(`! command -v ${survivor}`))).toBe(false);
      }
    });
  }

  it("keeps npm in the backend, which runs it, and pins it to an exact version", () => {
    // The reason the two lists above differ, stated as the thing that makes it
    // true: this image's command *is* npm.
    expect(finalDirectives("backend/Dockerfile", "CMD")).toEqual(['["npm", "run", "start"]']);
    expect(finalDirectives("storefront/Dockerfile", "CMD")).toEqual(['["node", "server.js"]']);
    const runs = finalDirectives("backend/Dockerfile", "RUN");
    expect(
      runs.some((line) => /npm install --global npm@\d+\.\d+\.\d+(\s|$)/.test(line)),
      "backend/Dockerfile does not pin npm to an exact version",
    ).toBe(true);
    // The cache that pin creates does not ship. `npm_config_cache` points npm
    // at `/tmp/.npm`, which is right at run time and wrong at build time: the
    // `deploys` manifests mount an `emptyDir` over `/tmp`, so a cache left in
    // the layer is tens of megabytes nothing can even read.
    expect(
      runs.some((line) => /npm install --global/.test(line) && /rm -rf [^&|;]*\/tmp\//.test(line)),
      "backend/Dockerfile leaves npm's cache in the layer that ships",
    ).toBe(true);
  });

  it("deletes esbuild from the backend's runtime dependency tree", () => {
    const runs = directives("backend/Dockerfile", "RUN");
    expect(
      runs.some((line) => /find .*-name .?@esbuild.? .*rm -rf/.test(line)),
      "backend/Dockerfile does not remove esbuild from the tree it ships",
    ).toBe(true);
    // The half that matters more. A removal by name can only delete what it
    // was told to look for, so the build also refuses any Go binary left in
    // the tree — `Go buildinf:` is the ASCII part of the build-information
    // magic Go stamps into everything it links, and it is what Trivy's
    // `gobinary` analyzer keys on. That makes the check a statement about what
    // the image *contains* rather than about what a package is *called*, so a
    // dependency tree that moves the binary fails the build instead of moving
    // the finding.
    expect(
      runs.some((line) => line.includes("Go buildinf:")),
      "backend/Dockerfile does not refuse a Go binary in the tree it ships",
    ).toBe(true);
    // And it greps with `-a`. Without it, whether a binary file can match at
    // all is decided by the grep implementation's own heuristics: GNU grep
    // reports the match, an implementation that treats binary files as
    // non-matching reports nothing, and the check then passes while the binary
    // ships. A guard may fail closed on a tree it should have accepted; it may
    // not fail open on one it should have refused, and one letter is the whole
    // difference.
    expect(
      runs.some((line) => /grep\s+-[a-zA-Z]*a[a-zA-Z]*\s+'Go buildinf:'/.test(line)),
      "backend/Dockerfile greps for a Go binary without -a, so a grep that skips binary files fails it open",
    ).toBe(true);
  });
});

describe("the ignore-file BuildKit actually reads", () => {
  for (const image of IMAGES) {
    it(`${image.name} names its ignore-file after its Dockerfile`, () => {
      // With a build context of `.` and `--file <dir>/Dockerfile`, BuildKit
      // reads `<dir>/Dockerfile.dockerignore` and falls back to
      // `.dockerignore` at the *context root*. A `<dir>/.dockerignore` is read
      // by nothing at all — it would sit in the tree looking authoritative
      // while every file it names was sent to the builder anyway.
      const ignoreFile = `${image.dockerfile}.dockerignore`;
      expect(existsSync(join(repoRoot, ignoreFile)), `${ignoreFile} does not exist`).toBe(true);
      expect(
        existsSync(join(repoRoot, `${dirname(image.dockerfile)}/.dockerignore`)),
        `${dirname(image.dockerfile)}/.dockerignore would be read by nothing`,
      ).toBe(false);
    });

    it(`${image.name} excludes tests, dependency trees and build output`, () => {
      const patterns = read(`${image.dockerfile}.dockerignore`)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"));
      for (const required of ["**/node_modules", "**/.next", "**/.medusa", "**/tests", ".git"]) {
        expect(patterns, `${image.dockerfile}.dockerignore does not exclude ${required}`).toContain(
          required,
        );
      }
    });

    it(`${image.name} keeps design masters out of the build context`, () => {
      const patterns = read(`${image.dockerfile}.dockerignore`);
      for (const master of ["*.psd", "*.ai", "*.sketch", "*.fig", "*.tiff"]) {
        expect(patterns, `${image.dockerfile}.dockerignore admits ${master}`).toContain(master);
      }
    });
  }
});

/**
 * The local development stack and the CI service containers, held to the same
 * images.
 *
 * `compose.yaml` exists so the commerce path can be run without a cluster, and
 * that is only worth something if the PostgreSQL a developer runs against is
 * the PostgreSQL CI runs against. The digests are also the ones
 * `hannosirkel/deploys` pins its StatefulSets to — an agreement this
 * repository cannot check, which is why it is written down in `compose.yaml`.
 */
describe("the local stack and the CI services run the same images", () => {
  function services(file: string, path: readonly string[]): { readonly [key: string]: YamlValue } {
    let value: YamlValue = parseYamlSubset(read(file));
    for (const key of path) {
      value = asMapping(value, `${file} ${path.join(".")}`)[key]!;
      expect(value, `${file} has no ${path.join(".")}`).toBeDefined();
    }
    return asMapping(value, `${file} ${path.join(".")}`);
  }

  const declarations: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["compose.yaml", ["services"]],
    [".github/workflows/validate.yml", ["jobs", "validate", "services"]],
    [".github/workflows/release.yml", ["jobs", "validate", "services"]],
  ];

  /** The image reference of each data service, by service name. */
  function dataServices(file: string, path: readonly string[]): Record<string, string> {
    const found: Record<string, string> = {};
    for (const [name, body] of Object.entries(services(file, path))) {
      const image = asMapping(body, `${file} ${name}`)["image"];
      if (typeof image === "string") found[name] = image;
    }
    return found;
  }

  it("declares postgresql, redis and an SMTP sink in all three", () => {
    for (const [file, path] of declarations) {
      expect(Object.keys(dataServices(file, path)).toSorted(), file).toEqual([
        "postgresql",
        "redis",
        "smtp",
      ]);
    }
  });

  it("pins all three to the same digests in all three", () => {
    const [first, ...rest] = declarations.map(([file, path]) => dataServices(file, path));
    expect(first).toBeDefined();
    for (const other of rest) {
      expect(other).toEqual(first);
    }
    for (const [name, image] of Object.entries(first!)) {
      expect(image, `${name} is not pinned by digest`).toMatch(/@sha256:[0-9a-f]{64}$/);
    }
  });

  it("gives the local backend and storefront the images this repository builds", () => {
    const compose = services("compose.yaml", ["services"]);
    for (const [name, dockerfile] of [
      ["backend", "backend/Dockerfile"],
      ["storefront", "storefront/Dockerfile"],
    ] as const) {
      const build = asMapping(asMapping(compose[name]!, name)["build"]!, `${name}.build`);
      expect(build["context"], `${name} does not build from the repository root`).toBe(".");
      expect(build["dockerfile"]).toBe(dockerfile);
    }
  });

  it("mounts the local assets volume exactly where the image serves media from", () => {
    // The image side of this agreement is held above; this is the other side,
    // and it was previously held by nothing. `compose.yaml` exists so the
    // commerce path — the catalogue import included — can be run without a
    // cluster, and the import's whole media contract is that it writes where
    // Medusa serves. A stand-in volume mounted anywhere but the image's own
    // media root reproduces exactly the production failure the header of this
    // file describes: media uploads, renders, and vanishes on restart, with a
    // local run that looked green.
    const mediaRoot = backendMediaRoot();
    const document = asMapping(parseYamlSubset(read("compose.yaml")), "compose.yaml");
    const backend = asMapping(services("compose.yaml", ["services"])["backend"]!, "backend");
    const mounts = asSequence(backend["volumes"]!, "backend.volumes").map((entry, index) =>
      asScalar(entry, `backend.volumes[${index}]`),
    );
    const mounted = mounts.filter((mount) => mount.split(":")[1] === mediaRoot);
    expect(mounted, `compose.yaml mounts nothing at ${mediaRoot}`).toHaveLength(1);
    // A named volume declared in this file, not a bind mount of a host path:
    // the cluster backs this with a PersistentVolumeClaim, and a bind mount
    // would put a developer's own directory where the import writes.
    const source = mounted[0]!.split(":")[0]!;
    expect(
      Object.keys(asMapping(document["volumes"]!, "compose.yaml volumes")),
      `${source} is not a named volume this file declares`,
    ).toContain(source);
  });

  it("publishes every local port on the loopback address only", () => {
    // A development database on 0.0.0.0 is a development database on the
    // network the laptop is joined to.
    const compose = services("compose.yaml", ["services"]);
    for (const [name, body] of Object.entries(compose)) {
      const ports = asMapping(body, name)["ports"];
      if (ports === undefined) continue;
      for (const port of asSequence(ports, `${name}.ports`)) {
        expect(port, `${name} publishes ${String(port)} beyond loopback`).toMatch(/^127\.0\.0\.1:/);
      }
    }
  });

  /**
   * **`compose.yaml`'s backend environment, held to the reader the image runs.**
   *
   * This was the last full transcription of that list with no gate of any kind
   * on it. `backend/tests/deployment-contract.test.ts` holds the Dockerfile's
   * compile environment, `scripts/validate` holds the environment it builds
   * under, and `deploys/plepic/tests/manifests.sh` holds the four cluster
   * workloads. Nothing held this: the compose suite above asserts services,
   * digests, ports and volume mounts and never env completeness, so a new
   * required variable broke `docker compose up` for every developer with the
   * whole repository green — which is the reason `compose.yaml` exists, since
   * the commerce path cannot be run without a cluster any other way.
   *
   * **The coverage is partial and the reason is worth stating.** Compose
   * interpolates `${VAR:-default}`, and this reads the file rather than a
   * developer's shell, so `${STRIPE_SECRET_KEY:-local-development-placeholder}`
   * satisfies a non-empty requirement as literal text. What that means in
   * practice is that this catches an *absent* key and cannot catch a key whose
   * substituted value is wrong — and absent is the failure mode a new required
   * variable produces, so the check is aimed at the case it exists for.
   *
   * It is here rather than beside its sibling in the backend suite, and that was
   * measured both ways rather than argued. This file already reads
   * `compose.yaml` with `parseYamlSubset`, and the backend project cannot: its
   * `tsconfig.test.json` sets `rootDir` to `backend/`, so importing
   * `scripts/yaml-subset.ts` from there is `error TS6059`. The reverse direction
   * is merely a preference — the root project imports backend source cleanly,
   * which is what this line does. The cost of that is real and accepted: a new
   * required variable in `backend/src/config/runtime.ts` now turns this project
   * red as well. That is the point of the whole unit rather than a side effect.
   */
  it("supplies every variable the backend image's configuration requires", () => {
    const environment: Record<string, string> = {};
    const backend = asMapping(services("compose.yaml", ["services"])["backend"]!, "backend");
    for (const [name, value] of Object.entries(
      asMapping(backend["environment"]!, "backend.environment"),
    )) {
      environment[name] = asScalar(value!, `backend.environment.${name}`);
    }
    // The parse is asserted before it is relied on: an empty mapping would make
    // the reader below throw for the wrong reason and a partial one would make
    // it pass for the wrong reason.
    expect(
      Object.keys(environment).length,
      "compose.yaml declares no backend environment — the service changed shape",
    ).toBeGreaterThan(20);
    // Called rather than wrapped in `not.toThrow()`, so a missing variable fails
    // with the reader's own words — "Missing required backend environment
    // variable: REDIS_HOST" — rather than with "expected function not to throw".
    expect(readBackendRuntimeConfig(environment).databaseUrl).toMatch(/^postgres(?:ql)?:\/\//);
  });

  it("carries no per-environment value and no credential a deployment would use", () => {
    // The local stack is placeholders and loopback. Anything that looks like a
    // real key is either a shell variable the developer exports or nothing.
    const compose = read("compose.yaml");
    expect(compose).not.toMatch(/sk_(?:live|test)_/);
    expect(compose).not.toMatch(/pk_(?:live|test)_/);
    expect(compose).not.toMatch(/whsec_[A-Za-z0-9]/);
    expect(compose).not.toMatch(/plepicgames\.com|lunarbasegame\.com/);
  });
});
