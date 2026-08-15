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

/**
 * A store that actually holds state, rather than stubs that answer in
 * isolation.
 *
 * The defect this replaces was invisible to stubs: each call answered
 * plausibly on its own, and only the *sequence* — create the user, fail before
 * linking, run again — produced an administrator nobody could sign in as. So
 * the tests below run the real function against a store that remembers what
 * previous runs did, and interrupt it at a chosen step.
 *
 * `canSignIn` is the whole point of the exercise, and it is deliberately the
 * complete condition rather than a proxy for it: a user exists, an `emailpass`
 * identity exists for the same address, that identity's `app_metadata.user_id`
 * points at that user, and the password on it is the one being offered. Three
 * of those four were true in the broken state.
 */
function fakeStore() {
  interface StoredIdentity {
    id: string;
    password: string;
    app_metadata?: Record<string, unknown>;
  }

  const users = new Map<string, { id: string }>();
  const identities = new Map<string, StoredIdentity>();
  const interrupt = { register: false, create: false, link: false };
  let sequence = 0;

  const seedPort: AdministratorSeedPort = {
    findAdministrator: async (email) => users.get(email),

    findAuthIdentity: async (email) => identities.get(email),

    registerAuthIdentity: async (email, password) => {
      if (interrupt.register) throw new Error("interrupted at register");
      // The real provider refuses a duplicate; a fake that quietly overwrote
      // would hide exactly the failure adoption exists to avoid.
      if (identities.has(email)) throw new Error("identity already exists");
      const identity: StoredIdentity = { id: `authid_${++sequence}`, password };
      identities.set(email, identity);
      return identity;
    },

    createAdministrator: async (email) => {
      if (interrupt.create) throw new Error("interrupted at create");
      if (users.has(email)) throw new Error("duplicate email");
      const user = { id: `user_${++sequence}` };
      users.set(email, user);
      return user;
    },

    linkAuthIdentity: async (authIdentityId, userId) => {
      if (interrupt.link) throw new Error("interrupted at link");
      const identity = [...identities.values()].find((each) => each.id === authIdentityId);
      if (!identity) throw new Error(`no such auth identity: ${authIdentityId}`);
      identity.app_metadata = { ...identity.app_metadata, user_id: userId };
    },
  };

  return {
    port: seedPort,
    interrupt,
    users,
    identities,
    canSignIn(email: string, password: string): boolean {
      const user = users.get(email);
      const identity = identities.get(email);
      return Boolean(
        user &&
          identity &&
          identity.app_metadata?.user_id === user.id &&
          identity.password === password,
      );
    },
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
  it("is a no-op when the administrator already exists and can sign in", async () => {
    const seed = port({
      findAdministrator: vi.fn(async () => ({ id: "user_01" })),
      findAuthIdentity: vi.fn(async () => ({
        id: "authid_01",
        app_metadata: { user_id: "user_01" },
      })),
    });

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
      findAuthIdentity: vi.fn(async () => ({
        id: "authid_01",
        app_metadata: { user_id: "user_01" },
      })),
    });

    await seedInitialAdministrator(seed, credentials);

    expect(seed.registerAuthIdentity).not.toHaveBeenCalled();
  });

  /**
   * An existing administrator is not evidence of a complete one.
   *
   * The user is created before the identity is linked, so an interruption in
   * that window leaves a user with no identity pointing at them. Returning
   * `already-present` on the user alone made every later run short-circuit on
   * the wreckage of the first, and — because the Job then exits 0 — turned a
   * broken environment into a green Argo CD sync.
   */
  it("repairs an administrator whose identity was never linked", async () => {
    const seed = port({ findAdministrator: vi.fn(async () => ({ id: "user_01" })) });

    await expect(seedInitialAdministrator(seed, credentials)).resolves.toBe("repaired");

    expect(seed.createAdministrator).not.toHaveBeenCalled();
    expect(seed.registerAuthIdentity).toHaveBeenCalledWith(credentials.email, credentials.password);
    expect(seed.linkAuthIdentity).toHaveBeenCalledWith("authid_01", "user_01");
  });

  /** The same repair where the identity survived but the link did not. */
  it("relinks an existing identity rather than registering a second one", async () => {
    const seed = port({
      findAdministrator: vi.fn(async () => ({ id: "user_01" })),
      findAuthIdentity: vi.fn(async () => ({ id: "orphan_01" })),
    });

    await expect(seedInitialAdministrator(seed, credentials)).resolves.toBe("repaired");

    expect(seed.registerAuthIdentity).not.toHaveBeenCalled();
    expect(seed.linkAuthIdentity).toHaveBeenCalledWith("orphan_01", "user_01");
  });

  /** An identity pointing at some other user cannot sign this one in either. */
  it("repairs an identity linked to a different user", async () => {
    const seed = port({
      findAdministrator: vi.fn(async () => ({ id: "user_01" })),
      findAuthIdentity: vi.fn(async () => ({
        id: "authid_01",
        app_metadata: { user_id: "user_99" },
      })),
    });

    await expect(seedInitialAdministrator(seed, credentials)).resolves.toBe("repaired");

    expect(seed.registerAuthIdentity).not.toHaveBeenCalled();
    expect(seed.linkAuthIdentity).toHaveBeenCalledWith("authid_01", "user_01");
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

/**
 * Every way a run can be cut short, driven against a store that remembers.
 *
 * This is the Job's real recovery path rather than a hypothetical one:
 * `backoffLimit` means Kubernetes reruns the pod after a non-zero exit, and
 * Argo CD reruns the hook on every promoted digest. What matters is not that a
 * rerun *succeeds* — it is that the administrator can sign in afterwards. A
 * rerun that returns `already-present` over a half-built administrator exits 0,
 * turns the sync green, and hides the damage until somebody tries the Admin.
 */
describe("seedInitialAdministrator across interrupted runs", () => {
  const { email, password } = credentials;

  it("leaves an administrator who can sign in, uninterrupted", async () => {
    const store = fakeStore();

    await expect(seedInitialAdministrator(store.port, credentials)).resolves.toBe("created");
    expect(store.canSignIn(email, password)).toBe(true);

    await expect(seedInitialAdministrator(store.port, credentials)).resolves.toBe(
      "already-present",
    );
    expect(store.canSignIn(email, password)).toBe(true);
  });

  /** Window A: interrupted between registering the identity and creating the user. */
  it("recovers when the first run died before the user existed", async () => {
    const store = fakeStore();

    store.interrupt.create = true;
    await expect(seedInitialAdministrator(store.port, credentials)).rejects.toThrow(
      /interrupted at create/,
    );
    expect(store.canSignIn(email, password)).toBe(false);

    store.interrupt.create = false;
    await expect(seedInitialAdministrator(store.port, credentials)).resolves.toBe("created");
    expect(store.canSignIn(email, password)).toBe(true);
  });

  /**
   * Window B: interrupted between creating the user and linking the identity.
   *
   * This is the one that used to end with a green sync and an Admin nobody
   * could sign in to, and it never self-healed — the third run short-circuited
   * on the same user as the second.
   */
  it("recovers when the first run died after the user existed but before the link", async () => {
    const store = fakeStore();

    store.interrupt.link = true;
    await expect(seedInitialAdministrator(store.port, credentials)).rejects.toThrow(
      /interrupted at link/,
    );
    expect(store.users.get(email)).toBeDefined();
    expect(store.canSignIn(email, password)).toBe(false);

    store.interrupt.link = false;
    await expect(seedInitialAdministrator(store.port, credentials)).resolves.toBe("repaired");
    expect(store.canSignIn(email, password)).toBe(true);

    await expect(seedInitialAdministrator(store.port, credentials)).resolves.toBe(
      "already-present",
    );
    expect(store.canSignIn(email, password)).toBe(true);
  });

  /** Neither window may end with two identities for one address. */
  it("never registers a second identity for the same address", async () => {
    const store = fakeStore();

    store.interrupt.link = true;
    await expect(seedInitialAdministrator(store.port, credentials)).rejects.toThrow();
    store.interrupt.link = false;

    await seedInitialAdministrator(store.port, credentials);
    await seedInitialAdministrator(store.port, credentials);

    expect(store.identities.size).toBe(1);
    expect(store.users.size).toBe(1);
  });

  /**
   * A repair must not become a password reset for an administrator who is
   * already able to sign in. The Job holds the Secret on every sync; if a later
   * run re-registered, rotating the password through Medusa would be undone
   * silently at the next promoted digest.
   */
  it("does not overwrite the password of an administrator who can already sign in", async () => {
    const store = fakeStore();

    await seedInitialAdministrator(store.port, credentials);
    await seedInitialAdministrator(store.port, { email, password: "a-different-password" });

    expect(store.canSignIn(email, password)).toBe(true);
    expect(store.canSignIn(email, "a-different-password")).toBe(false);
  });
});
