/**
 * Shared scaffolding every route under `src/app/` uses so its own `page.tsx`
 * is a handful of lines: wire the route id to `content/pages.ts` for title,
 * description and a self-referencing canonical, and render *something* that
 * answers 200 so the sitemap contract ("every listed URL answers 200 with a
 * self-referencing canonical") is checkable now.
 *
 * The body this renders is a placeholder — a heading and the page's own
 * description. Real page composition (hero sections, the purchase panel, the
 * cart, checkout) is explicitly another unit's ("pages, cart, checkout,
 * design assets... are other units and other people"). This file's job ends
 * at "the metadata is real and the route resolves"; anything visually richer
 * replaces the placeholder body without touching `generateMetadata`.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

import type { RouteId } from "../../../content/routes.js";
import { isTestHost, loadSiteHostConfig } from "../config/hosts.js";
import { getRequestHost } from "./request-host.js";
import { buildPageMetadata, findPage } from "./seo.js";

/**
 * `generateMetadata` for one route. Reads this request's `Host` header so a
 * test hostname's pages emit `noindex, nofollow` in their metadata as well as
 * in the `X-Robots-Tag` header `proxy.ts` sends — see `./seo.ts`.
 */
export function makeMetadata(routeId: RouteId): () => Promise<Metadata> {
  return async function generateMetadata(): Promise<Metadata> {
    const hostConfig = loadSiteHostConfig();
    const host = await getRequestHost();

    return buildPageMetadata(routeId, {
      baseUrl: hostConfig.baseUrl,
      isTestHost: host !== undefined && isTestHost(host, hostConfig),
    });
  };
}

export interface RoutePlaceholderProps {
  readonly routeId: RouteId;
  readonly children?: ReactNode;
}

export function RoutePlaceholder({ routeId, children }: RoutePlaceholderProps) {
  const page = findPage(routeId);

  return (
    <main>
      <h1>{page.title}</h1>
      <p>{page.description}</p>
      {children}
    </main>
  );
}
