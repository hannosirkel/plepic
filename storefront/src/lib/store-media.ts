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

/**
 * Is this string a URL the file provider hands out, rather than one this module
 * produced? Both forms count: the relative `/static/<file>` the seeded backend
 * records, and any absolute URL whose path is under `/static/` — which is what
 * `@medusajs/file-local` returns by default (`http://localhost:9000/static/…`)
 * and what an S3 or CDN provider would return if one were ever configured.
 *
 * `/store-api/static/<file>` is not one: it does not start with `/static/`, and
 * it is relative, so it has no origin to inspect.
 */
function isProviderMediaUrl(value: string): boolean {
  if (value.startsWith(BACKEND_MEDIA_PREFIX)) return true;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return false;
  try {
    return new URL(value).pathname.startsWith(BACKEND_MEDIA_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Refuses any product payload that carries a provider media URL, anywhere in
 * it, and returns it otherwise.
 *
 * This is the render leg of the media delivery contract, enforced where the
 * product data is built rather than where it is displayed. `browserMediaUrl`
 * converts; this makes conversion the only way out. Nothing in the payload the
 * storefront builds today can trip it — which is the point: it is what stops a
 * later consumer adding `thumbnail: product.thumbnail` to that payload and
 * quietly shipping a `http://localhost:9000/static/…` URL to a shopper's
 * browser. Every future consumer of the Store seam inherits the refusal without
 * having to know the contract exists.
 *
 * It throws where {@link browserMediaUrl} drops, and the difference is
 * deliberate. Dropping is right for one hostile URL among a product's images —
 * an odd image must not take the product page down. Throwing is right here,
 * because a provider URL in this payload is not hostile data, it is a
 * programming error in this repository, and it should stop CI rather than
 * reach a browser.
 */
export function assertBrowserMediaOnly<T>(payload: T): T {
  const pending: unknown[] = [payload];

  while (pending.length > 0) {
    const value = pending.pop();

    if (typeof value === "string") {
      if (isProviderMediaUrl(value)) {
        throw new Error(
          `refused to hand the browser a provider media URL; convert it with browserMediaUrl first`,
        );
      }
      continue;
    }
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (typeof value === "object" && value !== null) pending.push(...Object.values(value));
  }

  return payload;
}
