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
 * A Dockerfile's instructions, comments dropped and line continuations folded,
 * so the twenty-seven-line `RUN` that compiles the backend is one string.
 *
 * Deliberately the same fold `scripts/images.test.ts` performs on the same file,
 * and that duplication is named rather than glossed — see the placement note
 * further down, which used to claim nothing would be reused by moving this test
 * next door. A parser *is* duplicated, in a unit whose thesis is that hand
 * copies drift, and the two copies duly drifted in the same direction at once:
 * both got the order of the two steps below wrong until this was fixed in both.
 *
 * **A comment or blank line inside a continued instruction is dropped, not
 * appended.** The skip has to come *before* the continuation join. The interior
 * line does not itself end in `\`, so appending it both corrupted the
 * instruction and terminated the continuation, splitting the tail of the compile
 * `RUN` into instructions of its own — one comment line above `REDIS_HOST=` was
 * enough to fail all three assertions in this describe against a Dockerfile that
 * builds. Docker permits both and strips both, measured with `podman build`
 * rather than assumed: it prints `RUN echo START MIDDLE END` for a comment line
 * and for a blank line alike between `RUN echo START \`, `MIDDLE \` and `END`.
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

function dockerfileInstructions(): string[] {
  return fold(readFileSync(join(__dirname, "..", "Dockerfile"), "utf8"));
}

/**
 * A shell command's words, with single and double quoting resolved.
 *
 * Splitting on whitespace would not do, and the difference is not cosmetic:
 * three of the values on the compile instruction are quoted because they contain
 * spaces, and a naive split reads `MERCHANT_LEGAL_NAME='Example` as an assignment
 * and `Games` as the command, stopping the scan there.
 *
 * **Which assertion that defeats is worth getting right, because it is not the
 * obvious one.** For the file as it stands a naive split *fails* rather than
 * passes "supplies every variable the runtime configuration requires": three
 * required `MERCHANT_*` variables sit after the first quoted value, so the
 * reader throws on `MERCHANT_REGISTERED_ADDRESS` and the suite is red. Measured
 * both ways.
 *
 * The assertion the tokenizer actually protects is the **placeholder** one. A
 * truncated scan simply never sees the tail of the instruction, so a real host
 * inlined after the first quoted value is not examined at all: with a naive
 * split and `SOME_EXTRA=smtp.plepicgames.com` added after
 * `MERCHANT_REGISTERED_ADDRESS`, that test passes silently, and with this
 * tokenizer it fails with `backend/Dockerfile's build stage names
 * smtp.plepicgames.com, which is not a reserved example name`. The tokenizer is
 * load-bearing for the assertion whose failure cannot be undone — a real
 * credential published in a tracked file — rather than for the one that fails
 * loudly on its own.
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
 * Whether a dotted name is one RFC 2606 and RFC 6761 reserve for documentation
 * and placeholders — that name itself, or any name under it.
 *
 * **Anchored at both ends rather than tested with `endsWith`,** which was the
 * same defect in the same shape as the one this whole unit exists to fix: a
 * suffix test against `example.com` accepts `smtp.notexample.com`, because
 * without the leading dot a reserved name and a real name that merely ends in
 * one are indistinguishable. Four of the seven entries in the list this replaces
 * were safe only by accident, because they happened to be spelled with the dot
 * (`.test`, `.invalid`, `.example`, `.localhost`) and the three second-level
 * domains were not. The precedent for doing it properly is
 * `deploys/plepic/tests/manifests.sh`, which builds this same rule as an
 * anchored regex from a domain list and a final-label list, for this reason.
 */
const RESERVED_EXAMPLE_NAME =
  /^(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|test|invalid|example|localhost)$/i;

function isReservedExampleName(name: string): boolean {
  return RESERVED_EXAMPLE_NAME.test(name);
}

/**
 * The environment `medusa build` compiles under.
 *
 * Located by the *command* rather than by a stage name, so moving the compile
 * into a differently named stage moves this with it, and asserted to be
 * singular so a second compile cannot go unchecked.
 *
 * Reading only the inline assignments on that instruction is exhaustive rather
 * than approximate — but only because of a sibling check, and **that claim was
 * false when it was first written here.** The reasoning is that a variable could
 * otherwise reach the compiler as `ARG` or `ENV`, and `scripts/images.test.ts`
 * refuses every `ARG` in the file outright and permits `ENV` to name only eight
 * structural variables, none of which is a configuration value. The `node` base
 * image sets none of them either.
 *
 * The `ENV` half of that did not hold. `images.test.ts` read a name as
 * `entry.split("=")[0]`, and `ENV a=1 b=2` is legal and sets both, so
 *
 *     ENV NODE_ENV=production REDIS_HOST=redis.example.test REDIS_PORT=6379 \
 *         REDIS_PASSWORD=build
 *
 * in the build stage registered as `NODE_ENV` alone: 37/37 there, a Dockerfile
 * that builds, and *this* test failing it. The same hole in the stage that ships
 * was the serious one — a live key and a live hostname as a second name on the
 * one permitted `ENV`, with all 2664 tests in the repository green.
 *
 * `images.test.ts` now reads every name of every `ENV` in every stage, and the
 * claim above is sound as a result. It is also a **dependency between two
 * suites**, which is the thing to notice: this parse is exhaustive only for as
 * long as that allowlist is, so weakening `environmentNames` there weakens this
 * assertion here, silently and at a distance. Both files say so.
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
 * **That defect does exist one level up, and it is now the sharpest hole in this
 * class.** Everything in this repository that evaluates `medusa-config.ts` is
 * self-checking, so a new required variable turns it red on its own: this test,
 * `backend/tests/redis-modules.test.ts`, `backend/tests/media-provider.test.ts`
 * — two full copies of the environment, both of which `await
 * import("../medusa-config.js")` — `scripts/validate`'s `medusa build`, and
 * `scripts/images.test.ts`'s reading of `compose.yaml`, which was the one
 * transcription with no gate at all until it got one. The four `deploys`
 * workloads are gated too, but by a *declared* list:
 * `deploys/plepic/tests/manifests.sh`'s `BACKEND_IMAGE_REQUIRED_ENVIRONMENT`, 26
 * names hand-transcribed from `requiredEnvironmentVariables` plus the five
 * `DATABASE_*` parts, in a repository that cannot import this source and says so
 * in its own header. So the sequence a new required variable now produces is:
 * this test goes red, the Dockerfile is fixed, `manifests.sh` **passes** because
 * its list does not know about the variable, and four workloads crash-loop on a
 * value read at module scope. The `deploys` overlays cannot save it either —
 * they re-list env per workload, but as strategic-merge patches keyed by `name`,
 * so an overlay can mis-*value* a variable and cannot supply a missing one,
 * which is precisely what makes the four base manifests the sharp ones. Closing
 * it needs a change in `deploys`, not here.
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
 * `backend/src/config/runtime.ts` turn the root `repo` project red.
 *
 * **The third reason given here was wrong and is withdrawn.** It said the parse
 * this needs is not one `images.test.ts` has, so nothing would be reused by
 * going there. `words` is indeed unique to this file — but `fold` above is a
 * verbatim second copy of that file's own fold, so a parser *is* duplicated, in
 * a unit whose whole thesis is that hand copies drift. It then drifted exactly
 * as predicted: both copies mishandled a comment inside a continued instruction,
 * identically, and both were fixed together. De-duplicating it is not available
 * inside a single suite — `backend/tsconfig.test.json` sets `rootDir` to
 * `backend/`, so importing a shared parser from `scripts/` here is
 * `error TS6059: File '…/scripts/yaml-subset.ts' is not under 'rootDir'`,
 * measured rather than assumed — so the duplication is documented as a known
 * cost with the two copies named in each other's comments, which is the weaker
 * remedy and should be called that.
 *
 * Reason (2) is likewise a preference rather than a constraint, and the same
 * measurement says so: the root project imports backend source cleanly, and
 * `scripts/images.test.ts` now does exactly that for `compose.yaml`'s
 * environment. What keeps *this* test here is reason (1) — the subject is the
 * requirement, not the Dockerfile. The compile instruction names this file, the
 * way the rest of the Dockerfile names `images.test.ts`.
 */
describe("the environment the image build compiles under", () => {
  it("folds a continued instruction across a comment rather than truncating it", () => {
    // Held against an input rather than against `backend/Dockerfile`, because
    // that file has no interior comment to fail on and adding one to a shipped
    // Dockerfile in order to make a test fail would be changing the image to
    // test the test. What it costs to get wrong was measured on the real file
    // instead: one comment line above `REDIS_HOST=` on the compile instruction
    // failed all three assertions below, against a Dockerfile that builds.
    expect(
      fold(["RUN echo START \\", "# an interior comment", "  MIDDLE \\", "  END"].join("\n")),
    ).toEqual(["RUN echo START MIDDLE END"]);
    expect(fold(["RUN echo START \\", "", "  MIDDLE \\", "  END"].join("\n"))).toEqual([
      "RUN echo START MIDDLE END",
    ]);
    expect(fold(["RUN a", "# between", "RUN b"].join("\n"))).toEqual(["RUN a", "RUN b"]);
  });

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
    //
    // The result is asserted to be *a* connection string rather than to equal
    // `DATABASE_URL`, and the difference is a constraint this test has no
    // business imposing. `DATABASE_URL` is deliberately absent from
    // `requiredEnvironmentVariables`: the connection has two accepted forms, and
    // `resolveDatabaseUrl` assembles one from the five `DATABASE_*` parts —
    // which is the form the cluster manifests actually project, and no
    // `DATABASE_URL` anywhere. Pinning the equality would fail a Dockerfile that
    // moved to the parts, with a message pointing at nothing that is wrong.
    expect(readBackendRuntimeConfig(environment).databaseUrl).toMatch(/^postgres(?:ql)?:\/\//);
  });

  it("counts a name as reserved only when it is reserved", () => {
    // `isReservedExampleName` is asserted directly because the Dockerfile cannot
    // demonstrate it: every name in that file is reserved, so a rule that
    // accepted far too much would look identical against it. The second loop is
    // the one that matters — an `endsWith("example.com")` test, which is what
    // this replaced, accepts the first two of them.
    for (const reserved of [
      "example.com",
      "smtp.example.com",
      "redis.example.test",
      "a.b.example.net",
      "host.invalid",
      "shop.localhost",
      "host.example",
    ]) {
      expect(isReservedExampleName(reserved), reserved).toBe(true);
    }
    for (const real of [
      "smtp.notexample.com",
      "notexample.com",
      "example.community",
      "plepicgames.com",
    ]) {
      expect(isReservedExampleName(real), real).toBe(false);
    }
  });

  /**
   * The build stage's values are placeholders, and that is asserted because
   * getting it wrong is worse than the defect above. A real submission host or
   * a real key inlined in a tracked Dockerfile is published with the repository
   * and cannot be unpublished.
   *
   * The rule is about the values rather than about the hostnames somebody
   * thought to forbid: anything dotted with an alphabetic final label has to
   * **be** a name RFC 2606 and RFC 6761 reserve for exactly this, or a name
   * under one, and any IPv4 literal has to be loopback — the build container's
   * own, which is what `postgres://build:build@127.0.0.1:5432/build` is.
   */
  it("supplies placeholders, never a real host, address or credential", () => {
    const values = Object.values(compileEnvironment());
    const joined = values.join("\n");

    expect(joined).not.toMatch(/[sprw]k_(?:live|test)_/);
    expect(joined).not.toMatch(/whsec_[A-Za-z0-9]{16}/);

    // Non-vacuity, in the same `it()` as the assertions it protects rather than
    // in a different one. An empty parse skips both loops below and this test
    // then passes on a Dockerfile it never read — and this is the assertion
    // whose silent pass cannot be undone, since a real credential in a tracked
    // file is published with the repository. The other two tests in this
    // describe would still turn the file red, so what this buys is a reader
    // being told which thing broke.
    expect(
      values.length,
      "backend/Dockerfile's compile instruction parsed to no values — the instruction changed shape",
    ).toBeGreaterThan(1);

    for (const value of values) {
      for (const [name] of value.matchAll(/[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) {
        expect(
          isReservedExampleName(name),
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
