import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ArchiveMember } from "./archive.js";
import { MEDIA_MEMBER_PREFIX } from "./archive.js";
import { isSafeMediaFilename, resolveWithinRoot } from "./paths.js";
import { CatalogueImportRefusal, sha256Hex } from "./refusal.js";

/**
 * Where Medusa's local file provider serves the assets PVC from. The import
 * writes files into the provider's `upload_dir` and records this prefix in the
 * product's image URLs, so the URL Medusa hands out and the file on the volume
 * are the same fact. The storefront exposes the same bytes at
 * `/store-api/static/*` through its prefix allowlist — see
 * `storefront/src/lib/store-media.ts`.
 */
export const MEDIA_PUBLIC_PREFIX = "/static/";

/**
 * The suffix a half-written file carries. A run killed between `writeFile` and
 * `rename` leaves one of these rather than a truncated image at the real name,
 * and the next run deletes it before it writes anything.
 */
const PARTIAL_SUFFIX = ".plepic-import-partial";

export function mediaPublicUrl(filename: string): string {
  if (!isSafeMediaFilename(filename)) {
    throw new CatalogueImportRefusal(
      "unsafe-archive-member",
      `refused to publish a media URL for ${JSON.stringify(filename)}`,
    );
  }
  return `${MEDIA_PUBLIC_PREFIX}${filename}`;
}

/**
 * Resolves a `/static/*` request to a file inside the assets root, or refuses.
 * A crafted filename cannot escape: the only way to obtain a path is through
 * {@link resolveWithinRoot}, and the accepted filename charset admits no
 * separator, no `..`, no percent-encoding and no backslash.
 */
export function resolveMediaRequest(root: string, requestPath: string): string {
  if (!requestPath.startsWith(MEDIA_PUBLIC_PREFIX)) {
    throw new CatalogueImportRefusal(
      "unsafe-archive-member",
      `refused a media request outside ${MEDIA_PUBLIC_PREFIX}: ${JSON.stringify(requestPath)}`,
    );
  }
  return resolveWithinRoot(root, requestPath.slice(MEDIA_PUBLIC_PREFIX.length));
}

export interface MediaSyncSummary {
  readonly written: number;
  readonly unchanged: number;
}

async function readIfPresent(path: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function discardPartialFiles(root: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.endsWith(PARTIAL_SUFFIX)) await rm(join(root, entry), { force: true });
  }
}

/**
 * Writes each media member into the assets root exactly once.
 *
 * Idempotent by content: a file already present with the same bytes is left
 * untouched, so a second run neither duplicates nor rewrites it. Crash-safe by
 * construction: bytes land in a `.plepic-import-partial` sibling and are moved
 * into place with one rename, which is atomic within a directory, so a run
 * interrupted at any point leaves either the previous file or the new one and
 * never half of either.
 */
export async function syncMedia(
  members: readonly ArchiveMember[],
  root: string,
): Promise<MediaSyncSummary> {
  await mkdir(root, { recursive: true });
  await discardPartialFiles(root);

  let written = 0;
  let unchanged = 0;

  for (const member of members) {
    if (!member.name.startsWith(MEDIA_MEMBER_PREFIX)) continue;
    const filename = member.name.slice(MEDIA_MEMBER_PREFIX.length);
    const target = resolveWithinRoot(root, filename);

    const present = await readIfPresent(target);
    if (present !== null && sha256Hex(present) === sha256Hex(member.content)) {
      unchanged += 1;
      continue;
    }

    const partial = `${target}${PARTIAL_SUFFIX}`;
    await writeFile(partial, member.content, { mode: 0o644 });
    await rename(partial, target);
    written += 1;
  }

  return { written, unchanged };
}
