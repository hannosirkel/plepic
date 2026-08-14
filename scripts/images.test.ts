import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { asMapping, asScalar, asSequence, parseYamlSubset, type YamlValue } from "./yaml-subset.js";

/**
 * The two images this repository publishes, the ignore-files that decide what
 * reaches them, and the data services the local stack and CI share.
 *
 * These are properties a Dockerfile cannot state for itself and a comment
 * cannot enforce. Three of them are load-bearing well beyond this repository:
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

/** A Dockerfile's instructions, with comments and continuations resolved. */
function instructions(dockerfile: string): string[] {
  const folded: string[] = [];
  for (const raw of read(dockerfile).split("\n")) {
    const line = raw.trim();
    const previous = folded[folded.length - 1];
    if (previous !== undefined && previous.endsWith("\\")) {
      folded[folded.length - 1] = `${previous.slice(0, -1).trimEnd()} ${line}`;
      continue;
    }
    if (line === "" || line.startsWith("#")) continue;
    folded.push(line);
  }
  return folded.map((line) => line.replace(/\s+/g, " ").trim());
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
        const names = directives(image.dockerfile, "ENV").map((entry) => entry.split("=")[0]!);
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
        for (const install of directives(image.dockerfile, "RUN").filter((line) =>
          line.includes("npm ci"),
        )) {
          // `npm install` would resolve afresh and could publish a dependency
          // tree no lockfile describes; the plan's whole argument for
          // rebuilding live from source rather than re-tagging the tested
          // digest rests on this being `npm ci`.
          expect(install).not.toMatch(/npm install/);
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
