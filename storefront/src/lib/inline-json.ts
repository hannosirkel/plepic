/**
 * Serializing a JSON payload for `dangerouslySetInnerHTML`.
 *
 * Every inline JSON block this application emits goes through here — the
 * runtime-config blob (`components/RuntimeConfigScript.tsx`) and the product
 * page's structured data (`components/JsonLdScript.tsx`) — because raw
 * `JSON.stringify` is not safe inside a `<script>` element. An HTML parser
 * does not tokenise script content as JSON: it scans for `</script`, so a
 * `</script>` sequence in *any* string value closes the tag early and turns
 * the rest of the payload into markup. Both payloads carry operator- or
 * content-supplied strings, so neither is exempt.
 *
 * Escaping every `<` as its `<` escape is sufficient and lossless: in
 * `JSON.stringify` output a `<` can only ever occur inside a string literal
 * (no structural JSON character is `<`), the escape is valid JSON there, and
 * `JSON.parse` restores the original character.
 */

/** Escapes `<` so the serialized payload cannot close its enclosing `<script>` tag early. */
export function serializeInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
