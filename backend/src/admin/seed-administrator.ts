/**
 * The initial Medusa administrator the predeploy Job seeds.
 *
 * `deploys/plepic/base/predeploy-job.yaml` projects `MEDUSA_ADMIN_EMAIL` and
 * `MEDUSA_ADMIN_PASSWORD` from the environment's `*-database-admin` Secret and
 * is that Secret's only consumer, which is exactly the boundary that source
 * draws: the superuser password, the initial administrator, and nothing a
 * running pod can read.
 *
 * The logic lives here rather than in `src/scripts/`, behind a port, because
 * the interesting behaviour is not the Medusa API call. It is that the Job is
 * an Argo CD sync hook which runs again on every promoted digest and must
 * therefore be a no-op the second time, and that it must survive its own
 * partial failure — none of which is observable from a script that can only be
 * tested by booting Medusa against a database.
 *
 * Medusa's own `medusa user` CLI command is not used, for both of those
 * reasons: it creates unconditionally, so a second run fails on the duplicate
 * email and the Argo CD sync fails with it, and it `process.exit(1)`s on a
 * registration error after having already created the user — leaving exactly
 * the orphan state below.
 */

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export interface AdministratorCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AdministratorSeedPort {
  /** The administrator user, if one already exists for this address. */
  findAdministrator(email: string): Promise<{ readonly id: string } | undefined>;
  /** The `emailpass` auth identity, if one already exists for this address. */
  findAuthIdentity(email: string): Promise<{ readonly id: string } | undefined>;
  registerAuthIdentity(email: string, password: string): Promise<{ readonly id: string }>;
  createAdministrator(email: string): Promise<{ readonly id: string }>;
  linkAuthIdentity(authIdentityId: string, userId: string): Promise<void>;
}

export type AdministratorSeedOutcome = "created" | "already-present";

/**
 * Read the credentials, fail closed, and never echo the password.
 *
 * The address is checked for the same line-break injection the mail
 * configuration checks for: it becomes the login identity and is rendered into
 * logs, and a value carrying `\r\n` is not an address.
 */
export function readAdministratorCredentials(
  environment: RuntimeEnvironment,
): AdministratorCredentials {
  const email = environment.MEDUSA_ADMIN_EMAIL?.trim();

  if (email === undefined || email.length === 0) {
    throw new Error("Missing required backend environment variable: MEDUSA_ADMIN_EMAIL");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email)) {
    throw new Error("MEDUSA_ADMIN_EMAIL must be a single email address");
  }

  const password = environment.MEDUSA_ADMIN_PASSWORD?.trim();

  if (password === undefined || password.length === 0) {
    throw new Error("Missing required backend environment variable: MEDUSA_ADMIN_PASSWORD");
  }

  return { email, password };
}

/**
 * Create the initial administrator if there is not one already.
 *
 * The order — identity, then user, then link — is the one that survives an
 * interruption. Medusa's CLI creates the user first, so a failure between the
 * two steps leaves a user with no way to sign in, and every subsequent run
 * sees that user and skips. Registering first inverts the residue into an
 * identity with no user, which the next run adopts.
 *
 * The existing-administrator check is on the **user**, and no branch ever
 * re-registers. The Job runs on every sync with a Secret in hand; a branch that
 * re-registered would quietly reset a password an operator had since rotated
 * through Medusa itself.
 */
export async function seedInitialAdministrator(
  port: AdministratorSeedPort,
  credentials: AdministratorCredentials,
): Promise<AdministratorSeedOutcome> {
  const existing = await port.findAdministrator(credentials.email);

  if (existing !== undefined) {
    return "already-present";
  }

  const identity =
    (await port.findAuthIdentity(credentials.email)) ??
    (await port.registerAuthIdentity(credentials.email, credentials.password));

  const user = await port.createAdministrator(credentials.email);
  await port.linkAuthIdentity(identity.id, user.id);

  return "created";
}
