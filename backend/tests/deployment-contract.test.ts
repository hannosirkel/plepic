import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readBackendRuntimeConfig } from "../src/config/runtime.js";

/**
 * The seam between `hannosirkel/deploys` and this workspace.
 *
 * Every workload in `deploys/plepic/base` runs the *same* backend image and
 * chooses what it does with `args: [npm, run, <script>]`. Kubernetes `args`
 * replaces the image's `CMD`, so the script name in the manifest and the script
 * name in this `package.json` are a cross-repository contract with nothing
 * between them: a manifest naming a script that does not exist is not a
 * mis-configuration the container recovers from, it is `npm ERR! Missing
 * script` and an immediate exit.
 *
 * That contract had no test on this side. `deploys` was reviewed against the
 * plan and this workspace was reviewed against the plan; neither was ever
 * reviewed against the other, and both `start:worker` and `predeploy` were
 * merged as manifest `args` with no script behind them.
 *
 * The list below is **declared, not derived**, because the manifests live in a
 * repository this suite cannot read — CI checks out `plepic` alone. Each entry
 * names the manifest it comes from so the declaration can be checked against
 * the other repository by hand, and `scripts/validate` asserts the same list
 * survives into the built image.
 */
const scriptsTheClusterInvokes = [
  // deploys/plepic/base/backend.yaml        -> args: [npm, run, start]
  "start",
  // deploys/plepic/base/worker.yaml         -> args: [npm, run, "start:worker"]
  "start:worker",
  // deploys/plepic/base/predeploy-job.yaml  -> args: [npm, run, predeploy]
  "predeploy",
  // deploys/plepic/base/import-job.yaml     -> args: [npm, run, "catalogue:import"]
  "catalogue:import",
] as const;

const scripts = (
  JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  }
).scripts ?? {};

/**
 * A script's command with every `npm run <name>` it chains to substituted in,
 * so an assertion about what a workload ends up executing is not defeated by
 * the indirection a shared step is factored out behind.
 */
function expand(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) {
    return "";
  }
  seen.add(name);

  return (scripts[name] ?? "").replace(/npm run ([\w:-]+)/g, (_, chained: string) =>
    expand(chained, seen),
  );
}

describe("the scripts the deploys manifests invoke", () => {
  it.each(scriptsTheClusterInvokes)("declares %s", (name) => {
    expect(scripts[name]).toBeTypeOf("string");
  });

  /**
   * **Medusa never gets to dial Redis first.**
   *
   * Every Medusa Redis client is `ioredis`, and `ioredis` attaches the failing
   * command to its `ReplyError` — so a wrong `REDIS_PASSWORD` reaches the pod
   * log as `command: { name: 'auth', args: [ … ] }`, 29 times in one measured
   * `medusa start`. `src/config/redis-preflight.ts` answers the same question
   * with the workspace's declared node-redis client, which carries no command
   * and no arguments on its errors, and refuses before `medusa` is reached at
   * all.
   *
   * It has to be in front of **all four** roles rather than the two long-running
   * ones. `medusa db:migrate` is the image's one fail-open path: it exits 0 with
   * no Redis whatsoever, so `predeploy` would otherwise report a green migration
   * as its first act against a Redis that was never there — and leak the
   * password 6 times doing it.
   */
  it.each(scriptsTheClusterInvokes)("pings Redis before %s reaches medusa", (name) => {
    const script = expand(name);

    expect(script).toContain("redis-preflight");
    expect(script.indexOf("redis-preflight")).toBeLessThan(script.indexOf("medusa "));
  });

  /**
   * The preflight resolves either tree for the reason the `medusa exec` scripts
   * below do, and needs one thing more: plain `node` cannot load the source
   * `.ts`, because `runtime.ts` is imported extensionlessly and neither Node's
   * type stripping nor its CJS resolver maps that onto a `.ts` file. So the
   * source branch names the runner as well as the file, and the built branch —
   * the only one the image ever takes — stays a bare `node`.
   */
  it("lets the Redis preflight resolve either the built or the source file", () => {
    expect(scripts["redis:preflight"]).toContain("./src/config/redis-preflight.js");
    expect(scripts["redis:preflight"]).toContain("./src/config/redis-preflight.ts");
    expect(scripts["redis:preflight"]).toContain("ts-node/register");
  });

  /**
   * `worker.yaml` sets no `MEDUSA_WORKER_MODE`, so the script has to select
   * worker mode itself. `backend.yaml` sets none either and must keep the
   * framework default, so the selection belongs in `start:worker` and nowhere
   * else — putting it in `medusa-config.ts` would have moved the API off the
   * default too.
   */
  it("selects worker mode in start:worker and leaves start on the default", () => {
    expect(expand("start:worker")).toContain("MEDUSA_WORKER_MODE=worker");
    expect(expand("start")).not.toContain("MEDUSA_WORKER_MODE");
  });

  /**
   * `predeploy-job.yaml` supplies `MEDUSA_ADMIN_EMAIL` and
   * `MEDUSA_ADMIN_PASSWORD` from the `*-database-admin` Secret, which is the
   * whole reason the Job is the only consumer of that Secret. Migrating without
   * seeding would leave those two values projected into a Job that ignores
   * them, and no way to sign in to the Admin at all.
   */
  it("migrates and then seeds the administrator in predeploy", () => {
    const predeploy = expand("predeploy");
    expect(predeploy).toContain("db:migrate");
    expect(predeploy).toContain("seed-administrator");
    expect(predeploy.indexOf("db:migrate")).toBeLessThan(predeploy.indexOf("seed-administrator"));
  });

  /**
   * The commerce configuration is the predeploy Job's third step, and it has to
   * be in **this** Job rather than a new one: `deploys` names the workloads it
   * runs and the manifests are in a repository this workspace may not change, so
   * a fourth `args: [npm, run, …]` would be a script no manifest invokes. It
   * also has to complete before anything else runs — a migrated database has no
   * region, so `POST /store/carts` has nothing to create a cart against, and the
   * catalogue-import Job refuses without a shipping profile and a stock
   * location.
   */
  it("applies the declared commerce configuration in predeploy, after migrating", () => {
    const predeploy = expand("predeploy");
    expect(predeploy).toContain("configure-commerce");
    expect(predeploy.indexOf("db:migrate")).toBeLessThan(predeploy.indexOf("configure-commerce"));
  });

  /**
   * Every `medusa exec` script prefers the compiled `.js` beside it and falls
   * back to the `.ts`. That is not a nicety: the built image has only the
   * compiled file and a local checkout has only the source, and a script that
   * named one of them would work in exactly one of the two places.
   */
  it.each(["catalogue:import", "seed:administrator", "configure:commerce"])(
    "lets %s resolve either the built or the source file",
    (name) => {
      expect(scripts[name]).toContain(".js");
      expect(scripts[name]).toContain(".ts");
    },
  );
});

/**
 * `backend/Dockerfile`'s instructions, comments dropped and line continuations
 * folded, so the twenty-seven-line `RUN` that compiles the backend is one
 * string. Deliberately the same fold `scripts/images.test.ts` performs on the
 * same file.
 */
function dockerfileInstructions(): string[] {
  const source = readFileSync(join(__dirname, "..", "Dockerfile"), "utf8");
  const folded: string[] = [];

  for (const raw of source.split("\n")) {
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
 * A shell command's words, with single and double quoting resolved.
 *
 * Splitting on whitespace would not do, and the difference is not cosmetic:
 * three of the values on the compile instruction are quoted because they
 * contain spaces, and a naive split reads `MERCHANT_LEGAL_NAME='Example` as an
 * assignment and `Games` as the command — stopping the scan early and passing
 * the assertion below against a *shorter* environment than the build has.
 */
function words(command: string): string[] {
  const found: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | undefined;

  for (const character of command) {
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
      if (started) found.push(current);
      current = "";
      started = false;
      continue;
    }
    current += character;
    started = true;
  }
  if (started) found.push(current);

  expect(quote, `unbalanced quote in: ${command}`).toBeUndefined();
  return found;
}

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/;

/**
 * The environment `medusa build` compiles under.
 *
 * Located by the *command* rather than by a stage name, so moving the compile
 * into a differently named stage moves this with it, and asserted to be
 * singular so a second compile cannot go unchecked.
 *
 * Reading only the inline assignments on that instruction is exhaustive rather
 * than approximate. A variable could otherwise reach the compiler as `ARG` or
 * `ENV`, and `scripts/images.test.ts` refuses every `ARG` in the file outright
 * and permits `ENV` to name only eight structural variables, none of which is a
 * configuration value. The `node` base image sets none of them either.
 */
function compileEnvironment(): Record<string, string> {
  const compiles = dockerfileInstructions().filter(
    (line) => /^RUN\s/i.test(line) && /(?<![\w@./-])npm run build(?![\w:-])/.test(line),
  );
  expect(compiles, "backend/Dockerfile does not compile the backend exactly once").toHaveLength(1);

  const environment: Record<string, string> = {};
  for (const word of words(compiles[0]!.replace(/^RUN\s+/i, ""))) {
    const assignment = ASSIGNMENT.exec(word);
    // The first word that is not an assignment is the command; everything after
    // it belongs to that command rather than to its environment.
    if (assignment === null) break;
    environment[assignment[1]!] = assignment[2]!;
  }

  return environment;
}

/**
 * **What the image build compiles under, held to the reader it runs.**
 *
 * `medusa-config.ts` calls `readBackendRuntimeConfig` at module scope, and
 * `medusa build` evaluates that module in order to compile it. So every
 * variable the runtime configuration requires is a *build*-time requirement
 * too, and the inline environment on `backend/Dockerfile`'s compile instruction
 * is the only thing that supplies them.
 *
 * Nothing held those two together, and the gap is worth stating because of what
 * it cost. The configuration grew a required Redis section; `REDIS_HOST`,
 * `REDIS_PORT` and `REDIS_PASSWORD` were added to `scripts/validate` and not to
 * the Dockerfile, in the same commit, one file over. Local validation passed,
 * three review passes passed, and validation was re-run at each — because
 * **none of that builds an image.** The first thing to notice was `Release`, at
 * `build`, *after* the merge, on the branch where the merge is the deployment;
 * `main` could then produce no image at all.
 *
 * **The required set is obtained by calling the reader, never by restating it.**
 * A declared list here would be the same defect one level up: it would have to
 * be edited by whoever forgot to edit the Dockerfile, and it could only catch
 * the requirements somebody remembered to write down. Calling the real function
 * with the real build environment cannot drift for *any* reason — a new
 * variable, a new format rule such as `SMTP_PORT` having to be exactly 587, a
 * new cross-field rule — and it fails with the message the build fails with.
 *
 * This is in the backend suite rather than in `scripts/images.test.ts`, which
 * owns every other assertion about these two Dockerfiles, and that was a choice
 * rather than a constraint — the root project can import and execute backend
 * source, which was checked rather than assumed. Three reasons it is here
 * anyway. The subject is the *requirement*, `readBackendRuntimeConfig`, which
 * lives in this workspace; the Dockerfile is merely a file that has to satisfy
 * it, which is the shape of every other test in this file. It executes
 * application code, where every assertion in `images.test.ts` reads a file as
 * text, so putting it there would let a change to
 * `backend/src/config/runtime.ts` turn the root `repo` project red. And the
 * parse it needs — quote-aware `NAME=value` assignments inlined on one `RUN` —
 * is not one `images.test.ts` has, so nothing would be reused by going there.
 * The compile instruction names this file, the way the rest of the Dockerfile
 * names `images.test.ts`.
 */
describe("the environment the image build compiles under", () => {
  it("is read from the one instruction that compiles the backend", () => {
    const environment = compileEnvironment();
    // The parse is asserted before it is relied on. A parse that found nothing
    // would make the next test vacuous in exactly the case that matters.
    expect(Object.keys(environment).length).toBeGreaterThan(1);
    expect(environment.NODE_ENV).toBe("production");
    // And it resolved at least one quoted value containing a space, which is
    // the whole reason `words` is a tokenizer rather than a `split`.
    expect(Object.values(environment).some((value) => value.includes(" "))).toBe(true);
  });

  it("supplies every variable the runtime configuration requires", () => {
    const environment = compileEnvironment();
    // Called rather than wrapped in `expect(…).not.toThrow()`: a missing
    // variable then fails this test with the reader's own words — "Missing
    // required backend environment variable: REDIS_HOST", the line `Release`
    // died on — instead of with "expected function not to throw".
    expect(readBackendRuntimeConfig(environment).databaseUrl).toBe(environment.DATABASE_URL);
  });

  /**
   * The build stage's values are placeholders, and that is asserted because
   * getting it wrong is worse than the defect above. A real submission host or
   * a real key inlined in a tracked Dockerfile is published with the repository
   * and cannot be unpublished.
   *
   * The rule is about the values rather than about the hostnames somebody
   * thought to forbid: anything dotted with an alphabetic final label has to
   * end in a name RFC 2606 and RFC 6761 reserve for exactly this, and any IPv4
   * literal has to be loopback — the build container's own, which is what
   * `postgres://build:build@127.0.0.1:5432/build` is.
   */
  it("supplies placeholders, never a real host, address or credential", () => {
    const values = Object.values(compileEnvironment());
    const joined = values.join("\n");

    expect(joined).not.toMatch(/[sprw]k_(?:live|test)_/);
    expect(joined).not.toMatch(/whsec_[A-Za-z0-9]{16}/);

    const reserved = [
      ".test",
      ".invalid",
      ".example",
      ".localhost",
      "example.com",
      "example.net",
      "example.org",
    ];

    for (const value of values) {
      for (const [name] of value.matchAll(/[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) {
        expect(
          reserved.some((suffix) => name.toLowerCase().endsWith(suffix)),
          `backend/Dockerfile's build stage names ${name}, which is not a reserved example name`,
        ).toBe(true);
      }
      for (const [address] of value.matchAll(/\d{1,3}(?:\.\d{1,3}){3}/g)) {
        expect(
          address,
          `backend/Dockerfile's build stage names ${address}, which is not loopback`,
        ).toMatch(/^127\./);
      }
    }
  });
});
