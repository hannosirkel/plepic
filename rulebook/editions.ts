import { resolve } from "node:path";
import { de } from "./text/de/index.js";
import { en } from "./text/en.js";
import { es } from "./text/es/index.js";
import { et } from "./text/et/index.js";
import { fr } from "./text/fr/index.js";
import { it } from "./text/it/index.js";
import type { RulebookText } from "./text/schema.js";
import { tlh } from "./text/tlh/index.js";

/** The published English rulebook: the source of the layout, never rebuilt or replaced. */
export const englishPdf = "storefront/public/documents/lunar-base-rulebook.pdf";

export type Edition = { tag: string; title: string; text: RulebookText };

/** Every edition the build and the layout check know. A translation is added here. */
export const editions: Readonly<Record<string, Edition>> = {
  en: { tag: "en", title: "Lunar Base Rule Book", text: en },
  de: { tag: "de", title: "Lunar Base Spielanleitung", text: de },
  et: { tag: "et", title: "Lunar Base reegliraamat", text: et },
  tlh: { tag: "tlh", title: "Lunar Base mIw paq", text: tlh },
  fr: { tag: "fr", title: "Lunar Base livret de règles", text: fr },
  es: { tag: "es", title: "Lunar Base libro de reglas", text: es },
  it: { tag: "it", title: "Lunar Base regolamento", text: it },
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
