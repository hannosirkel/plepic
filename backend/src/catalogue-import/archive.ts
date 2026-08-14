import { gunzipSync } from "node:zlib";

import { assertNoPersonalDataMemberName } from "./personal-data.js";
import { isSafeMediaFilename } from "./paths.js";
import { CatalogueImportRefusal } from "./refusal.js";

export interface ArchiveMember {
  /** Either `manifest.json` or `media/<filename>`. Nothing else is ever returned. */
  readonly name: string;
  readonly content: Uint8Array;
}

export const MANIFEST_MEMBER = "manifest.json";
export const MEDIA_MEMBER_PREFIX = "media/";

const BLOCK = 512;
/** A decompression bound. The real archive is media and one JSON document. */
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

/**
 * The tar member types this reader will carry. A symlink, a hard link, a
 * device node and a GNU long-name extension are each a way to make the name
 * the reader validated differ from the path the writer would use, so none of
 * them is supported — refusing is the whole point.
 */
const REGULAR_FILE = new Set(["0", "\0", "7"]);
const DIRECTORY = "5";

function field(header: Uint8Array, offset: number, length: number): string {
  const raw = Buffer.from(header.subarray(offset, offset + length)).toString("binary");
  const end = raw.indexOf("\0");
  return (end === -1 ? raw : raw.slice(0, end)).trim();
}

/**
 * Reads a NUL-terminated name field **without trimming**, and refuses a field
 * that carries anything after its terminator.
 *
 * Both halves matter. Trimming would silently accept `media/ leading.webp` as
 * `media/leading.webp` — the reader would validate one name and a writer would
 * use another. Bytes after the terminator are the same attack from the other
 * side: `media/x\0../../escape` reads as the harmless prefix while a reader
 * that scans the whole field sees the traversal.
 */
function nameField(header: Uint8Array, offset: number, length: number): string {
  const raw = Buffer.from(header.subarray(offset, offset + length)).toString("utf8");
  const end = raw.indexOf("\0");
  if (end === -1) return raw;
  if (/[^\0]/.test(raw.slice(end))) {
    throw new CatalogueImportRefusal(
      "unsafe-archive-member",
      "refused a tar name field carrying bytes after its terminator",
    );
  }
  return raw.slice(0, end);
}

function octal(header: Uint8Array, offset: number, length: number, label: string): number {
  const raw = field(header, offset, length);
  if (!/^[0-7]*$/.test(raw)) {
    throw new CatalogueImportRefusal("malformed-archive", `${label} is not an octal field`);
  }
  return raw.length === 0 ? 0 : Number.parseInt(raw, 8);
}

function assertHeaderChecksum(header: Uint8Array): void {
  const declared = octal(header, 148, 8, "header checksum");
  let unsigned = 0;
  for (let index = 0; index < BLOCK; index += 1) {
    unsigned += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0);
  }
  if (unsigned !== declared) {
    throw new CatalogueImportRefusal("malformed-archive", "a tar header checksum does not match");
  }
}

function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

function assertAcceptableName(name: string): void {
  assertNoPersonalDataMemberName(name);

  if (name === MANIFEST_MEMBER) return;
  if (
    name.startsWith(MEDIA_MEMBER_PREFIX) &&
    isSafeMediaFilename(name.slice(MEDIA_MEMBER_PREFIX.length))
  ) {
    return;
  }

  throw new CatalogueImportRefusal(
    "unsafe-archive-member",
    `refused an archive member outside "${MANIFEST_MEMBER}" and "${MEDIA_MEMBER_PREFIX}<file>": ${JSON.stringify(name)}`,
  );
}

/**
 * Reads a gzip-compressed tar into the two member shapes the import accepts,
 * refusing anything else before a single byte is written anywhere.
 *
 * The reader is written here rather than taken from a library because the
 * archive is an untrusted operator input and the properties that matter are
 * refusals: no member type that can redirect a write, no name that is not a
 * plain media filename, and no second manifest. A general-purpose extractor
 * would have to be configured into this shape and re-verified anyway.
 */
export function readArchiveMembers(archive: Uint8Array): readonly ArchiveMember[] {
  let tar: Buffer;
  try {
    tar = gunzipSync(archive, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
  } catch {
    throw new CatalogueImportRefusal(
      "malformed-archive",
      "the staged archive is not a readable gzip stream",
    );
  }

  if (tar.length === 0 || tar.length % BLOCK !== 0) {
    throw new CatalogueImportRefusal("malformed-archive", "the archive is not whole tar blocks");
  }

  const members: ArchiveMember[] = [];
  const seen = new Set<string>();
  let offset = 0;

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    offset += BLOCK;
    if (isZeroBlock(header)) break;

    assertHeaderChecksum(header);

    const prefix = nameField(header, 345, 155);
    const name = prefix === "" ? nameField(header, 0, 100) : `${prefix}/${nameField(header, 0, 100)}`;
    const size = octal(header, 124, 12, "member size");
    const typeflag = field(header, 156, 1) === "" ? "\0" : field(header, 156, 1);

    if (typeflag !== DIRECTORY && !REGULAR_FILE.has(typeflag)) {
      throw new CatalogueImportRefusal(
        "unsupported-archive-member",
        `refused a tar member of type ${JSON.stringify(typeflag)}; only regular files and directories are read`,
      );
    }

    const contentBlocks = Math.ceil(size / BLOCK) * BLOCK;
    if (offset + contentBlocks > tar.length) {
      throw new CatalogueImportRefusal("malformed-archive", "a tar member runs past the archive");
    }
    const content = tar.subarray(offset, offset + size);
    offset += contentBlocks;

    if (typeflag === DIRECTORY) {
      const directory = name.endsWith("/") ? name : `${name}/`;
      if (directory !== MEDIA_MEMBER_PREFIX) {
        assertAcceptableName(name.replace(/\/+$/, ""));
      }
      continue;
    }

    assertAcceptableName(name);
    if (seen.has(name)) {
      throw new CatalogueImportRefusal(
        "unsafe-archive-member",
        `refused a repeated archive member: ${JSON.stringify(name)}`,
      );
    }
    seen.add(name);
    members.push({ name, content });
  }

  if (!seen.has(MANIFEST_MEMBER)) {
    throw new CatalogueImportRefusal(
      "malformed-archive",
      `the archive carries no ${MANIFEST_MEMBER}`,
    );
  }

  return members;
}
