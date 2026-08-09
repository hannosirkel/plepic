import { serializeInlineJson } from "../lib/inline-json.js";

export interface JsonLdScriptProps {
  readonly data: Record<string, unknown>;
  /**
   * This request's CSP nonce, from `src/lib/nonce.ts`. Not strictly required —
   * an `application/ld+json` block is a data block, which HTML's "prepare the
   * script element" algorithm abandons before it ever reaches the Content
   * Security Policy check, so `script-src` does not apply to it. It is passed
   * anyway, for the same reason `RuntimeConfigScript` carries one: the cost is
   * one attribute, and the guarantee then does not depend on a parser detail
   * staying true.
   */
  readonly nonce: string | undefined;
}

/**
 * A native `<script type="application/ld+json">`, not `next/script` —
 * structured data is not executable JavaScript, so it needs no loading
 * strategy, only escaping so it cannot close its own tag early.
 */
export function JsonLdScript({ data, nonce }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Escaped JSON-LD, not executable script — see serializeInlineJson.
      dangerouslySetInnerHTML={{ __html: serializeInlineJson(data) }}
    />
  );
}
