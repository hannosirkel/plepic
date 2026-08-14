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
 * Any absolute URL, including the protocol-relative `//host/path` form.
 *
 * The browser is given **relative** media URLs on the current origin and
 * nothing else, so inside a media field "absolute" and "not ours" are the same
 * question and this is the whole of the test. Matching `/static/` in the path
 * instead — which is what this used to do — caught only what
 * `@medusajs/file-local` happens to hand out (`http://localhost:9000/static/...`)
 * and let an S3 URL, a CDN URL and a protocol-relative `//host/static/...`
 * straight through the guard that claimed to cover them.
 */
const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/**
 * The words that make a field a media field.
 *
 * Field **names**, not values, are what this guard reasons about, and the
 * matching is by word rather than by exact name so that a consumer adding
 * `heroImage`, `image_urls`, `boxArt` or `posterUrl` inherits the refusal
 * without anyone having to come back and extend a list. `name`, `title`,
 * `description` and `availability` contain none of these words, which is the
 * other half of the point: they are Admin-editable catalogue text and are not
 * this guard's business.
 */
const MEDIA_FIELD_WORDS = new Set([
  "art", "artwork", "asset", "assets", "audio", "avatar", "banner", "cover",
  "favicon", "file", "files", "gallery", "hero", "icon", "image", "images",
  "img", "imgs", "logo", "media", "photo", "photos", "picture", "pictures",
  "poster", "screenshot", "screenshots", "sprite", "thumb", "thumbnail",
  "thumbnails", "upload", "uploads", "video",
]);

/**
 * The words that name the URL *inside* a media field. Medusa's own image shape
 * is `images: [{url}]`, so the string to check often sits one level below the
 * field that makes it media.
 *
 * These count **only** under a media field. A bare `url` or `href` elsewhere in
 * a payload is a canonical or a JSON-LD identifier, and those are absolute for
 * good reason; refusing them is the false positive this scoping exists to
 * avoid.
 */
const MEDIA_URL_FIELD_WORDS = new Set(["href", "src", "srcset", "uri", "url", "urls"]);

/** `imageUrls` -> `image`, `urls`; `image_url` -> `image`, `url`. */
function fieldWords(key: string): readonly string[] {
  return key.split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/).map((word) => word.toLowerCase());
}

function isMediaField(key: string): boolean {
  return fieldWords(key).some((word) => MEDIA_FIELD_WORDS.has(word));
}

function isMediaUrlField(key: string): boolean {
  return fieldWords(key).some((word) => MEDIA_URL_FIELD_WORDS.has(word));
}

interface PendingValue {
  readonly value: unknown;
  /** Where this value sits, for the refusal message. */
  readonly field: string;
  /** Is this a value the browser would load as media? */
  readonly media: boolean;
}

/**
 * Refuses any product payload whose **media-bearing fields** carry a URL the
 * browser must not be given, and returns it otherwise.
 *
 * This is the render leg of the media delivery contract, enforced where the
 * product data is built rather than where it is displayed. `browserMediaUrl`
 * converts; this makes conversion the only way out. Nothing in the payload the
 * storefront builds today can trip it — which is the point: it is what stops a
 * later consumer adding `thumbnail: product.thumbnail` or
 * `images: product.images` to that payload and quietly shipping a
 * `http://localhost:9000/static/...` URL — or an S3 or CDN one — to a shopper's
 * browser. A consumer that adds a media field inherits the refusal without
 * having to know the contract exists, because {@link MEDIA_FIELD_WORDS} matches
 * the field's *name* rather than a list of blessed payload shapes.
 *
 * **It walks media fields, not every string.** Walking every string and
 * matching `/static/` was wrong in both directions at once. It missed the
 * absolute provider URLs it claimed to cover, and it inspected `product.title`
 * — Admin-editable text straight from Medusa — so a product retitled
 * `/static/anything` threw here and took the one canonical product page down.
 * A guard against a repository bug must not be armed by catalogue data.
 *
 * Inside a media field the rule is *any absolute URL*, plus the provider's own
 * relative `/static/` form. Deliberately **not** extended to absolute URLs
 * everywhere in the payload: canonicals and JSON-LD are absolute and
 * legitimately so.
 *
 * It throws where {@link browserMediaUrl} drops, and the difference is
 * deliberate. Dropping is right for one hostile URL among a product's images —
 * an odd image must not take the product page down. Throwing is right here,
 * because a media field of this payload is filled by this repository and
 * `browserMediaUrl` is the only thing that may fill it, so a provider URL in
 * one is a programming error rather than data, and it should stop CI rather
 * than reach a browser.
 */
export function assertBrowserMediaOnly<T>(payload: T): T {
  const pending: PendingValue[] = [{ value: payload, field: "", media: false }];

  while (pending.length > 0) {
    const entry = pending.pop() as PendingValue;
    const { value } = entry;

    if (typeof value === "string") {
      if (entry.media && (ABSOLUTE_URL.test(value) || value.startsWith(BACKEND_MEDIA_PREFIX))) {
        throw new Error(
          `refused to hand the browser a provider media URL in "${entry.field}"; convert it with browserMediaUrl first`,
        );
      }
      continue;
    }
    if (Array.isArray(value)) {
      // An array inherits the field it sits in: `imageUrls` is a media field,
      // and so is every element of it.
      for (const element of value) {
        pending.push({ value: element, field: entry.field, media: entry.media });
      }
      continue;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, property] of Object.entries(value)) {
        pending.push({
          value: property,
          field: entry.field === "" ? key : `${entry.field}.${key}`,
          media: isMediaField(key) || (entry.media && isMediaUrlField(key)),
        });
      }
    }
  }

  return payload;
}
