/** Estonian translation of the support copy in ../support.ts. */
import type { FaqEntry, Link, Section } from "../schema.js";

export const supportIntro: Section = {
  anchor: "rules-faq",
  heading: "Reeglid ja abi",
  body: [
    "Täielik reegliraamat on siin veebilehel, nagu ka küsimused, mis mängulauas kõige sagedamini tekivad. Kui sa siit vastust ei leia, kirjuta meile – seda postkasti loevad kuus inimest ja üks neist kujundas kaardi, mille üle te vaidlete.",
  ],
};

export const printedRulebookNote: Section = {
  anchor: "rules-faq",
  heading: "Kui tulid reegliraamatus trükitud aadressilt",
  body: [
    "Oled õiges kohas. Mängu vana veebileht suunab nüüd siia ning sellelt lehelt leiad kehtivad reeglid, korduma kippuvad küsimused ja variandid.",
  ],
  source: "rulebook",
};

export const rulebookLink: Link = {
  label: "Loe reegliraamatut",
  target: { kind: "route", to: "rulebook" },
  accessibleLabel: "Loe Lunar Base'i reegliraamatut",
};

export const rulesFaq: readonly FaqEntry[] = [
  {
    question: "Kaks mängijat täidavad samal käigul võidutingimuse. Kes võidab?",
    answer: [
      "Võidab see, kes täitis rohkem tingimusi. Kui neid on mõlemal sama palju, jagavad nad võitu.",
    ],
    source: "rulebook",
  },
  {
    question: "Kas peaksime esimeses mängus kasutama mõjukaarte (Influence)?",
    answer: [
      "Ei. Reegliraamat soovitab need kõrvale jätta, kuni kõik mängijad tunnevad end kindlalt, ja siis enne kaartide jagamist kaardipakki segada. Need lisavad neljanda võiduvõimaluse ja muudavad seda, kuidas ülejäänud kolm tunduvad.",
    ],
    source: "rulebook",
  },
  {
    question: "Kas viis teadussaavutust tähendab viit kaarti?",
    answer: [
      "See tähendab viit erinevat saavutust. Kaks ühesugust saavutust lähevad arvesse ühena – selle vea tõttu võib mäng kaotsi minna.",
    ],
    source: "rulebook",
  },
  {
    question: "Kaardipakk sai otsa. Mis nüüd?",
    answer: [
      "Sega äravisatud kaartide pakk uueks kaardipakiks ja jätka kaartide tõmbamist.",
    ],
    source: "rulebook",
  },
  {
    question: "Kui palju kaarte võin käes hoida?",
    answer: ["Nii palju, kui soovid. Käes olevate kaartide arvul pole ülempiiri."],
    source: "rulebook",
  },
  {
    question: "Kes alustab?",
    answer: [
      "See, kes on viimase 30 päeva jooksul teinud pikima reisi. Järgmistes mängudes alustab võitjast vasakul istuv mängija.",
    ],
    source: "rulebook",
  },
  {
    question: "Kas võin oma käigul teha rohkem kui ühe põhitegevuse (Main Action)?",
    answer: [
      "Ei – ühe põhitegevuse käigu kohta, valides oma baasis (Base) saadaolevate seast. Enne seda võid mängida välja nii palju agendikaarte (Agent), kui suudad nende eest maksta.",
    ],
    source: "rulebook",
  },
];

export const contact: Section = {
  anchor: "contact",
  heading: "Kirjuta meile",
  body: [
    "Küsimus reeglite kohta, puuduv kaart, pood, kes soovib mängu müüa, või tellimus, millest pole enam kuulda – kõik jõuab samasse kohta. Vastame päeva või kahe jooksul.",
    "Saad meiega ühendust võtta ka aadressil {merchantContactAddress}.",
  ],
};

export const contactForm = {
  nameLabel: "Sinu nimi",
  emailLabel: "Sinu e-posti aadress",
  subjectLabel: "Millest soovid kirjutada?",
  messageLabel: "Sõnum",
  submitLabel: "Saada",
  successMessage: "Aitäh – sinu sõnum jõudis meieni.",
  errorMessage:
    "Sõnumit ei õnnestunud saata. Proovi uuesti või kirjuta meile otse aadressil {merchantContactAddress}.",
  notSentMessage:
    "Midagi ei saadetud. See vorm ei jõua meie postkasti, seega sinu sõnumit ei edastatud ega salvestatud. Palun kirjuta meile e-kirjaga – aadress on kohe üleval.",
} as const;
