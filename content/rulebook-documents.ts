import type { LocalizedContent } from "./schema.js";

/** A published rulebook PDF under storefront/public/documents/. */
export interface RulebookDocument {
  readonly fileName: string;
  readonly megabytes: number;
  readonly sheetCount: number;
}

/** Null means this edition uses the English rulebook until its PDF is published. */
export const rulebookDocuments: LocalizedContent<RulebookDocument | null> = {
  en: { fileName: "lunar-base-rulebook.pdf", megabytes: 8.9, sheetCount: 25 },
  de: null,
  et: null,
};
