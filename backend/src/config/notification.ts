import type { BackendRuntimeConfig } from "./runtime.js";
import { SMTP_NOTIFICATION_PROVIDER_ID } from "../notifications/smtp";

type SmtpConfig = BackendRuntimeConfig["smtp"];

export function notificationModule(config: SmtpConfig) {
  return {
    resolve: "@medusajs/medusa/notification",
    options: {
      providers: [
        {
          resolve: "./src/notifications",
          id: SMTP_NOTIFICATION_PROVIDER_ID,
          options: { ...config, channels: ["email"] },
        },
      ],
    },
  } as const;
}
