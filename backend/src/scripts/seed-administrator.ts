import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { ExecArgs, IAuthModuleService, IUserModuleService } from "@medusajs/framework/types";

import {
  readAdministratorCredentials,
  seedInitialAdministrator,
  type AdministratorSeedPort,
} from "../admin/seed-administrator.js";

/** The provider `medusa user` registers against, and the one Admin signs in with. */
const PROVIDER = "emailpass";

/**
 * The second half of `npm run predeploy` — `medusa db:migrate` runs first, and
 * this seeds the initial administrator into the database it just migrated.
 *
 * Both halves are the predeploy Job's, and the Job is the only consumer of the
 * `*-database-admin` Secret those credentials come from. Splitting them across
 * two commands rather than two Jobs keeps a single Argo CD sync hook gating
 * everything else, which is what the plan requires: migrate, seed, and only
 * then let an API or worker pod start.
 *
 * `medusa exec` sets `MEDUSA_WORKER_MODE=server` before loading anything, so
 * this never contends with the worker Deployment for a job queue.
 *
 * The decision is logged; the password is not, and nor is anything derived from
 * it. `already-present` is the expected outcome on every sync after the first.
 */
export default async function seedAdministrator({ container }: ExecArgs): Promise<void> {
  const credentials = readAdministratorCredentials(process.env);

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const auth = container.resolve<IAuthModuleService>(Modules.AUTH);
  const users = container.resolve<IUserModuleService>(Modules.USER);

  const port: AdministratorSeedPort = {
    findAdministrator: async (email) => (await users.listUsers({ email }, { take: 1 }))[0],

    // No `select` on purpose: `app_metadata` carries the link to the user, and
    // the seeding decides whether the administrator can sign in by reading it.
    // Narrowing the projection here would make every existing administrator
    // look unlinked and send every run down the repair path.
    findAuthIdentity: async (email) =>
      (
        await auth.listAuthIdentities(
          { provider_identities: { entity_id: email, provider: PROVIDER } },
          { take: 1 },
        )
      )[0],

    registerAuthIdentity: async (email, password) => {
      const { authIdentity, error } = await auth.register(PROVIDER, {
        body: { email, password },
      });

      // The provider reports refusals as a value rather than by throwing, and
      // the message is the provider's own — it carries the address, never the
      // password.
      if (error !== undefined && error !== null) {
        throw new Error(`Could not register the initial administrator: ${error}`);
      }

      if (authIdentity === undefined) {
        throw new Error("The auth provider registered no identity for the initial administrator");
      }

      return authIdentity;
    },

    createAdministrator: async (email) => await users.createUsers({ email }),

    linkAuthIdentity: async (authIdentityId, userId) => {
      await auth.updateAuthIdentities({
        id: authIdentityId,
        app_metadata: { user_id: userId },
      });
    },
  };

  const outcome = await seedInitialAdministrator(port, credentials);

  logger.info(`initial administrator ${outcome}: ${credentials.email}`);
}
