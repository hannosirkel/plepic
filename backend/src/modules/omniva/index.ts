import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import OmnivaFulfillmentProviderService from "./service.js";

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [OmnivaFulfillmentProviderService],
});
