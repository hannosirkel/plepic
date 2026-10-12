import * as publisher from "./publisher.js";
import * as lunarBase from "./lunar-base.js";
import * as proof from "./proof.js";
import * as support from "./support.js";
import * as shop from "./shop.js";
import * as pages from "./pages.js";
import { interfaceCopy, type InterfaceCopy } from "./interface.js";
import type { Locale } from "./routes.js";
import type { LocalizedContent } from "./schema.js";

/** The modules a complete site edition must provide. */
export interface SiteCopy {
  readonly publisher: typeof publisher;
  readonly lunarBase: typeof lunarBase;
  readonly proof: typeof proof;
  readonly support: typeof support;
  readonly shop: typeof shop;
  readonly pages: typeof pages;
  readonly interface: InterfaceCopy;
}

export const siteCopyByLocale: LocalizedContent<SiteCopy | null> = {
  en: { publisher, lunarBase, proof, support, shop, pages, interface: interfaceCopy },
  de: null,
  et: null,
};

/** A null entry denotes an edition whose site copy has not been published. */
export function siteCopyFor(locale: Locale): SiteCopy {
  const copy = siteCopyByLocale[locale];
  if (copy === null) throw new Error(locale + " has no site copy");
  return copy;
}
