import * as publisher from "./publisher.js";
import * as lunarBase from "./lunar-base.js";
import * as proof from "./proof.js";
import * as support from "./support.js";
import * as shop from "./shop.js";
import * as pages from "./pages.js";
import { interfaceCopy, type InterfaceCopy } from "./interface.js";
import * as dePublisher from "./de/publisher.js";
import * as deLunarBase from "./de/lunar-base.js";
import * as deProof from "./de/proof.js";
import * as deSupport from "./de/support.js";
import * as deShop from "./de/shop.js";
import * as dePages from "./de/pages.js";
import { interfaceCopy as deInterfaceCopy } from "./de/interface.js";
import type { Locale } from "./routes.js";
import type { LocalizedContent } from "./schema.js";

/** The modules a complete site edition must provide. */
export interface SiteCopy {
  readonly publisher: typeof publisher | typeof dePublisher;
  readonly lunarBase: typeof lunarBase | typeof deLunarBase;
  readonly proof: typeof proof | typeof deProof;
  readonly support: typeof support | typeof deSupport;
  readonly shop: typeof shop | typeof deShop;
  readonly pages: typeof pages | typeof dePages;
  readonly interface: InterfaceCopy;
}

export const siteCopyByLocale: LocalizedContent<SiteCopy | null> = {
  en: { publisher, lunarBase, proof, support, shop, pages, interface: interfaceCopy },
  de: { publisher: dePublisher, lunarBase: deLunarBase, proof: deProof, support: deSupport, shop: deShop, pages: dePages, interface: deInterfaceCopy },
  et: null,
};

/** A null entry denotes an edition whose site copy has not been published. */
export function siteCopyFor(locale: Locale): SiteCopy {
  const copy = siteCopyByLocale[locale];
  if (copy === null) throw new Error(locale + " has no site copy");
  return copy;
}
