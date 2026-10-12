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
import * as etPublisher from "./et/publisher.js";
import * as etLunarBase from "./et/lunar-base.js";
import * as etProof from "./et/proof.js";
import * as etSupport from "./et/support.js";
import * as etShop from "./et/shop.js";
import * as etPages from "./et/pages.js";
import { interfaceCopy as etInterfaceCopy } from "./et/interface.js";
import * as tlhPublisher from "./tlh/publisher.js";
import * as tlhLunarBase from "./tlh/lunar-base.js";
import * as tlhProof from "./tlh/proof.js";
import * as tlhSupport from "./tlh/support.js";
import * as tlhShop from "./tlh/shop.js";
import * as tlhPages from "./tlh/pages.js";
import { interfaceCopy as tlhInterfaceCopy } from "./tlh/interface.js";
import type { Locale } from "./routes.js";
import type { LocalizedContent } from "./schema.js";

/** The modules a complete site edition must provide. */
export interface SiteCopy {
  readonly publisher: typeof publisher | typeof dePublisher | typeof etPublisher | typeof tlhPublisher;
  readonly lunarBase: typeof lunarBase | typeof deLunarBase | typeof etLunarBase | typeof tlhLunarBase;
  readonly proof: typeof proof | typeof deProof | typeof etProof | typeof tlhProof;
  readonly support: typeof support | typeof deSupport | typeof etSupport | typeof tlhSupport;
  readonly shop: typeof shop | typeof deShop | typeof etShop | typeof tlhShop;
  readonly pages: typeof pages | typeof dePages | typeof etPages | typeof tlhPages;
  readonly interface: InterfaceCopy;
}

export const siteCopyByLocale: LocalizedContent<SiteCopy> = {
  en: { publisher, lunarBase, proof, support, shop, pages, interface: interfaceCopy },
  de: { publisher: dePublisher, lunarBase: deLunarBase, proof: deProof, support: deSupport, shop: deShop, pages: dePages, interface: deInterfaceCopy },
  et: { publisher: etPublisher, lunarBase: etLunarBase, proof: etProof, support: etSupport, shop: etShop, pages: etPages, interface: etInterfaceCopy },
  tlh: { publisher: tlhPublisher, lunarBase: tlhLunarBase, proof: tlhProof, support: tlhSupport, shop: tlhShop, pages: tlhPages, interface: tlhInterfaceCopy },
};

export function siteCopyFor(locale: Locale): SiteCopy {
  return siteCopyByLocale[locale];
}
