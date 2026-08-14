import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import SmtpNotificationProvider from "./smtp";

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [SmtpNotificationProvider],
});
