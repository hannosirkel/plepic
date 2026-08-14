import { describe, expect, it } from "vitest";

import { readArchiveMembers } from "../src/catalogue-import/archive.js";
import { REFUSED_SECTIONS, assertNoPersonalData } from "../src/catalogue-import/personal-data.js";
import { CatalogueImportRefusal } from "../src/catalogue-import/refusal.js";
import { readCatalogueImportPlan } from "../src/catalogue-import/plan.js";
import { manifest, validArchive } from "./helpers/catalogue-archive.js";

function refusal(run: () => unknown): CatalogueImportRefusal {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogueImportRefusal) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("personal data refusal", () => {
  it("names WordPress users, WooCommerce customers, sessions and orders as refused", () => {
    for (const section of ["users", "customers", "sessions", "orders"]) {
      expect(REFUSED_SECTIONS).toContain(section);
    }
  });

  it("refuses a manifest carrying any personal-data section, naming only the section", () => {
    const hostile = {
      ...manifest,
      customers: [{ email: "buyer@example.invalid", first_name: "Ada" }],
    };

    const error = refusal(() => {
      assertNoPersonalData(readArchiveMembers(validArchive([], hostile)));
    });

    expect(error.reason).toBe("personal-data-present");
    expect(error.message).toContain("customers");
    expect(error.message).not.toContain("buyer@example.invalid");
    expect(error.message).not.toContain("Ada");
  });

  it("refuses every refused section name, in any letter case or WordPress table spelling", () => {
    for (const section of [
      "users",
      "USERS",
      "wp_users",
      "wp_usermeta",
      "customers",
      "customer_accounts",
      "sessions",
      "wp_woocommerce_sessions",
      "orders",
      "order_history",
      "subscribers",
    ]) {
      const error = refusal(() => {
        assertNoPersonalData(readArchiveMembers(validArchive([], { ...manifest, [section]: [] })));
      });
      expect(error.reason).toBe("personal-data-present");
    }
  });

  it("refuses an archive member that is an exported personal-data table", () => {
    for (const name of [
      "customers/export.csv",
      "orders/2025.json",
      "wp_users/dump.sql",
      "sessions/session-store.json",
    ]) {
      const error = refusal(() => readArchiveMembers(validArchive([{ name, content: "" }])));
      expect(error.reason).toBe("personal-data-present");
    }
  });

  it("refuses a manifest section that is merely unrecognised, rather than ignoring it", () => {
    const error = refusal(() => {
      readCatalogueImportPlan(
        readArchiveMembers(validArchive([], { ...manifest, analyticsExport: [] })),
        new Date("2026-08-14T00:00:00.000Z"),
      );
    });

    expect(error.reason).toBe("unrecognised-manifest-section");
    expect(error.message).toContain("analyticsExport");
  });

  it("admits the archive that carries only commerce data and media", () => {
    expect(() => {
      assertNoPersonalData(readArchiveMembers(validArchive()));
    }).not.toThrow();
  });
});
