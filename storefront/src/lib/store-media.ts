/**
 * The browser half of the media delivery contract.
 *
 * Imported media lands on the assets PVC; Medusa's local file provider serves
 * it under `/static/*` and records that path in the product's image URLs; the
 * storefront exposes the same bytes at `/store-api/static/*` through the
 * allowlisted prefix in `store-api-transport.ts`. This module is the single
 * place that converts one form into the other, so **every product image URL
 * the browser receives is that relative form**: a URL this function will not
 * convert is a URL the browser never sees.
 *
 * Returning `null` rather than throwing is deliberate. An unexpected image URL
 * — an absolute CDN origin, a traversal, an encoding — must not reach the
 * browser, and must also not take the product page down with it. Dropping it is
 * the refusal.
 */
const BACKEND_MEDIA_PREFIX = "/static/";
const BROWSER_MEDIA_PREFIX = "/store-api/static/";

/**
 * The same filename shape the import will write — see
 * `backend/src/catalogue-import/paths.ts`. Written out rather than shared
 * because the two workspaces are separate programs and a cross-workspace
 * import would make the storefront's build depend on the backend's; the pair is
 * pinned by `tests/store-media.test.ts` and
 * `backend/tests/catalogue-import-media-contract.test.ts` asserting the same
 * crafted names.
 */
const SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;

/** Converts a backend media URL to the relative form the browser is given, or `null`. */
export function browserMediaUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(BACKEND_MEDIA_PREFIX)) return null;

  const filename = value.slice(BACKEND_MEDIA_PREFIX.length);
  if (filename.length === 0 || filename.length > 128) return null;
  if (!SAFE_FILENAME.test(filename) || filename.includes("..")) return null;

  return `${BROWSER_MEDIA_PREFIX}${filename}`;
}

/** Every image URL of one Store product, in the relative form, hostile ones dropped. */
export function browserMediaUrls(values: readonly unknown[]): readonly string[] {
  return values.flatMap((value) => {
    const url = browserMediaUrl(value);
    return url === null ? [] : [url];
  });
}
