/** Estonian page metadata, mirroring the routes and sections of ../pages.ts. */
import { legalPagesByLocale } from "../legal/index.js";
import type { Page } from "../schema.js";

export const marketingPages: readonly Page[] = [
  {
    route: "home",
    title: "Plepic Games",
    description:
      "Väike sõltumatu lauamängukirjastus Tallinna lähedal. Kuus inimest, üks mäng, kolm aastat tööd – ja umbes minutiga on see laual.",
    indexable: true,
    sections: ["proof", "story", "newsletter"],
  },
  {
    route: "lunarBase",
    title: "Lunar Base – strateegiline kaardimäng 2–6 mängijale",
    description:
      "Ehita võimsaim kuubaas. Neli võiduvõimalust, rivaale takistavad agendid, 90 kaarti, umbes 30 minutit ja kotti mahtuv karp.",
    indexable: true,
    sections: [
      "aboutgame",
      "how-it-plays",
      "victory-paths",
      "in-the-box",
      "travels-well",
      "video_trailer",
      "reviews",
      "shipping-and-returns",
      "buy",
    ],
  },
  {
    route: "support",
    title: "Lunar Base'i tugi ja reeglid",
    description:
      "Täielik reegliraamat, mängulauas sagedased küsimused, osade loend, õppevideo ja võimalus meiega ühendust võtta.",
    indexable: true,
    sections: ["rules-faq", "components", "contact"],
  },
  {
    route: "rulebook",
    title: "Lunar Base'i reegliraamat",
    description:
      "Täielik Lunar Base'i reegliraamat karbis trükitud kujul, mida saab lugeda ja millest saab otsida.",
    indexable: true,
    sections: [],
  },
  {
    route: "cart",
    title: "Ostukorv",
    description: "Mida sa ostad ja kui palju see koos kohaletoimetamisega maksab.",
    indexable: false,
    sections: ["buy"],
  },
  {
    route: "checkout",
    title: "Tellimuse vormistamine",
    description: "Tarneaadress, kohaletoimetamine ja maksmine.",
    indexable: false,
    sections: ["checkout-acknowledgement"],
  },
];

export const pages: readonly Page[] = [...marketingPages, ...legalPagesByLocale["et"]];
