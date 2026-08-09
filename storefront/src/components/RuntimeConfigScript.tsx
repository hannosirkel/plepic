/**
 * Renders the one serialized runtime-config object the browser gets, as an
 * inert `type="application/json"` script element.
 *
 * This is a plain presentational component — it takes the config and the
 * nonce as props rather than computing them itself, so it stays a Server
 * Component that can be unit-tested by rendering it with fixed input, and so
 * `src/app/layout.tsx` (the one place per-request values are actually read:
 * `headers()`, `process.env`) stays the single place that happens. No
 * `NEXT_PUBLIC_*` variable is involved anywhere in this path.
 *
 * The nonce is attached even though a JSON-typed script block never executes
 * as script — see `src/lib/client-runtime-config.ts` for why that belt is
 * kept alongside the braces.
 */

import { RUNTIME_CONFIG_ELEMENT_ID, type ClientRuntimeConfig } from "../lib/client-runtime-config.js";
import { serializeInlineJson } from "../lib/inline-json.js";

export interface RuntimeConfigScriptProps {
  readonly config: ClientRuntimeConfig;
  readonly nonce: string | undefined;
}

export function RuntimeConfigScript({ config, nonce }: RuntimeConfigScriptProps) {
  return (
    <script
      id={RUNTIME_CONFIG_ELEMENT_ID}
      type="application/json"
      nonce={nonce}
      // Inert JSON payload (type="application/json" never executes), not
      // script — but still escaped, because a closing script tag inside any
      // configured value would end this element early regardless of its type.
      // See src/lib/inline-json.ts.
      dangerouslySetInnerHTML={{ __html: serializeInlineJson(config) }}
    />
  );
}
