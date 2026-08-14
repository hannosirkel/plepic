import { ConfigError } from "../config/env.js";

const ALLOWED_PREFIXES = new Set(["store", "hooks", "static"]);

/**
 * The one directory under the served static root that is never product media.
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
 * Resolves an already-normalized storefront pathname to its Medusa target.
 * Returning `null` is the local 404 branch; no network operation happens in
 * this function or before the caller observes that result.
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
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }
  if (
    namespace === "static" &&
    segments.some((segment) => REFUSED_STATIC_SEGMENTS.has(segment.toLowerCase()))
  ) {
    return null;
  }

  return `/${upstreamPath}`;
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
