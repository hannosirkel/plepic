import { ConfigError } from "../config/env.js";

const ALLOWED_PREFIXES = new Set(["store", "hooks", "static"]);
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
