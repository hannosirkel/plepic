import { describe, expect, it, vi } from "vitest";

import {
  readAdministratorCredentials,
  seedInitialAdministrator,
  type AdministratorSeedPort,
} from "../src/admin/seed-administrator.js";

const credentials = {
  email: "admin@example.test",
  password: "an-ordinary-password",
} as const;

function port(overrides: Partial<AdministratorSeedPort> = {}): AdministratorSeedPort {
  return {
    findAdministrator: vi.fn(async () => undefined),
    findAuthIdentity: vi.fn(async () => undefined),
    registerAuthIdentity: vi.fn(async () => ({ id: "authid_01" })),
    createAdministrator: vi.fn(async () => ({ id: "user_01" })),
    linkAuthIdentity: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("readAdministratorCredentials", () => {
  /**
   * `predeploy-job.yaml` projects both from the `*-database-admin` Secret and
   * is that Secret's only consumer. If either arrives empty the Job must say
   * which, rather than seeding an administrator nobody can sign in as.
   */
  it("refuses without either value, naming it", () => {
    expect(() => readAdministratorCredentials({ MEDUSA_ADMIN_PASSWORD: "x" })).toThrow(
      /MEDUSA_ADMIN_EMAIL/,
    );
    expect(() => readAdministratorCredentials({ MEDUSA_ADMIN_EMAIL: credentials.email })).toThrow(
      /MEDUSA_ADMIN_PASSWORD/,
    );
    expect(() =>
      readAdministratorCredentials({
        MEDUSA_ADMIN_EMAIL: credentials.email,
        MEDUSA_ADMIN_PASSWORD: "   ",
      }),
    ).toThrow(/MEDUSA_ADMIN_PASSWORD/);
  });

  it("rejects an address that could carry a second header line", () => {
    expect(() =>
      readAdministratorCredentials({
        MEDUSA_ADMIN_EMAIL: "admin@example.test\r\nBcc: attacker@example.test",
        MEDUSA_ADMIN_PASSWORD: "x",
      }),
    ).toThrow(/MEDUSA_ADMIN_EMAIL/);
  });

  /** A Job log is not a place for the administrator password. */
  it("never puts the password in the refusal", () => {
    let raised: unknown;
    try {
      readAdministratorCredentials({
        MEDUSA_ADMIN_EMAIL: "not-an-address",
        MEDUSA_ADMIN_PASSWORD: credentials.password,
      });
    } catch (error) {
      raised = error;
    }

    expect(raised).toBeInstanceOf(Error);
    expect(`${(raised as Error).message}\n${(raised as Error).stack ?? ""}`).not.toContain(
      credentials.password,
    );
  });

  it("returns both values when both are supplied", () => {
    expect(
      readAdministratorCredentials({
        MEDUSA_ADMIN_EMAIL: `  ${credentials.email}  `,
        MEDUSA_ADMIN_PASSWORD: credentials.password,
      }),
    ).toEqual(credentials);
  });
});

describe("seedInitialAdministrator", () => {
  it("registers the identity, creates the user and links them", async () => {
    const seed = port();

    await expect(seedInitialAdministrator(seed, credentials)).resolves.toBe("created");

    expect(seed.registerAuthIdentity).toHaveBeenCalledWith(credentials.email, credentials.password);
    expect(seed.createAdministrator).toHaveBeenCalledWith(credentials.email);
    expect(seed.linkAuthIdentity).toHaveBeenCalledWith("authid_01", "user_01");
  });

  /**
   * The Job is an Argo CD sync hook. It runs again on every promoted digest,
   * against a database that already has an administrator, and a second run must
   * be a no-op rather than a duplicate-email failure that blocks the sync.
   */
  it("is a no-op when the administrator already exists", async () => {
    const seed = port({ findAdministrator: vi.fn(async () => ({ id: "user_01" })) });

    await expect(seedInitialAdministrator(seed, credentials)).resolves.toBe("already-present");

    expect(seed.registerAuthIdentity).not.toHaveBeenCalled();
    expect(seed.createAdministrator).not.toHaveBeenCalled();
    expect(seed.linkAuthIdentity).not.toHaveBeenCalled();
  });

  /**
   * Never rotates the password of an administrator who already exists.
   * The Job runs on every sync; re-registering would reset a password the
   * operator may since have changed, from a Secret, silently.
   */
  it("does not re-register an existing administrator's credentials", async () => {
    const seed = port({
      findAdministrator: vi.fn(async () => ({ id: "user_01" })),
      findAuthIdentity: vi.fn(async () => ({ id: "authid_01" })),
    });

    await seedInitialAdministrator(seed, credentials);

    expect(seed.registerAuthIdentity).not.toHaveBeenCalled();
  });

  /**
   * The half-created state a previous attempt can leave behind. `backoffLimit`
   * on the Job means a retry is the expected recovery, so an identity without a
   * user must be adopted rather than re-registered — `register` refuses a
   * duplicate, and the Job would then fail forever on a state it created.
   */
  it("adopts an orphaned auth identity from an interrupted run", async () => {
    const seed = port({ findAuthIdentity: vi.fn(async () => ({ id: "orphan_01" })) });

    await expect(seedInitialAdministrator(seed, credentials)).resolves.toBe("created");

    expect(seed.registerAuthIdentity).not.toHaveBeenCalled();
    expect(seed.linkAuthIdentity).toHaveBeenCalledWith("orphan_01", "user_01");
  });

  it("reports a failure without the password in it", async () => {
    const seed = port({
      registerAuthIdentity: vi.fn(async () => {
        throw new Error("the provider refused");
      }),
    });

    await expect(seedInitialAdministrator(seed, credentials)).rejects.toThrow(
      /the provider refused/,
    );
  });
});
