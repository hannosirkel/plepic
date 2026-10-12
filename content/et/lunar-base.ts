/**
 * Estonian translation of the Lunar Base product copy in ../lunar-base.ts.
 *
 * The reasons for each export are in the English module. A game term of the
 * cards carries its printed English word in brackets where the product page
 * first uses it, and the names of the components in the box carry theirs.
 */
import type { FeatureSpec } from "../lunar-base.js";
import type {
  CallToAction,
  FaqEntry,
  ListItem,
  Prose,
  Section,
  Statement,
} from "../schema.js";

export const pitch: Statement = {
  text: "Lunar Base on strateegiline kaardimäng 2–6 mängijale, kus võistled selle nimel, kes ehitab võimsaima kuubaasi (Base).",
  source: "official-wording",
};

export const differentiator: Statement = {
  text: "Neli võiduvõimalust, mis on kõik korraga mängus – ja agendid (Agents), kelle saad saata kellegi teise baasi teda pidurdama.",
  source: "official-wording",
};

export const heroFacts: readonly Statement[] = [
  { text: "Ülesseadmiseks kulub umbes minut.", source: "E11" },
  { text: "Mängimiseks umbes 30 minutit.", source: "E10" },
];

export const featuredDescription: Prose = [
  "Lunar Base on strateegiline kaardimäng 2–6 mängijale, kus võistled selle nimel, kes ehitab võimsaima kuubaasi (Base). See on hoogne (mäng kestab umbes 30 minutit), kesk-kerge raskusastmega, kergesti õpitav ja kiiresti üles seatav.",
  "Oma kompaktse suuruse kohta toob Lunar Base lauale palju. Sellel on kvaliteetne trükk ja illustratsioonid, suurepärane korduvmängitavus, seda on lihtne kaasa võtta, raskusastet saab paindlikult kohandada ning erinevad võidustrateegiad annavad mängule mõnusalt sügavust.",
];

export const replayability: Statement = {
  text: "Mäng pakub korduvmängitavust ja keerukust tänu 4 ainulaadsele võidutingimusele, erinevatele strateegiatele, kaardikombinatsioonidele ja lisanduvatele mõjukaartidele (Influence), mis muudavad mängu dünaamikat.",
  source: "official-wording",
};

export const gameNightUse: Statement = {
  text: "Too see mänguõhtul lauale soojenduseks või õhtu lõpetuseks ning võta mängijaid vastavalt vajadusele juurde või lase neil lahkuda. Või naudi seda õhtu peasündmusena formaadis „parim 3 / 5 mängust“.",
  source: "official-wording",
};

export const specifications: readonly FeatureSpec[] = [
  {
    term: "Hoogne",
    detail: ["Mäng kestab keskmiselt 30 min. Mängi seda pausi ajal!"],
    source: "E10",
  },
  {
    term: "Korduvalt mängitav",
    detail: ["Iga mäng on ainulaadne. Lisa kaarte juurde või kasuta alternatiivseid reegleid."],
    source: "official-wording",
  },
  {
    term: "Kiire algus",
    detail: ["Selgeks 20 minutiga. Üles seatud 1 minutiga."],
    source: "E11",
  },
  {
    term: "Kaasaskantav",
    detail: ["Reisimõõdus, mahub taskusse. Võta see kõikjale kaasa!"],
    source: "E12",
  },
  {
    term: "Mängijad",
    detail: ["2 - 6 mängijat", "Vanus 10 +"],
    source: "E9",
  },
];

export const howItPlays: Section = {
  anchor: "how-it-plays",
  heading: "Käik koosneb kolmest sammust",
  body: [
    "Mängi välja agendikaarte. Oma käigu alguses võid neid välja mängida nii palju, kui suudad nende eest maksta – et oma baasi arengut kiirendada või kellelegi teisele ette jääda.",
    "Soorita üks oma baasi põhitegevus (Main Action). Ehita (Build) moodul (Module), vali (Draft) kaart, tõmba (Draw) kaart, viska ära (Discard) kaart, müü edasi (Resell) kaart, pööra ümber (Flip) jaam (Station), varasta moodul, varasta krediite (Credits). Üks tegevus nende seast, mida sinu baas päriselt teha suudab – seepärast muudabki see, mida ehitad, seda, mida saad järgmisel käigul teha.",
    "Kontrolli, kas süstikud (Shuttles) saabuvad. Kui varu (Supply) saab tühjaks, teenib igaüks ühe krediidi iga oma baasis tervikuks saanud kollase kera (Orb) eest ja Maalt tuuakse uusi kaarte.",
  ],
  source: "rulebook",
};

export const teaserVideos: readonly { heading: string; title: string; youTubeId: string }[] = [
  { heading: "Tiiser 1", title: "Lunar Base'i tiiser – osa 1", youTubeId: "QZ_Pqf3eY4o" },
  { heading: "Tiiser 2", title: "Lunar Base'i tiiser – osa 2", youTubeId: "KSuIqu5qzTM" },
  { heading: "Tiiser 3", title: "Lunar Base'i tiiser – osa 3", youTubeId: "JjlDpS2ByXY" },
  { heading: "Tiiser 4", title: "Lunar Base'i tiiser – osa 4", youTubeId: "v0lS1aenCXU" },
];

export const victoryPathsIntro: Statement = {
  text: "Kosmosevõidujooksu võitmiseks kasuta ära oma jaama tugevusi. Võida, majutades kõige rohkem koloniste, uurides välja teadussaavutusi, kuhjates Kuu krediite või saavutades suurima mõju (Influence).",
  source: "official-wording",
};

export const victoryPaths: readonly ListItem[] = [
  {
    term: "Kogu 20 Kuu krediiti",
    detail:
      "Mängi turul. Müü edasi, mida sa ei vaja, võta krediite neilt, kes seda vajavad, ja ära ehita kunagi midagi, mida sa ei saaks endale kaks korda lubada.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Majuta oma baasis 10 kolonisti",
    detail:
      "Ehita laiuti. Kolonistid asuvad sinu jaamal ja moodulitel, nii et see tee nõuab suurt ja hästi ühendatud baasi – ja seda näevad kõik ette.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Vii oma baasis lõpule 5 erinevat teadussaavutust",
    detail:
      "Viis erinevat. Neli saavutust ja üks kordus ei ole võit – see on lõks, mille see tee seab mängijale, kes kokku ei loe.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Näita oma käigu lõpus käest 4 mõjukaarti",
    detail:
      "Vaikne tee. Mõjukaardid kuuluvad edasijõudnute varianti, nii et see tee tekib alles siis, kui need kaardipakki segad – ja see võib mängu lõpetada käest, mida keegi pole vaadanud.",
    source: "rulebook-victory-conditions",
  },
];

export const victoryPathsNote: Statement = {
  text: "Mäng lõpeb hetkel, mil keegi täidab võidutingimuse. Viimast punktiarvestuse ringi ei ole, nii et viimane käik tähendab alati kellegi võitu, mitte ühist kokkuarvutamist.",
  source: "rulebook",
};

export const influenceVariantNote: Statement = {
  text: "Reegliraamat soovitab mõjukaardid esimestes mängudes välja jätta ja segada need kaardipakki siis, kui kõik lauas juba teavad, mida teevad.",
  source: "rulebook",
};

export const inTheBox: readonly ListItem[] = [
  { term: "6 jaama (Stations)", detail: "Üks igale mängijale, kahepoolsed.", source: "components" },
  { term: "26 agenti (Agents)", detail: "Mängitakse välja sinu käigu alguses, tasu eest.", source: "components" },
  { term: "8 mõjukaarti (Influences)", detail: "Edasijõudnute variant ja neljas võiduvõimalus.", source: "components" },
  { term: "50 moodulit (Modules)", detail: "Neist ehitad oma baasi.", source: "components" },
  { term: "6 krediidiloendurit", detail: "Üks igale mängijale, keeratud näitama sinu krediitide hetkeseisu.", source: "components" },
  { term: "Reegliraamat", detail: "Täielikud reeglid, mida saab lugeda ka sellel saidil.", source: "rulebook" },
];

export const inTheBoxSummary: Statement = {
  text: "Kokku 90 kaarti – 6 jaama, 26 agenti, 8 mõjukaarti ja 50 moodulit – ning lisaks 6 krediidiloendurit ja reegliraamat.",
  source: "components",
};

export const travelsWell: Section = {
  anchor: "travels-well",
  heading: "Mahub kotti, mis sul niikuinii kaasas on",
  body: [
    "Karp on 12 korda 12 korda 4 sentimeetrit ja kaalub 200 grammi. See mahub seljakoti taskusse ilma igasuguse planeerimiseta.",
    "Selles ongi vahe mängul, mis sul on, ja mängul, mida sa mängid: see siin tuleb kaasa pubisse, suvilasse ja mängumessi teisele päevale ning just see karp võetakse uuesti välja, kui suur mäng kell üksteist läbi saab.",
  ],
  source: "E12",
};

export const factions: readonly ListItem[] = [
  {
    term: "Shackleton",
    detail:
      "ÜRO toetusel ehitab üht suurt rahvusvahelist linna, lähtudes veendumusest, et kosmosetsivilisatsioon algab sellest, et kõik elavad koos.",
    source: "official-wording",
  },
  {
    term: "Taikotech",
    detail:
      "Veendunud, et just kaevandamisest ja rasketööstusest teenitud kasum on see, mis inimkonna päriselt planeedilt lahti tõstab.",
    source: "official-wording",
  },
  {
    term: "Selene Labs",
    detail:
      "Ostab kokku helgeimad pead, keda saada on, ja suunab nende pilgu Päikesesüsteemist välja viivale uksele.",
    source: "official-wording",
  },
  {
    term: "Dark Side",
    detail:
      "Biotehnoloogia ja liitreaalsuse raha, mis panustab transhumanismile: täiusta enne meeskonda ja alles siis laeva.",
    source: "official-wording",
  },
  {
    term: "Imbrium",
    detail:
      "Tööstuskartell, mis käib vana impeeriumide rada – ole kõige vägevam, olgu tööstuse või kaubanduse abil.",
    source: "official-wording",
  },
  {
    term: "The Oasis",
    detail:
      "Teeb Kuust teise kodu kogu Maa elule, loomad ja taimed kaasa arvatud – eriti neile, kellel siin all ruum otsa hakkab saama.",
    source: "official-wording",
  },
];

export const purchase = {
  productName: "{productName}",
  availability: "Laos olemas",
  notes: [
    {
      term: "Saadavus",
      detail:
        "Laos olemas ja nii see ka jääb. Me ei pea laoseisu loendurit, seega ei käsi miski sellel lehel sul kunagi kiirustada.",
      source: "stock-policy",
    },
    { term: "Väljasaatmine", detail: "Saadame tellimuse teele 3 tööpäeva jooksul.", source: "dispatch-window" },
    {
      term: "Tollimaksud",
      detail:
        "Väljaspool ELi nõuab sihtriik saabumisel imporditollimaksud ja käitlustasud ning need tasub saaja.",
      source: "duties-outside-eu",
    },
  ] satisfies readonly ListItem[],
  callsToAction: [
    { label: "Lisa ostukorvi", emphasis: "primary", target: { kind: "route", to: "cart" } },
    {
      label: "Saatmine ja tagastamine",
      emphasis: "quiet",
      target: { kind: "route", to: "legalShipping" },
    },
  ] satisfies readonly CallToAction[],
} as const;

export const productFaq: readonly FaqEntry[] = [
  {
    question: "Kui palju saatmine maksab?",
    answer: [
      "Saatekulu arvutatakse tellimuse vormistamisel sinu tarneaadressi järgi, nagu ka maks. Mängu maksueelne hind on kõikjal sama; muutub see, mis sellele lisandub: {priceLine}",
    ],
    source: "shipping-charge",
  },
  {
    question: "Kuhu te saadate?",
    answer: [
      "Kõikjale. Tellimused saadame teele 3 tööpäeva jooksul. ELi piires võtab kättetoimetamine tavaliselt 3 kuni 7 tööpäeva ja mujal 7 kuni 21.",
    ],
    source: "delivery-estimates",
  },
  {
    question: "Kas saan mängu tagastada?",
    answer: [
      "Jah. Sul on paki saabumise päevast 14 päeva aega meile teatada, et taganed lepingust, ja veel 14 päeva, et mäng tagasi saata.",
    ],
    source: "withdrawal-terms",
  },
  {
    question: "Kas on olemas ingliskeelne reegliraamat?",
    answer: [
      "Karbis olev reegliraamat on inglise keeles ja sama reegliraamat on ka sellel saidil, kui soovid seda enne ostmist lugeda.",
    ],
    source: "rulebook",
  },
  {
    question: "Kas see toimib kahe mängijaga? Aga kuuega?",
    answer: [
      "Mõlemaga, ja need on märgatavalt erinevad mängud. Kahekesi on varus viis kaarti ja üle laua on üks baas: mäng kulgeb nagu duell ja tavaliselt näed, mille poole vastane küünitab.",
      "Kuuekesi on varus üheksa kaarti ja sinu vastas on viis teist baasi, nii et agendikaartidel on palju rohkem sihtmärke. Kuus on selle vahemiku ülemine ots, mille jaoks mäng loodi, mitte selle äärmus.",
    ],
    source: "rulebook",
  },
];

export const productSafety = {
  heading: "Tootja ja tooteohutus",
  manufacturer: {
    heading: "Tootja",
    body: [
      "{merchantLegalName}, {merchantRegisteredAddress}.",
      "E-post: {merchantContactAddress}. Telefon: {merchantPhoneNumber}.",
      "{merchantLegalName} laseb selle mängu valmistada oma spetsifikatsiooni järgi ja müüb seda oma nime all ning on selle tootja selles tähenduses, milles ELi tooteohutusõigus seda sõna kasutab. Hiinas Shanghais asuv Longpack Co., Ltd. on lepinguline valmistaja, kes mängu trükib ja komplekteerib; lepinguline valmistaja ei ole tootja.",
    ],
  },
  safety: {
    heading: "Ohutusteave",
    body: [
      "Ülal mängu andmetes toodud vanusemärgis on selle toote ohutusmärgis, mitte mängusoovitus. Selle taga on järgmine.",
      "Mängu katsetas Euroopa mänguasjade ohutuse standardite järgi Intertek Testing Services Ltd. Shanghais, katseprotokoll SHAH01338706, 14. mai 2021, ja mäng läbis kõik selles sisalduvad katsed. Allpool toodud tulemused kehtivad ka praegu: hilisemat trükki ei ole olnud, seega kirjeldavad need just neid eksemplare, mida tegelikult müüakse.",
    ],
    results: [
      {
        term: "EN71-1:2014+A1:2018",
        detail: "Mehaanilised ja füüsikalised omadused – läbitud.",
        source: "E16",
      },
      { term: "EN71-2:2020", detail: "Süttivus – läbitud.", source: "E16" },
      {
        term: "EN71-3:2019",
        detail: "Teatud elementide migratsioon – läbitud.",
        source: "E16",
      },
      {
        term: "EN71-3:2019 koos määrusega (EL) 2019/1922",
        detail:
          "Millega muudetakse direktiivi 2009/48/EÜ, alumiiniumi migratsioon – läbitud.",
        source: "E16",
      },
    ] satisfies readonly ListItem[],
  },
} as const;
