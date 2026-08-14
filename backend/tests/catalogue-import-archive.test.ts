import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { readArchiveMembers } from "../src/catalogue-import/archive.js";
import { resolveWithinRoot } from "../src/catalogue-import/paths.js";
import { CatalogueImportRefusal } from "../src/catalogue-import/refusal.js";
import { buildArchive, buildTar, type TarMember } from "./helpers/tar.js";
import { boxImage, manifestMember, mediaMembers, validArchive } from "./helpers/catalogue-archive.js";

function refusalReason(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogueImportRefusal) return error.reason;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("archive member reading", () => {
  it("reads the manifest and every media member of a well-formed archive", () => {
    const members = readArchiveMembers(validArchive());

    expect(members.map((member) => member.name)).toEqual([
      "manifest.json",
      "media/lunar-base-box.webp",
      "media/lunar-base-table.webp",
    ]);
    expect(Buffer.from(members[1]!.content)).toEqual(boxImage);
  });

  it("refuses an archive that is not gzip, and one whose tar framing is damaged", () => {
    expect(refusalReason(() => readArchiveMembers(Buffer.from("not gzip", "utf8")))).toBe(
      "malformed-archive",
    );

    const damaged = buildTar([manifestMember()]);
    damaged[130] = 0x39; // Corrupt the size field, invalidating the header checksum.
    expect(refusalReason(() => readArchiveMembers(gzipSync(damaged)))).toBe("malformed-archive");
  });

  it("refuses every member type that is not a regular file or a directory", () => {
    const hostile: readonly TarMember[] = [
      { name: "media/escape.webp", typeflag: "2", linkname: "/etc/passwd" },
      { name: "media/escape.webp", typeflag: "1", linkname: "manifest.json" },
      { name: "media/escape", typeflag: "3" },
      { name: "media/escape", typeflag: "6" },
      { name: "././@LongLink", typeflag: "L", content: "media/x" },
    ];

    for (const member of hostile) {
      expect(
        refusalReason(() => readArchiveMembers(buildArchive([manifestMember(), member]))),
      ).toBe("unsupported-archive-member");
    }
  });

  it("refuses a crafted member name rather than resolving it", () => {
    const crafted = [
      "../escape.webp",
      "media/../../escape.webp",
      "media/subdir/../../../escape.webp",
      "/etc/passwd",
      "//etc/passwd",
      "C:\\Windows\\system32",
      "media\\..\\..\\escape.webp",
      "media/%2e%2e/escape.webp",
      "media/%2E%2E%2Fescape.webp",
      "media/..%2fescape.webp",
      "media/.",
      "media/..",
      "media/nul\0.webp",
      "media/ leading-space.webp",
      "media/trailing-space.webp ",
      "media/nested/deep.webp",
      "manifest.json/../manifest.json",
    ];

    for (const name of crafted) {
      expect(
        refusalReason(() =>
          readArchiveMembers(buildArchive([manifestMember(), { name, content: boxImage }])),
        ),
      ).toBe("unsafe-archive-member");
    }
  });

  it("refuses a second manifest and any member outside the two accepted shapes", () => {
    for (const name of ["manifest.json", "wp-config.php", "media", "other/file.webp"]) {
      expect(
        refusalReason(() =>
          readArchiveMembers(buildArchive([manifestMember(), { name, content: boxImage }])),
        ),
      ).toBe("unsafe-archive-member");
    }

    expect(refusalReason(() => readArchiveMembers(buildArchive(mediaMembers())))).toBe(
      "malformed-archive",
    );
  });
});

describe("resolveWithinRoot", () => {
  it("never returns a path outside the assets root", () => {
    expect(resolveWithinRoot("/app/static", "lunar-base-box.webp")).toBe(
      "/app/static/lunar-base-box.webp",
    );

    for (const relative of [
      "../escape.webp",
      "../../etc/passwd",
      "/etc/passwd",
      "..",
      ".",
      "",
      "sub/../../escape.webp",
      "%2e%2e/escape.webp",
      "back\\slash.webp",
      "nul\0.webp",
    ]) {
      expect(refusalReason(() => resolveWithinRoot("/app/static", relative))).toBe(
        "unsafe-archive-member",
      );
    }
  });

  it("does not treat a sibling directory with a shared prefix as inside the root", () => {
    expect(refusalReason(() => resolveWithinRoot("/app/static", "../static-backup/x.webp"))).toBe(
      "unsafe-archive-member",
    );
  });
});
