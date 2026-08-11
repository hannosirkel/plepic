/**
 * Müügitingimused — the Estonian edition of `../terms.ts`.
 *
 * A translation, not a revision: the English page is the twice-reviewed
 * drafting source, and every structural decision recorded there binds this
 * file too. In particular:
 *
 * - **There is deliberately no ODR-platform link.** The platform was
 *   dismantled in July 2025; its absence is correct in both languages.
 * - **The access method is a link, not a hostname**, and the link is an
 *   enhancement rather than the disclosure — the prose naming the
 *   tarbijavaidluste komisjon discharges the obligation on its own.
 * - The checkout-acknowledgement section is written to match the checkout
 *   screen; the statutory button wording it describes is VÕS § 62¹'s
 *   "tellimus koos maksekohustusega".
 *
 * Anchors, `covers`, the external target id and every placeholder token
 * are byte-identical to the English page. `reviewStatus` stays
 * `draft-pending-operator-input`; the qualified reader's acceptance of the
 * Estonian text is an operator act.
 */

import type { LegalPage } from "../../schema.js";

export const terms: LegalPage = {
  route: "legalTerms",
  title: "Müügitingimused",
  description:
    "Tingimused, millega sa tellides nõustud: kuidas leping tekib, mida sa tellimuse vormistamisel kinnitad, maksmine, mis saab siis, kui midagi läheb valesti, ja kuhu vaidlusega pöörduda.",
  indexable: true,
  sections: ["checkout-acknowledgement", "delivery", "dispute-resolution"],
  covers: ["checkout-acknowledgement", "dispute-resolution"],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "checkout-acknowledgement",
      heading: "Mida sa tellimuse vormistamisel kinnitad",
      covers: ["checkout-acknowledgement"],
      body: [
        "Tellimuse esitamine on ostupakkumus. Leping tekib siis, kui saadame sulle kauba teelepaneku kinnituse – mitte siis, kui sa nuppu vajutad, ega siis, kui makse autoriseeritakse.",
        "Tellimuse vormistamise lehe viimane nupp on märgistatud nii, et selle vajutamine esitab tellimuse koos maksekohustusega. Vahetult nupu kohal näed ühel ekraanil: kaupa, kauba hinda, saatekulu, kogusummat, tarneaadressi ja tarne eeldatavat aega.",
        "Tellimust esitades kinnitad, et oled need tingimused ja privaatsusteate läbi lugenud ja nendega nõus, et ostad nii, nagu sellel saidil kirjeldatud, ning et oled vähemalt 18-aastane või tellid kellegi nõusolekul, kes seda on.",
        "Saadame sulle e-postiga kinnituse, mis sisaldab tellimust, makstud kogusummat ja neid tingimusi. Hoia see alles – see on sinu eksemplar lepingust.",
        "Võtame vastu kaardimakseid oma makseteenuse pakkuja kaudu. Meie ei näe ega salvesta kunagi sinu kaardinumbrit. Kui makse ebaõnnestub või hiljem tagasi pööratakse, tellimus edasi ei liigu.",
        "Müüme tarbijatele ja ettevõtetele samadel tingimustel. Miski sellel lehel ei vähenda tarbija seadusest tulenevaid õigusi.",
      ],
      source: "checkout-contract",
    },
    {
      anchor: "delivery",
      heading: "Saadavus, hind ja eksimused",
      covers: [],
      body: [
        "Me müüme ühte toodet. Kui me ei saa seda tarnida – tiraaž on otsas või pakki ei ole võimalik sinu riiki toimetada – ütleme sulle ja tagastame kogu raha. Me ei ole kohustatud hankima asendust.",
        "Hind on see, mis on kuvatud tellimuse esitamise hetkel. Kui hind on ilmse vea tõttu kuvatud valesti ja sa võisid mõistlikult aru saada, et tegu on veaga, ei ole me kohustatud selle hinnaga müüma; ütleme sulle ja kas tühistame tellimuse või palume sul õige hinnaga kinnitada.",
        "Kui tellimusega on midagi valesti läinud, kirjuta esmalt aadressil {merchantContactAddress}. Me parandame asja palju meelsamini, kui laseme sul kaardi väljastajaga vaielda.",
        "Nendele tingimustele kohaldub selle riigi õigus, kus {merchantLegalName} on asutatud, ja miski neis ei võta sinult kaitset, mille annavad sinu elukohariigi imperatiivsed tarbijakaitsenormid.",
      ],
    },
    {
      anchor: "dispute-resolution",
      heading: "Kui meile kirjutamine asja ei lahenda",
      covers: ["dispute-resolution"],
      body: [
        "Kui me omavahel kokkuleppele ei jõua ja sa elad Euroopa Liidus, võid pöörduda vaidlusega tarbijavaidluste komisjoni poole, mis tegutseb Tarbijakaitse ja Tehnilise Järelevalve Ameti juures. Menetlus on tasuta. Miski siin ei piira sinu õigust pöörduda hoopis kohtusse.",
      ],
      links: [
        {
          label: "Kuidas tarbijavaidluste komisjoni poole pöörduda",
          target: { kind: "external", to: "consumer-disputes-committee" },
        },
      ],
    },
  ],
};
