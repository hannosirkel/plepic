/** Estonian translation of the publisher copy in ../publisher.ts. */
import type { CallToAction, Prose, Section, Statement } from "../schema.js";

export const publisherSentence: Statement = {
  text: "Plepic Games on lauamänguhuviliste rühm, kes lõi Lunar Base'i – Kickstarteri toel valminud kaardimängu, mida täiustati üle kolme aasta ja mitmel mandril.",
  source: "E8",
};

export const publisherShort: Statement = {
  text: "Väike sõltumatu lauamängukirjastus Tallinna lähedal. Kuus inimest, üks mäng, kolm aastat tööd.",
  source: "E8",
};

export const publisherStory: Section = {
  anchor: "story",
  heading: "Kuus inimest, üks mäng, kolm aastat",
  body: [
    "Lunar Base sai alguse 2017. aastal, kui kuus sõpra Eestis seadsid endale lihtsa ülesande: luua kaasaskantav kaardimäng, mida nad ise tõesti koos mängida tahaksid. Esialgsest lihtsast omatehtud prototüübist kasvas aastatepikkuse katsetamise, mängutestide, tasakaalustamise, kujundamise ja maailma loomise käigus kiire ja kompaktne strateegiamäng inimkonna võidujooksust Kuu asustamiseks. Selle aja jooksul meeskond kasvas, mõtteid prooviti ja jäeti kõrvale ning lugematud väikesed parandused andsid mängule lõpliku kuju. Edukas Kickstarteri kampaania muutis sõprade ühise projekti avaldatud lauamänguks, mida mängitakse kogu maailmas.",
  ],
  source: "E8",
  links: [
    {
      label: "Saamislugu",
      target: { kind: "external", to: "origin-story" },
      accessibleLabel: "Loe Lunar Base'i saamislugu",
    },
  ],
};

/** Editorial source record, mirroring the English edition. */
export const publisherStorySources: readonly Statement[] = [
  { text: "2017, kuus inimest, Tallinna lähedal.", source: "E8" },
  { text: "Kolm aastat täiustamist; mängu mahtu vähendati, kuni seda oli lõbus mängida.", source: "E8" },
  { text: "Kickstarteris rahastas seda üle kahe tuhande toetaja, seejärel jõudis mäng nendeni.", source: "E5" },
  {
    text: "Umbes viiskümmend eksemplari müüdi Taani lauamängukohvikus, kus peeti ka mängu sünniloo esitlus ja turniir.",
    source: "E6",
  },
  { text: "Endiselt kuus inimest.", source: "E8" },
];

export const team: Section = {
  anchor: "team",
  heading: "Need kuus",
  body: ["*Lõpuks ometi* värske trükise lõhna nautimas"],
  source: "E8",
};

export const newsletter = {
  heading: "Kirjutame sulle harva",
  body: [
    "Saadame kirja siis, kui meil on tõesti midagi kirja väärilist: uus mäng, kordustrükk või Lunar Base'i mängimine Kuul.",
    "Loobumiseks piisab ühest klõpsust ja sinu aadressi ei anta kellelegi teisele.",
  ] satisfies Prose,
  fieldLabel: "E-posti aadress",
  submitLabel: "Liitu uudiskirjaga",
  consentNote:
    "Liitudes nõustud saama meilt aeg-ajalt e-kirju. Saad tellimusest loobuda igas kirjas.",
  successMessage: "Oled liitunud. Kirjutame vaid siis, kui meil on midagi saatmist väärt.",
  errorMessage: "Liitumine ei õnnestunud. Kontrolli vormi ja proovi uuesti.",
  postPurchaseHeading: "Kuule meist pärast tellimust",
  postPurchaseBody:
    "See valik ei mõjuta sinu tellimust. Liitu ainult siis, kui soovid aeg-ajalt Plepic Games'i uudiseid.",
  postPurchaseConsentLabel: "Jah, soovin sellele e-posti aadressile aeg-ajalt uudiseid.",
} as const;

export const homepageCallsToAction: readonly CallToAction[] = [
  {
    label: "Avasta Lunar Base",
    emphasis: "primary",
    target: { kind: "route", to: "lunarBase" },
  },
  {
    label: "Osta hinnaga {price}",
    emphasis: "secondary",
    target: { kind: "route", to: "lunarBase", anchor: "buy" },
    accessibleLabel: "Osta Lunar Base hinnaga {price}",
  },
];
