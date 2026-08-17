import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.redirect("/app");
}
