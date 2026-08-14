import { gzipSync } from "node:zlib";

/**
 * A deliberately unhelpful tar writer.
 *
 * It exists so the archive tests can build members the import must **refuse**
 * — a symlink, an absolute name, a `..` traversal, a device node — which no
 * archiving library will produce on request. It therefore writes exactly the
 * bytes it is told to and validates nothing.
 */
export interface TarMember {
  readonly name: string;
  /** `0` regular file, `5` directory, `2` symlink, `1` hard link, `3` character device. */
  readonly typeflag?: string;
  readonly linkname?: string;
  readonly content?: string | Uint8Array;
}

const BLOCK = 512;

function writeString(header: Uint8Array, offset: number, value: string, length: number): void {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`tar field does not fit: ${value}`);
  header.set(bytes.subarray(0, length), offset);
}

function writeOctal(header: Uint8Array, offset: number, value: number, length: number): void {
  writeString(header, offset, value.toString(8).padStart(length - 1, "0"), length);
}

function memberHeader(member: TarMember, size: number): Uint8Array {
  const header = new Uint8Array(BLOCK);
  writeString(header, 0, member.name, 100);
  writeOctal(header, 100, 0o644, 8);
  writeOctal(header, 108, 10_001, 8);
  writeOctal(header, 116, 10_001, 8);
  writeOctal(header, 124, size, 12);
  writeOctal(header, 136, 0, 12);
  header.set(Buffer.from("        ", "ascii"), 148);
  writeString(header, 156, member.typeflag ?? "0", 1);
  writeString(header, 157, member.linkname ?? "", 100);
  writeString(header, 257, "ustar\0", 6);
  writeString(header, 263, "00", 2);

  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, 148, `${checksum.toString(8).padStart(6, "0")}\0 `, 8);
  return header;
}

/** Builds an uncompressed tar stream from `members`, in order. */
export function buildTar(members: readonly TarMember[]): Buffer {
  const blocks: Uint8Array[] = [];

  for (const member of members) {
    const content =
      typeof member.content === "string"
        ? Buffer.from(member.content, "utf8")
        : Buffer.from(member.content ?? new Uint8Array());
    blocks.push(memberHeader(member, content.length));
    if (content.length > 0) {
      const padded = new Uint8Array(Math.ceil(content.length / BLOCK) * BLOCK);
      padded.set(content);
      blocks.push(padded);
    }
  }

  blocks.push(new Uint8Array(BLOCK * 2));
  return Buffer.concat(blocks);
}

/** Builds the gzip-compressed tar the import actually consumes. */
export function buildArchive(members: readonly TarMember[]): Buffer {
  return gzipSync(buildTar(members));
}
