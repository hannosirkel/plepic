/** Estonian translation of the proof strip and attributed quotations. */
import type { ProofStrip, Quotation } from "../schema.js";

/** Paul Grogan's translated words serve both presentations. */
export const cardDesignQuote =
  "Kaartide välimus illustratsiooni ja graafilise kujunduse seisukohast – see on väga selge ja toimiv ning samal ajal ilus. Sellist tasakaalu on mängudes raske saavutada.";

export const proofStrip: ProofStrip = {
  items: [
    {
      source: "E5",
      supporting: ["E14", "E15"],
      headline: "Rahastas üle 2 000 toetaja",
      detail:
        "Eesmärk täitus kahe tunniga ja kampaania lõppes 4 606 protsendiga eesmärgist. Seejärel mäng trükiti, pakiti karpidesse ja saadeti teele ning toetajad said oma eksemplarid kätte.",
      link: {
        label: "Vaata kampaaniat",
        target: { kind: "external", to: "kickstarter-campaign" },
        accessibleLabel: "Vaata Lunar Base'i Kickstarteri kampaaniat",
      },
    },
    {
      source: "E3",
      headline: "„" + cardDesignQuote + "“",
      detail: "Paul Grogan, Gaming Rules!",
    },
    {
      source: "E2",
      headline: "„Vabalt võib see olla vahemäng, mis võtab enda alla terve õhtu.“",
      detail: "Hairy Game Lords",
    },
  ],
  /** The same editorial decisions as the English source; these are not rendered. */
  rejected: [
    {
      source: "E7",
      reason:
        "Soome ja Eesti jaekettide kaudu müüdi kummaski umbes 100 eksemplari. See on kinnitatud, kuid kette ei saa nimetada, nii et külastaja peaks nimetut arvu lihtsalt uskuma – see on nõrgem kui sama ülesannet täitev Brætspilscaféeni näide. Varem jäi see alles /about-lehe ajajoonele, kus kuupäevade rida andis sellele koha; haldaja lõpetas selle lehe kasutamise 2026-08-20 ja eemaldas ajajoone, nii et E7 ei ilmu enam kusagil saidil. Kirje jääb tõendusmaterjali hulka, sest arv on kontrollitud ja mõni hilisem jaotis võib sellele koha anda; praegu seda ei näidata ning lugeja ei peaks sellest loendist teisiti järeldama.",
    },
    {
      source: "E1",
      reason:
        "Rodney Smithi AireConil antud esikümne valik on neist kõige tuntum nimi, aga ka ainus kirje, mida uus külastaja ei saa kontrollida: video on eemaldatud ja sellele ei saa viidata, seega jääb üle vaid meie sõna. Pealkirjas olev arv peab olema kontrollitav. See on ka kirje, mille juurde kujundaja kõige tõenäolisemalt märgi lisaks, kuid tõendusmaterjal seda ei luba. Tsitaat on mängu lehel, kus seda nimetatakse täpselt esikümne video valikuks.",
    },
    {
      source: "E6",
      reason:
        "Umbes 50 eksemplari müüdi Taani lauamängukohviku kaudu, kus toimusid ka mängu sünniloo esitlus ja turniir. See on kinnitatud ning oli selle riba esimene kirje kuni 2026-08-20, mil haldaja asendas selle E3-ga. Sõltumatu jaemüük on siin tugevaim *tõendi liik*, kuid kohvikut ei saa uuele külastajale pealkirjas tutvustada – detailirida kulus Brætspilscaféeni selgitamisele, enne kui arv midagi tähendas. See jääb alles kirjastuse loo lõigupõhistes allikaviidetes.",
    },
    {
      source: "E4",
      reason:
        "Meie kõige paremini sõnastatud tsitaat, kuid riba jaoks liiga pikk. See avab hoopis mängulehe arvustuste jaotise, kus sellel on piisavalt ruumi.",
    },
    {
      source: "E9",
      reason:
        "Mängijate arv – koos mängu- ja ülesseadmisajaga E10 ning E11 – on õige ja kasulik, kuid see on meie enda mängukirjeldus, mitte sõltumatu kinnitus. Arvustuse kõrval tõendite ribal saaks see usaldusväärsuse, mida see pole teeninud. Selle koht on karbi juures mängu andmete loendis, kus see juba on.",
    },
  ],
};

export const quotations: readonly Quotation[] = [
  {
    source: "E4",
    attribution: "Tabletop Games Blog",
    text: "Lunar Base on tõesti armas väike mäng. See annab sulle piisavalt tegevust ja mõtlemisainet, ilma et muutuks liiga nõudlikuks, ning kulgeb nii kiiresti, et ei jõua ära tüüdata. See on ka üks väheseid mulle kuuluvaid mänge, mida saab mängida kuni 6 mängijaga, seega sobib see hästi sõprade või pere kokkusaamisele, olemata peomäng.",
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "Selles mängus on palju sügavust, aga karp on tilluke! Seda on väga lihtne kaasa võtta ja väikese raha eest saab siin tõesti palju.",
  },
  {
    source: "E1",
    attribution: "Rodney Smith, Watch It Played",
    text: "See üllatas mind tõesti väga… kõik mahub sellesse tillukesse karpi. Ja illustratsioonid on suurepärased! Olin tõesti väga vaimustunud.",
    context: "Üks tema AireConi esikümne valikutest.",
  },
  {
    source: "E3",
    attribution: "Paul Grogan, Gaming Rules!",
    text: cardDesignQuote,
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "Uuesti mängimise väärtus on suurepärane. Nii väikese mängu kohta on see väga hästi toodetud. Seda on rõõm mängida!",
  },
];
