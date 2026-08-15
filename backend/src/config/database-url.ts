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
