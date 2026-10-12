import { resolve } from "node:path";
import { en } from "./text/en.js";
import type { RulebookText } from "./text/schema.js";

/** The published English rulebook: the source of the layout, never rebuilt or replaced. */
export const englishPdf = "storefront/public/documents/lunar-base-rulebook.pdf";

export type Edition = { tag: string; title: string; text: RulebookText };

/** Every edition the build and the layout check know. A translation is added here. */
export const editions: Readonly<Record<string, Edition>> = {
  en: { tag: "en", title: "Lunar Base Rule Book", text: en },
};

/**
 * English is a proof of the pipeline and stays in the ignored work
 * directory. A translation is committed beside the published English PDF.
 */
export function editionPaths(root: string, locale: string): { work: string; pdf: string } {
  const work = resolve(root, "rulebook/.work", locale);
  const pdf = locale === "en"
    ? resolve(work, "lunar-base-rulebook-en.pdf")
    : resolve(root, `storefront/public/documents/lunar-base-rulebook-${locale}.pdf`);
  return { work, pdf };
}
