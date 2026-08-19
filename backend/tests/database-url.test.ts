import { describe, expect, it } from "vitest";

import {
  resolveDatabaseDriverOptions,
  resolveDatabaseUrl,
} from "../src/config/database-url.js";

/**
 * The five parts every `deploys/plepic/base` workload projects, and nothing
 * else. `DATABASE_PASSWORD` is the only one that comes from a Secret; the other
 * four are plain `value:` entries in the manifest.
 */
const clusterParts = {
  DATABASE_HOST: "plepic-postgresql",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "plepic",
  DATABASE_USER: "medusa",
  DATABASE_PASSWORD: "an-ordinary-password",
} as const;

describe("resolveDatabaseUrl", () => {
  /**
   * `compose.yaml` and `.github/workflows/validate.yml` both set an explicit
   * `DATABASE_URL` and neither sets a single `DATABASE_*` part, so honouring an
   * explicit URL is what keeps the local and CI paths working untouched. It
   * also keeps a developer able to point the backend at any database — a
   * socket, a managed instance, a URL carrying `?sslmode=require` — none of
   * which the five-part form can express.
   */
  it("honours an explicitly supplied DATABASE_URL verbatim", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://plepic@postgresql:5432/plepic" })).toBe(
      "postgres://plepic@postgresql:5432/plepic",
    );
  });

  /** The explicit URL wins, and it wins even where both forms are present. */
  it("prefers an explicit DATABASE_URL over the parts", () => {
    expect(resolveDatabaseUrl({ ...clusterParts, DATABASE_URL: "postgres://elsewhere/db" })).toBe(
      "postgres://elsewhere/db",
    );
  });

  /**
   * An empty or whitespace-only `DATABASE_URL` is what a Secret key projected
   * from an absent OpenBao field looks like. It must not win — falling through
   * to the parts is the difference between a working pod and one that dials
   * `postgres://` with no host.
   */
  it("falls through to the parts when DATABASE_URL is empty", () => {
    for (const empty of ["", "   "]) {
      expect(resolveDatabaseUrl({ ...clusterParts, DATABASE_URL: empty })).toBe(
        "postgres://medusa:an-ordinary-password@plepic-postgresql:5432/plepic",
      );
    }
  });

  it("derives the URL from the five parts the manifests supply", () => {
    expect(resolveDatabaseUrl(clusterParts)).toBe(
      "postgres://medusa:an-ordinary-password@plepic-postgresql:5432/plepic",
    );
  });

  /**
   * The password is generated, not chosen, and a generated password containing
   * `@`, `/`, `:` or `#` would silently re-cut the authority: `@` alone moves
   * the host, and the pod would dial a hostname made of password characters.
   * Both directions are asserted — that the URL is encoded, and that a real URL
   * parser recovers exactly the bytes that went in.
   */
  it("percent-encodes every component and round-trips through a URL parser", () => {
    const password = "p@ss/w:rd#?&= [x]%y";
    const url = resolveDatabaseUrl({
      ...clusterParts,
      DATABASE_USER: "me@dusa",
      DATABASE_NAME: "ple pic/db",
      DATABASE_PASSWORD: password,
    });

    expect(url).not.toContain(password);

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("plepic-postgresql");
    expect(parsed.port).toBe("5432");
    expect(decodeURIComponent(parsed.username)).toBe("me@dusa");
    expect(decodeURIComponent(parsed.password)).toBe(password);
    expect(decodeURIComponent(parsed.pathname)).toBe("/ple pic/db");
  });

  /**
   * Fail closed, and name the part. A missing part must never produce a
   * malformed URL that the driver reports as a connection failure against some
   * host the operator has never heard of.
   */
  it.each(Object.keys(clusterParts))("refuses without %s, naming it", (missing) => {
    const partial: Record<string, string | undefined> = { ...clusterParts };
    partial[missing] = undefined;
    expect(() => resolveDatabaseUrl(partial)).toThrow(new RegExp(missing));

    partial[missing] = "   ";
    expect(() => resolveDatabaseUrl(partial)).toThrow(new RegExp(missing));
  });

  /**
   * The refusal is read from a Job or pod log by whoever is debugging the
   * deployment. The database password must not be in it — not the value, and
   * not a fragment of a half-built URL carrying it.
   */
  it("never puts the password in the refusal", () => {
    const password = "correct-horse-battery-staple";

    for (const missing of ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_NAME", "DATABASE_USER"]) {
      const partial: Record<string, string | undefined> = {
        ...clusterParts,
        DATABASE_PASSWORD: password,
      };
      partial[missing] = undefined;

      let raised: unknown;
      try {
        resolveDatabaseUrl(partial);
      } catch (error) {
        raised = error;
      }

      expect(raised).toBeInstanceOf(Error);
      const rendered = `${(raised as Error).message}\n${(raised as Error).stack ?? ""}`;
      expect(rendered).not.toContain(password);
      expect(rendered).not.toContain(encodeURIComponent(password));
    }
  });

  /**
   * Names the alternative. Whoever reads this refusal is looking at a workload
   * that supplies neither form, and the two ways out are not guessable from a
   * bare "DATABASE_HOST is missing".
   */
  it("names DATABASE_URL as the alternative when nothing is supplied", () => {
    expect(() => resolveDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a port that is not a positive integer", () => {
    for (const invalid of ["0", "-1", "5432.5", "postgres", "70000"]) {
      expect(() => resolveDatabaseUrl({ ...clusterParts, DATABASE_PORT: invalid })).toThrow(
        /DATABASE_PORT/,
      );
    }
  });

  /**
   * A host is an authority component, not a path segment: percent-encoding it
   * would produce something no resolver accepts, so it is validated instead.
   * The characters refused are the ones that would re-cut the authority.
   */
  it("rejects a host that would re-cut the authority", () => {
    for (const invalid of ["postgres:5432", "host/path", "host@other", "two hosts", "a\nb"]) {
      expect(() => resolveDatabaseUrl({ ...clusterParts, DATABASE_HOST: invalid })).toThrow(
        /DATABASE_HOST/,
      );
    }
  });
});

describe("resolveDatabaseDriverOptions", () => {
  /**
   * The default is the deployment that exists. Both PostgreSQL StatefulSets run
   * `ssl = off`, so an unset variable has to produce the connection that
   * actually works — and it has to produce it as an *explicit* `false`, because
   * leaving the options undefined is precisely what let `db:migrate` substitute
   * Medusa's remote default and open an SSLRequest the server answered `'N'` to.
   */
  it("defaults to disable when DATABASE_SSL_MODE is unset", () => {
    expect(resolveDatabaseDriverOptions({})).toEqual({ connection: { ssl: false } });
  });

  /**
   * Empty is absent, for the same reason `DATABASE_URL` treats it that way: an
   * ESO-projected key whose OpenBao field is absent arrives as `""`, and an
   * optional variable that refused on `""` would be a required one.
   */
  it("treats an empty or whitespace-only DATABASE_SSL_MODE as unset", () => {
    for (const empty of ["", "   ", "\t"]) {
      expect(resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: empty })).toEqual({
        connection: { ssl: false },
      });
    }
  });

  it("resolves disable to no TLS at all", () => {
    expect(resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: "disable" })).toEqual({
      connection: { ssl: false },
    });
  });

  /**
   * `require` is byte-identical to Medusa's own remote default: encrypt, but do
   * not verify. That equivalence is the point — turning TLS on for a managed
   * database is then a manifest change that lands the deployment on exactly the
   * options Medusa would have chosen for it.
   */
  it("resolves require to encryption without verification", () => {
    expect(resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: "require" })).toEqual({
      connection: { ssl: { rejectUnauthorized: false } },
    });
  });

  /** `ssl: true` is node-postgres asking for a verified chain and hostname. */
  it("resolves verify-full to a verified chain", () => {
    expect(resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: "verify-full" })).toEqual({
      connection: { ssl: true },
    });
  });

  it("accepts a surrounding-whitespace value, like every other part", () => {
    expect(resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: "  require  " })).toEqual({
      connection: { ssl: { rejectUnauthorized: false } },
    });
  });

  /**
   * Fail closed and name the variable. libpq has six `sslmode` values and only
   * three are implemented here; silently treating `prefer`, `allow` or
   * `verify-ca` as one of the others would be a downgrade nobody asked for, on
   * the one setting whose whole purpose is to say how much verification is
   * wanted. `no` and `true` are in the list because they are what a YAML author
   * writes when they think this field is a boolean.
   */
  it("refuses any other mode, naming DATABASE_SSL_MODE and the accepted values", () => {
    for (const invalid of ["prefer", "allow", "verify-ca", "true", "false", "no", "off", "1"]) {
      expect(() => resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: invalid })).toThrow(
        /DATABASE_SSL_MODE/,
      );
      expect(() => resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: invalid })).toThrow(
        /disable.*require.*verify-full/,
      );
    }
  });

  /** Each call gets its own object; nothing downstream can mutate a shared one. */
  it("returns a fresh object on every call", () => {
    const first = resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: "require" });
    const second = resolveDatabaseDriverOptions({ DATABASE_SSL_MODE: "require" });

    expect(first).not.toBe(second);
    expect(first.connection).not.toBe(second.connection);
  });
});
