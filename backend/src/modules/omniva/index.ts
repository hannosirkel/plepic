import { ModuleProvider, Modules } from "@medusajs/framework/utils";

/**
 * Extensionless, unlike every other relative import in this backend.
 *
 * This is the one module `medusa-config.ts` resolves by a local path
 * (`"./src/modules/omniva"`) rather than an npm package, and it is loaded by
 * a second, independent path at `medusa build` time: MikroORM's
 * `ConfigurationLoader.registerTsNode`, monkey-patched in
 * `@medusajs/framework/dist/mikro-orm-cli/bin.js` to introspect every
 * declared module for type generation. That loader's `require()` cannot map
 * a `./service.js` specifier onto the sibling `service.ts` file the way
 * `ts-node`'s own resolver does elsewhere in this project — `bash
 * scripts/store-smoke` reproduced `Cannot find module './service.js'` from
 * exactly this path, and every other `medusa build` in this repository had
 * always run against pre-compiled npm packages, so nothing had exercised a
 * local, uncompiled TypeScript module before. Dropping the extension here
 * lets Node's own extensionless resolution (which does try `.ts` once
 * `ts-node` has registered it) find the file instead, and the compiled
 * `.medusa/server` output — `require("./service")` against a real
 * `service.js` — is unaffected either way.
 */
import OmnivaFulfillmentProviderService from "./service";

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [OmnivaFulfillmentProviderService],
});
