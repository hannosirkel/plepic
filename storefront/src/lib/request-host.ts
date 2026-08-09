/**
 * The incoming request's `Host` header, read server-side. This is how a
 * Server Component learns which hostname it is answering for, so it can
 * classify it against validated configuration (see `config/hosts.ts`)
 * instead of parsing `request.url` or trusting a client-supplied value.
 */

import { headers } from "next/headers";

export async function getRequestHost(): Promise<string | undefined> {
  const headerList = await headers();
  return headerList.get("host") ?? undefined;
}
