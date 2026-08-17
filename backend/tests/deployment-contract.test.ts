import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
