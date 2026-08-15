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

/**
 * An `emailpass` identity as the seeding needs to see it.
 *
 * `app_metadata` is part of the port rather than an implementation detail
 * because it carries the *link*: an identity whose `app_metadata.user_id` does
 * not name the administrator cannot sign that administrator in, and an identity
 * fetched without it cannot be told apart from one that is properly linked.
 * Medusa types it as an open record, so the link is read through
 * {@link linkedUserId} rather than by assertion.
 */
export interface AdministratorAuthIdentity {
  readonly id: string;
  readonly app_metadata?: Record<string, unknown> | null;
}

export interface AdministratorSeedPort {
  /** The administrator user, if one already exists for this address. */
  findAdministrator(email: string): Promise<{ readonly id: string } | undefined>;
  /** The `emailpass` auth identity, if one already exists for this address. */
  findAuthIdentity(email: string): Promise<AdministratorAuthIdentity | undefined>;
  registerAuthIdentity(email: string, password: string): Promise<AdministratorAuthIdentity>;
  createAdministrator(email: string): Promise<{ readonly id: string }>;
  linkAuthIdentity(authIdentityId: string, userId: string): Promise<void>;
}

export type AdministratorSeedOutcome = "created" | "repaired" | "already-present";

/** The user this identity can sign in, if it can sign in anyone. */
function linkedUserId(identity: AdministratorAuthIdentity): string | undefined {
  const userId = identity.app_metadata?.user_id;
  return typeof userId === "string" && userId.length > 0 ? userId : undefined;
}

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
 * Ensure there is an administrator for this address who can actually sign in.
 *
 * **The condition is the link, not the user.** An administrator is only usable
 * when three things hold together: the user exists, an `emailpass` identity
 * exists for the same address, and that identity's `app_metadata.user_id` names
 * that user. Seeding writes them in three steps, so either gap between them can
 * be a pod's last instant, and there is no transaction spanning two Medusa
 * modules that would make it otherwise.
 *
 * Checking only the user was a real defect, not a theoretical one. An
 * interruption between {@link AdministratorSeedPort.createAdministrator} and
 * {@link AdministratorSeedPort.linkAuthIdentity} leaves a user nothing points
 * at; a run that returned `already-present` on that user exited **0**, so
 * Kubernetes stopped retrying, the Argo CD sync went green, and the environment
 * had an Admin nobody could sign in to. It never self-healed, because every
 * later run short-circuited on the same wreckage. Under `backoffLimit` the
 * second attempt is the *expected* path, which is precisely why it must not be
 * the one that hides the damage.
 *
 * So a run that finds an existing administrator verifies the link and repairs
 * it — adopting an identity that is already there, registering one only when
 * there is none at all. What it never does is re-register over an identity that
 * works: the Job holds the Secret on every sync, and re-registering would undo
 * a password rotated through Medusa at the next promoted digest. Registration
 * happens only where no identity exists, where there is no password to keep.
 *
 * The order is identity, then user, then link, which makes the *other* window
 * self-healing without any repair: a failure before the user exists leaves an
 * orphaned identity, and the next run adopts it rather than re-registering —
 * `register` refuses a duplicate, so a run that tried would fail forever on a
 * state it created itself.
 */
export async function seedInitialAdministrator(
  port: AdministratorSeedPort,
  credentials: AdministratorCredentials,
): Promise<AdministratorSeedOutcome> {
  const existing = await port.findAdministrator(credentials.email);
  const identity = await port.findAuthIdentity(credentials.email);

  if (existing !== undefined) {
    if (identity !== undefined && linkedUserId(identity) === existing.id) {
      return "already-present";
    }

    const usable =
      identity ?? (await port.registerAuthIdentity(credentials.email, credentials.password));

    await port.linkAuthIdentity(usable.id, existing.id);

    return "repaired";
  }

  const registered =
    identity ?? (await port.registerAuthIdentity(credentials.email, credentials.password));

  const user = await port.createAdministrator(credentials.email);
  await port.linkAuthIdentity(registered.id, user.id);

  return "created";
}
