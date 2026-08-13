import { getRuntimeConfig } from "../../../config/runtime-config.js";
import {
  forwardStoreApiRequest,
  resolveStoreApiPath,
  resolveStoreApiTarget,
} from "../../../lib/store-api-transport.js";

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const upstreamPath = resolveStoreApiPath(requestUrl.pathname);
  if (upstreamPath === null) {
    return new Response(null, { status: 404 });
  }

  const { backendUrl } = getRuntimeConfig().medusa;
  if (backendUrl === null) {
    return new Response(null, { status: 503 });
  }

  const target = resolveStoreApiTarget(upstreamPath, requestUrl.search, backendUrl);
  return forwardStoreApiRequest(request, target);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
