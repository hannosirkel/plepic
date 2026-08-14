import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { readBackendRuntimeConfig } from "../../../config/runtime.js";
import { relayContactMessage } from "../../../contact/relay.js";
import { SmtpSender } from "../../../notifications/smtp.js";

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const runtime = readBackendRuntimeConfig(process.env);
  const status = await relayContactMessage(
    req.body,
    {
      recipient: runtime.contactMailRecipient,
      turnstileSecretKey: runtime.turnstileSecretKey,
    },
    new SmtpSender(runtime.smtp),
  );
  res.sendStatus(status);
}
