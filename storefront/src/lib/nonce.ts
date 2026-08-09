/**
 * Reads the CSP nonce `proxy.ts` minted for this request and forwarded as the
 * `x-nonce` request header. Any Server Component that renders an inline
 * `<script>` — the runtime-config blob, the analytics bootstrap, the GA
 * inline init, the product page's JSON-LD — reads it from here rather than
 * generating its own, because the nonce the browser is told to trust is the
 * one `proxy.ts` put in the `Content-Security-Policy` response header, and
 * only one nonce may be minted per request for the two to match.
 *
 * `x-nonce` is this application's own convention and nothing else reads it.
 * Next.js derives the nonce it stamps on its *own* scripts by parsing the
 * `content-security-policy` **request** header, which `proxy.ts` sets from
 * the same value — see that file's doc comment.
 */

import { headers } from "next/headers";

export async function getRequestNonce(): Promise<string | undefined> {
  const headerList = await headers();
  return headerList.get("x-nonce") ?? undefined;
}
