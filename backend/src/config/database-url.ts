/**
 * The connection string Medusa needs, from the configuration the deployment
 * actually supplies.
 *
 * Extensionless imports on purpose, like `runtime.ts` beside it: this module is
 * on the path `medusa-config.ts` pulls in through ts-node before anything is
 * compiled, and a `.js` suffix there cannot be mapped back onto the `.ts` file.
 *
 * ## Why this exists at all
 *
 * `deploys/plepic/base` projects five separate `DATABASE_*` values into every
 * workload and no `DATABASE_URL` anywhere. That is not an oversight to be
 * corrected on the manifest side: a full URL embeds the password, so supplying
 * one would turn four non-secret values into a secret needing its own ESO
 * projection, and would put the password into a second place it can leak from.
 * The five-part form keeps the password in its own Secret key — which is what
 * `deploys/plepic/tests/manifests.sh` asserts — and the assembly happens here,
 * in the process that already holds the password in memory.
 *
 * ## Precedence: an explicit `DATABASE_URL` wins
 *
 * `compose.yaml` and `.github/workflows/validate.yml` both set an explicit
 * `DATABASE_URL` and neither sets a single part, so honouring the URL is what
 * leaves the local and CI paths working exactly as they did. It is also the
 * more expressive of the two forms — a Unix socket, `?sslmode=require`, a
 * managed instance's URL — and none of that is reachable through five parts. A
 * cluster workload supplies no `DATABASE_URL`, so the precedence never fires
 * there and the two forms never compete in a real deployment.
 *
 * An **empty** `DATABASE_URL` does not win. That is what an ESO-projected key
 * whose OpenBao field is absent looks like, and treating it as an explicit
 * choice would hand `postgres://` with no host to the driver.
 *
 * ## And the TLS mode, which is deliberately not carried in the URL
 *
 * `resolveDatabaseDriverOptions` lives here rather than beside it because it
 * answers the other half of the same question — the URL says *where* the
 * database is, the driver options say *how* to open it. See that function for
 * why the answer is a separate variable rather than a URL parameter.
 */

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

const partNames = [
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_NAME",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
] as const;

/**
 * A refusal that names the part and carries nothing else.
 *
 * The message reaches an operator through `kubectl logs` on a crash-looping
 * pod or a failed predeploy Job — an Argo CD `Sync` hook at sync-wave `-10`,
 * behind the data services at `-20` and ahead of everything else at `0` — so it
 * says which value is missing and what the alternative is. It never
 * interpolates a *value*: the password is one of the five, and a refusal that
 * quoted what it received would publish it into the cluster's log pipeline and
 * into Loki for thirty days.
 */
function refuse(name: string, why: string): never {
  throw new Error(
    `Cannot determine the database connection: ${name} ${why}. ` +
      `Supply DATABASE_URL, or all of ${partNames.join(", ")}.`,
  );
}

function requirePart(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    refuse(name, "is missing or empty");
  }

  return value;
}

/**
 * A host is an authority component, so it is validated rather than encoded:
 * percent-encoding a hostname produces something no resolver will accept, while
 * leaving `:` or `@` or `/` in it silently re-cuts the authority and sends the
 * connection somewhere else entirely.
 */
function requireHost(environment: RuntimeEnvironment): string {
  const host = requirePart(environment, "DATABASE_HOST");

  if (/[\s/?#@[\]:\\]/.test(host)) {
    refuse("DATABASE_HOST", "must be a bare hostname or address");
  }

  return host;
}

function requirePort(environment: RuntimeEnvironment): string {
  const port = requirePart(environment, "DATABASE_PORT");

  if (!/^[1-9][0-9]*$/.test(port) || Number(port) > 65535) {
    refuse("DATABASE_PORT", "must be a TCP port between 1 and 65535");
  }

  return port;
}

/**
 * Resolve the database connection string, preferring an explicit
 * `DATABASE_URL` and otherwise deriving one from the five parts the `deploys`
 * manifests supply.
 *
 * @throws if neither form is completely supplied. The message names the
 * missing part and never contains a value.
 */
export function resolveDatabaseUrl(environment: RuntimeEnvironment): string {
  const explicit = environment.DATABASE_URL?.trim();

  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }

  const host = requireHost(environment);
  const port = requirePort(environment);
  const name = requirePart(environment, "DATABASE_NAME");
  const user = requirePart(environment, "DATABASE_USER");
  const password = requirePart(environment, "DATABASE_PASSWORD");

  // Every user-supplied component is percent-encoded. The password is
  // generated rather than chosen, so `@`, `/`, `:` and `#` are all live
  // possibilities, and an unencoded `@` in it would move the host.
  const userinfo = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;

  return `postgres://${userinfo}@${host}:${port}/${encodeURIComponent(name)}`;
}

/**
 * What node-postgres is handed as its `ssl` option, in the shape Medusa nests
 * it in.
 *
 * `false` is no TLS; `{ rejectUnauthorized: false }` is TLS with no
 * verification; `true` is TLS with the chain and hostname verified against
 * **Node's default trust store** — which is the operationally significant half:
 * a certificate from a private or cluster-internal CA fails verification unless
 * that CA is trusted by the process, through `NODE_EXTRA_CA_CERTS`. Adding it to
 * the image's trust store is **not** sufficient on its own: Node defaults to
 * `--use-bundled-ca` and reads the system store only under `--use-system-ca`,
 * which nothing here sets. `verify-full` is therefore not a manifest-only
 * change.
 */
export type DatabaseSslSetting = false | true | { readonly rejectUnauthorized: false };

export interface DatabaseDriverOptions {
  readonly connection: { readonly ssl: DatabaseSslSetting };
}

/** libpq's vocabulary, restricted to the three modes this deployment can mean. */
const sslModes = ["disable", "require", "verify-full"] as const;

type DatabaseSslMode = (typeof sslModes)[number];

function isSslMode(value: string): value is DatabaseSslMode {
  return (sslModes as readonly string[]).includes(value);
}

/**
 * The PostgreSQL driver options **both** of Medusa's connection paths honour.
 *
 * ## The defect this exists to close
 *
 * `medusa db:migrate` and the running backend resolved `ssl` by two different
 * routes, and only one of them matched this deployment:
 *
 * | path | how `ssl` was chosen | result |
 * |---|---|---|
 * | runtime (`backend`, `worker`) | `pgConnectionLoader` spreads `databaseDriverOptions` — `undefined` — and `createPgConnection` falls through `?? false` | `ssl: false` |
 * | migration | `medusaAppLoader` forwards `driverOptions: undefined`, so `loadDatabaseConfig` substitutes `getDefaultDriverOptions(clientUrl)` | `ssl: { rejectUnauthorized: false }` |
 *
 * `getDefaultDriverOptions` treats a URL as *remote* unless it matches
 * `/localhost|127\.0\.0\.1|ssl_mode=(disable|false)|sslmode=(disable)/i`. A
 * Kubernetes Service name matches none of those, so the migrator opened with an
 * SSLRequest; the PostgreSQL it reached runs `ssl = off`, answered `'N'`, and
 * `pg` ended the socket without sending a startup packet
 * (`pg/lib/connection.js:84-86`). `propagateCreateError: false` then left
 * `raw("SELECT 1")` pending until Medusa's ten-second migration timer.
 *
 * That timer's message *does* name SSL — it reads "Could not connect to the
 * database while running migrations. The connection timed out after 10 seconds,
 * which usually indicates an incorrect database URL or an SSL configuration
 * issue." What it does not do is say which of the two it was, or report the
 * refusal the server actually sent: `The server does not support SSL
 * connections` was raised on the pool's connection and never reached the
 * operator, so the visible symptom was a timeout with two candidate causes.
 *
 * ## Why not a URL parameter
 *
 * **Be precise about this, because the obvious summary is wrong.** One URL
 * spelling does work. `pgConnectionLoader` and `loadDatabaseConfig` both strip
 * the *underscored* `ssl_mode` — the regex is `/(\?|&)ssl_mode=[^&]*(&|$)/gi` —
 * and `medusaAppLoader` then takes the migration `clientUrl` from that stripped
 * string in preference to `projectConfig.databaseUrl`. But
 * `getDefaultDriverOptions` matches **both** `ssl_mode=(disable|false)` and the
 * unhyphenated `sslmode=(disable)`, and nothing strips the latter. Measured
 * against the migration path:
 *
 * | URL suffix | survives the strip | migration `ssl` |
 * |---|---|---|
 * | none | — | `{ rejectUnauthorized: false }` |
 * | `?ssl_mode=disable` | no | `{ rejectUnauthorized: false }` |
 * | `?ssl_mode=false` | no | `{ rejectUnauthorized: false }` |
 * | `?sslmode=disable` | **yes** | `false` |
 *
 * So `?sslmode=disable` would in fact have fixed the outage. It is still not
 * what this deployment uses, for three reasons that survive the correction:
 *
 * 1. **It cannot express `verify-full` — and that is the only mode it cannot
 *    express.** Be exact here, because the tempting overstatement is wrong in
 *    the other direction: `getDefaultDriverOptions` returns one of exactly two
 *    objects, and its *non-matching* branch is this file's `require` mapping,
 *    byte for byte. So a URL can produce `ssl: false` and can produce
 *    `ssl: { rejectUnauthorized: false }` — the latter simply by not matching,
 *    which is what the outage was. What no URL can produce is `ssl: true`.
 *    Verification is reachable through `driverOptions` and nowhere else.
 * 2. **Leaving it to the URL is what made the two paths disagree.** The
 *    heuristic steers a *default* that applies only when `driverOptions` is
 *    absent — and when it is absent the runtime does not consult the heuristic
 *    at all, it falls through `?? false`. One connection string therefore
 *    yields two different `ssl` values depending on which entry point read it.
 *    Stating the options is what removes the disagreement, whatever the value.
 * 3. **It works by matching a substring of a URL, not by being read.** It is a
 *    regex over the whole connection string, one underscore away from the
 *    spelling that is silently deleted.
 *
 * `projectConfig.databaseDriverOptions` is what both paths honour
 * deterministically, and the only one of the two that can say all three things.
 * That is the narrower — and true — reason for this design.
 *
 * **A URL that carries `sslmode=` still wins over this setting at the `pg`
 * layer**, in both directions: `connection-parameters.js:60` does
 * `Object.assign({}, config, parse(config.connectionString))`, so the parsed
 * URL is applied *over* the explicit `ssl`. Measured — `?sslmode=require` with
 * this set to `disable` resolves to `ssl = {}` and attempts TLS, and
 * `?sslmode=disable` against `verify-full` resolves to `ssl = false` and drops
 * it. No cluster workload supplies a `DATABASE_URL` at all, so the two never
 * meet in a real deployment; do not introduce one that carries `sslmode`.
 *
 * ## Why a variable rather than a constant
 *
 * Hardcoding `ssl: false` would be correct today and would have to be found and
 * unpicked the day PostgreSQL gets TLS or the database moves to a managed
 * instance. `DATABASE_SSL_MODE` makes that a manifest change with no code in
 * it — and `require` is deliberately byte-identical to Medusa's own remote
 * default, so taking that step lands on exactly the options Medusa would have
 * chosen unprompted.
 *
 * The variable is **optional**, and stays optional. It is absent from every
 * `deploys` manifest, from `compose.yaml`, from the Dockerfile and from CI, and
 * requiring it would turn a one-repository fix into a cross-repository contract
 * change. Unset means `disable`, which is the deployment that exists.
 *
 * An **empty** value is absent, for the same reason it is for `DATABASE_URL`:
 * an ESO-projected key whose OpenBao field is absent arrives as `""`, and an
 * optional variable that refused on `""` would not be optional.
 *
 * @throws if the mode is neither empty nor one of {@link sslModes}. Refusing is
 * the point: quietly reading an unrecognised value as one of the three would be
 * a silent downgrade on the one setting whose whole job is to say how much
 * verification is wanted.
 */
export function resolveDatabaseDriverOptions(
  environment: RuntimeEnvironment,
): DatabaseDriverOptions {
  const configured = environment.DATABASE_SSL_MODE?.trim();
  const mode = configured === undefined || configured.length === 0 ? "disable" : configured;

  if (!isSslMode(mode)) {
    throw new Error(
      `DATABASE_SSL_MODE must be one of ${sslModes.join(", ")}, or unset for ` +
        `${sslModes[0]}.`,
    );
  }

  // Rebuilt per call rather than shared from a lookup table: these objects are
  // handed straight to Medusa and on to node-postgres, and a shared one is a
  // single mutation away from changing what every other consumer connects with.
  switch (mode) {
    case "require":
      return { connection: { ssl: { rejectUnauthorized: false } } };
    case "verify-full":
      return { connection: { ssl: true } };
    default:
      return { connection: { ssl: false } };
  }
}
