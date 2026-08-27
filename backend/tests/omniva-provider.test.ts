import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { OMNIVA_FULFILLMENT_PROVIDER_ID } from "../src/commerce/shipping-model.js";
import OmnivaFulfillmentProviderService from "../src/modules/omniva/service.js";

/**
 * **The three-way coupling that decides whether the predeploy Job lives,
 * closed rather than merely documented.**
 *
 * `OmnivaFulfillmentProviderService.identifier`, the `id` `medusa-config.ts`
 * registers the module under, and `OMNIVA_FULFILLMENT_PROVIDER_ID` are three
 * copies of one fact: Medusa's fulfillment provider id is
 * `<module id>_<service identifier>`, and `omniva_omniva` is only correct
 * because both halves happen to be the string `"omniva"`. Nothing compared
 * them before this file existed — `shipping-model.ts`'s docstring on
 * {@link OMNIVA_FULFILLMENT_PROVIDER_ID} stated the obligation without
 * discharging it, and all 442 other backend tests pass unchanged if
 * `identifier` is renamed to anything else, while the predeploy Job dies on
 * every environment with "Providers (omniva_omniva) are not enabled for the
 * service location".
 */
function repositoryText(relative: string): string {
  return readFileSync(join(__dirname, "..", "..", relative), "utf8");
}

describe("the Omniva provider's three-way naming coupling", () => {
  it("registers under the identifier OMNIVA_FULFILLMENT_PROVIDER_ID assumes", () => {
    expect(`${OmnivaFulfillmentProviderService.identifier}_omniva`).toBe(
      OMNIVA_FULFILLMENT_PROVIDER_ID,
    );
  });

  it("is registered in medusa-config.ts under the module id its identifier assumes", () => {
    const config = repositoryText("backend/medusa-config.ts");
    const pattern = new RegExp(
      `resolve:\\s*"\\./src/modules/omniva",\\s*id:\\s*"${OmnivaFulfillmentProviderService.identifier}"`,
    );
    expect(config, "medusa-config.ts's ./src/modules/omniva entry must be id-matched to the service's own identifier").toMatch(
      pattern,
    );
  });
});
