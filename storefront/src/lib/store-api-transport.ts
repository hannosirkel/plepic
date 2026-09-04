import { ConfigError } from "../config/env.js";

const ALLOWED_PREFIXES = new Set(["store", "hooks", "static"]);

/**
 * The provider identifiers `backend/src/config/payment.ts` registers Stripe
 * under, duplicated here rather than imported.
 *
 * The boundary is the Docker build, not the workspace structure: a relative
 * import needs no npm dependency between the two `package.json`s, and
 * `storefront/tests/seeded-product-agreement.test.ts` imports
 * `backend/src/commerce/product-model.js` today and passes. What actually
 * blocks it for anything this file ships is `storefront/Dockerfile.dockerignore:61`,
 * which excludes `backend` from the build context (re-including only
 * `backend/package.json`, so `npm ci` can still resolve the workspace), and
 * `storefront/Dockerfile:44-46`, which copies only `content/`, `design/` and
 * `storefront/` into the build stage. A source-level import of
 * `backend/src/config/payment.ts` would fail `npm run build --workspace
 * storefront` with the file missing from the image; the test-only import
 * above survives only because `storefront/Dockerfile.dockerignore` also
 * excludes every `tests` directory and every file matching `*.test.ts`, so it
 * never reaches that build step.
 *
 * `backend/src/config/payment.ts` derives `STRIPE_WEBHOOK_PATH` as
 * `` `/hooks/payment/${identifier}_${instanceId}` `` from these same two
 * names; the constants below are composed the same way so that a change to
 * either identifier moves the path admitted here without anyone editing this
 * file.
 *
 * Duplicating the value does not, by itself, notice the backend's value
 * changing instead. `backend/tests/stripe-webhook-endpoint.test.ts:61` pins
 * backend's own derivation to the literal `/hooks/payment/stripe_stripe`, so
 * an edit to backend's identifiers that does not also update that literal
 * goes red there — but a coherent rename that updates every backend pin,
 * including that literal, together, passes with this file's constants
 * untouched: the live webhook would 404 and no test names this file. The
 * source-reading test at `backend/tests/stripe-webhook-endpoint.test.ts:76-84`
 * does not help either: it asserts only that `hooks` is a member of
 * `ALLOWED_PREFIXES`, never that the admitted segment matches backend's
 * identifier. That gap is real and unclosed; there is no cross-repository
 * test that would catch a coherent rename on both sides.
 */
const STRIPE_PROVIDER_IDENTIFIER = "stripe";
const STRIPE_PROVIDER_INSTANCE_ID = "stripe";

/** The provider segment Medusa's `PaymentModuleService.getWebhookActionAndData` resolves this registration to. */
const STRIPE_WEBHOOK_PROVIDER_SEGMENT = `${STRIPE_PROVIDER_IDENTIFIER}_${STRIPE_PROVIDER_INSTANCE_ID}`;

/** The one path admitted under `hooks` — see the comparison rule below. */
const STRIPE_WEBHOOK_PATH = `/hooks/payment/${STRIPE_WEBHOOK_PROVIDER_SEGMENT}`;

/**
 * The only path admitted under the `hooks` namespace, matched
 * segment-by-segment against the incoming path (see the call site below).
 *
 * `hooks` exists in `ALLOWED_PREFIXES` for exactly one route:
 * `POST /hooks/payment/:provider`, the Medusa-core handler
 * (`backend/node_modules/@medusajs/medusa/dist/api/hooks/payment/[provider]/route.js`)
 * that queues a webhook event before verifying anything about the request,
 * including `:provider` against a registered provider. `isRefusedSegment`
 * above already refuses a dot segment or an embedded separator in *every*
 * namespace — it is not namespace-scoped, unlike `REFUSED_STATIC_SEGMENTS` —
 * but admitting `hooks` and stopping there would still forward
 * `/hooks/payment/<anything>` to that handler, enqueuing a job from an
 * unauthenticated body. So `hooks` gets an allowlist of its own: not a
 * refused segment, an admitted one.
 *
 * The two variable segments are compared two different ways, and that
 * asymmetry is deliberate rather than an oversight:
 *
 * - The second segment (`payment`) is compared **undecoded**. It is a literal
 *   route segment, not a route parameter, and nothing in this repository
 *   observes how (or whether) Express decodes a literal segment before
 *   matching it — so admitting an encoded spelling here would be a guess, not
 *   a proven equivalence, and it is refused instead.
 * - The third segment (the provider) is compared **decoded**, against
 *   {@link STRIPE_WEBHOOK_PROVIDER_SEGMENT}. Express 4.22.2 resolves
 *   `req.params.provider` with `decodeURIComponent` — the same function
 *   `decodeSegment` uses — so every admitted spelling of this segment reaches
 *   the handler as the identical string. The encoding variance is not a
 *   bypass; it is two spellings of one request, and refusing it would refuse
 *   traffic the handler treats as the real webhook.
 *
 * `resolveStoreApiPath` returns {@link STRIPE_WEBHOOK_PATH} — the canonical
 * spelling — rather than the caller's, so an upstream access log or any
 * log-based alerting keyed on the path sees one string regardless of how the
 * caller encoded it.
 */

/**
 * The one path segment under `/store-api/static/*` that is never product media.
 *
 * The catalogue-import Job stages `catalogue.tar.gz` on the assets PVC under
 * `subPath: import`, while the media root the backend, the worker and the Job
 * serve is that same PVC's `subPath: media` — disjoint sibling subtrees rather
 * than one subtree seen twice. A staged archive therefore does not appear under
 * the directory Medusa serves as `/static/*`, and so cannot be reached through
 * `/store-api/static/*` at all. The `deploys` manifests are what make that
 * true, including their rule that every `CATALOGUE_IMPORT_ARCHIVE_PATH`
 * resolves inside the staging mount.
 *
 * The refusal stays regardless. The archive is a WooCommerce export carrying
 * customer accounts, sessions and order history, none of it may be downloadable
 * from a public site hostname, and the layout that currently makes that
 * impossible is enforced in a different repository — which this one is not
 * entitled to assume. A defence with nothing to catch today is not a defence to
 * delete: it is what a mount-layout regression lands on. Disposing of the
 * archive on every exit path remains the control that matters.
 *
 * It is a refusal rather than a narrower allowlist because
 * `/store-api/static/*` legitimately serves nested media paths, and it is
 * matched case-insensitively so that the refusal does not depend on the
 * case-sensitivity of whatever filesystem backs the volume.
 */
const REFUSED_STATIC_SEGMENTS = new Set(["import"]);

/**
 * The origin dot segments are resolved against when this module normalizes a
 * candidate path for itself. Opaque and unroutable on purpose: nothing is ever
 * fetched from it, it exists only so the WHATWG URL parser has a base.
 */
const NORMALIZATION_BASE = "http://store-api.invalid";

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

function backendOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError("MEDUSA_BACKEND_URL must be an absolute http or https origin");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new ConfigError("MEDUSA_BACKEND_URL must be an absolute http or https origin");
  }

  return url;
}

/**
 * Percent-decodes one path segment, treating a malformed escape as its own
 * literal text rather than throwing. A segment that cannot be decoded is
 * compared as written, which can only make the refusals below stricter.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Whether a segment may not appear in a forwarded path: empty, a dot segment
 * in *any* encoding, or one hiding a separator.
 *
 * The encoding clause is the load-bearing one. `..` written out is obvious;
 * `%2e%2e`, `%2E%2E`, `.%2e` and `%2e.` are the same segment to the WHATWG URL
 * parser — its "double-dot path segment" rule is defined on the decoded form
 * and is case-insensitive — and the parser is what `resolveStoreApiTarget`
 * runs the path through on its way to `fetch`. So a comparison against the
 * literal string `".."` alone lets `/store-api/store/%2e%2e/admin/users`
 * through this function and the URL parser then resolves the forwarded target
 * to `/admin/users` on the backend: the entire Medusa Admin API, reachable
 * from the public site origin.
 *
 * Nothing here has ever shipped that reachable, and the reason is **two**
 * defences rather than one. The first is the WHATWG `Request` constructor: it
 * runs the URL parser and stores the serialized result, so the dot segment is
 * already resolved before any code in this repository reads `request.url` —
 * `new Request("http://h/store-api/store/%2e%2e/store/products").url` is
 * `http://h/store-api/store/products`, which is a Fetch-spec guarantee rather
 * than a framework implementation detail. The second is the route handler
 * itself (`src/app/store-api/[...path]/route.ts`), which reads
 * `new URL(request.url).pathname` and so applies the identical WHATWG rule
 * again. Either alone is sufficient, so the pre-existing literal-`".."`
 * comparison was not one framework upgrade away from publishing `/admin` —
 * the earlier revision of this comment named Next.js's router as one of the
 * two and was wrong about that. Next.js may normalize in its router as well;
 * nothing in this repository observes it, so it is not claimed here and not
 * counted. Both of the defences that are claimed remain properties of a
 * *caller*, not of this allowlist, and this function is entitled to assume
 * neither: it is called with whatever pathname it is handed, and the refusals
 * below are what make it safe on its own terms.
 */
function isRefusedSegment(segment: string): boolean {
  if (segment.length === 0) return true;
  const decoded = decodeSegment(segment);
  return decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\");
}

/**
 * Resolves a storefront pathname to its Medusa target path, or `null` for the
 * local 404 branch. No network operation happens in this function or before
 * the caller observes that result.
 *
 * The returned path is the **normalized** one: the allowlist is re-checked
 * against the path the URL parser will actually produce, not against the one
 * this function was handed, so "match after normalization" holds here on its
 * own rather than only because a caller normalized first.
 */
export function resolveStoreApiPath(pathname: string): string | null {
  const prefix = "/store-api/";
  if (!pathname.startsWith(prefix)) return null;

  const upstreamPath = pathname.slice(prefix.length);
  const segments = upstreamPath.split("/");
  const namespace = segments[0];
  if (namespace === undefined || !ALLOWED_PREFIXES.has(namespace) || segments.length < 2) {
    return null;
  }
  if (segments.some(isRefusedSegment)) {
    return null;
  }
  if (
    namespace === "static" &&
    segments.some((segment) => REFUSED_STATIC_SEGMENTS.has(decodeSegment(segment).toLowerCase()))
  ) {
    return null;
  }
  if (namespace === "hooks") {
    if (
      segments.length !== 3 ||
      segments[1] !== "payment" ||
      decodeSegment(segments[2] ?? "") !== STRIPE_WEBHOOK_PROVIDER_SEGMENT
    ) {
      return null;
    }
    return STRIPE_WEBHOOK_PATH;
  }

  // Belt and braces over the segment refusals above: whatever the parser does
  // to this path — today's dot-segment rules or a future revision of them —
  // the result still has to sit under the namespace that was allowlisted.
  const normalized = new URL(`/${upstreamPath}`, NORMALIZATION_BASE).pathname;
  if (!normalized.startsWith(`/${namespace}/`)) {
    return null;
  }

  return normalized;
}

export function resolveStoreApiTarget(
  upstreamPath: string,
  search: string,
  backendUrl: string,
): URL {
  const target = backendOrigin(backendUrl);
  target.pathname = upstreamPath;
  target.search = search;
  return target;
}

function forwardedRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  return headers;
}

function forwardedResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  if (headers.has("content-encoding")) {
    // Node's fetch transparently decodes gzip/br/deflate response bodies but
    // retains the upstream representation metadata. The downstream response
    // carries decoded bytes, so its runtime must calculate fresh framing.
    headers.delete("content-encoding");
    headers.delete("content-length");
  }
  return headers;
}

/** Forwards one allowed request while preserving its method, query, headers and raw body. */
export async function forwardStoreApiRequest(request: Request, target: URL): Promise<Response> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const upstream = await fetch(target, {
    method: request.method,
    headers: forwardedRequestHeaders(request),
    body,
    redirect: "manual",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardedResponseHeaders(upstream),
  });
}
