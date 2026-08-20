/**
 * Saatmine ja kättetoimetamine — the Estonian edition of `../shipping.ts`.
 *
 * A translation, not a revision. Everything the English page decided binds
 * this one:
 *
 * - Every estimate is the commercial model Task 1 froze. Two shipping zones,
 *   Euroopa Liit and the rest of the world; nothing territory-by-territory is
 *   elaborated here, by standing operator decision.
 * - **The VAT section quotes `{price}`, never `{priceLine}`**, and its callout
 *   is the operator's own two-line price presentation of 2026-08-10,
 *   translated. The conditional is stated once, in the callout; the body
 *   glosses how the tax sits in the figure and that the figure is identical
 *   where none is due, exactly as the English body does.
 * - The figure itself is never written here; it resolves from the catalogue.
 *
 * Anchors, `covers`, sources and every placeholder token are
 * byte-identical to the English page. `reviewStatus` is
 * `operator-approved`: the operator supplied the merchant identity, the
 * deployment manifests now serve it, and the page as served is what was
 * approved. That field records **that** approval and nothing else — the
 * qualified reader's acceptance of the Estonian text remains an operator act
 * recorded outside this repository, with no field here, and this status does
 * not represent it.
 */

import type { LegalPage } from "../../schema.js";

export const shipping: LegalPage = {
  route: "legalShipping",
  title: "Saatmine ja kättetoimetamine",
  description:
    "Kuhu me saadame, kui kaua teelepanek ja kättetoimetamine aega võtavad, kuidas saatekulu arvestatakse ja kuidas maks sisaldub hinnas, mida sa näed.",
  indexable: true,
  sections: ["delivery", "vat"],
  covers: ["delivery-terms", "dispatch-estimate", "vat-presentation"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "delivery",
      heading: "Kuhu me saadame ja kui kaua see aega võtab",
      covers: ["delivery-terms", "dispatch-estimate"],
      body: [
        "Saadame igasse riiki.",
        "Tellimused antakse vedajale üle 3 tööpäeva jooksul pärast makse laekumist. Pärast teelepanekut võtab kättetoimetamine Euroopa Liidus tavaliselt 3 kuni 7 tööpäeva ning mujal maailmas tavaliselt 7 kuni 21 tööpäeva.",
        "Need on vedaja hinnangud, mitte lubadused. Tollikontroll, streigid ja jõulueelsed paar nädalat liigutavad neid kõiki. Kui pakk on oluliselt üle aja, kirjuta meile aadressil {merchantContactAddress} ja me uurime järele.",
        "Kui pakki lihtsalt ei tulegi, võid määrata meile täiendava mõistliku tähtaja ja kui me ka sellest mööda laseme, tellimusest taganeda ja saada kogu raha tagasi.",
        "Saatekulu arvestatakse tellimuse kohta ja see arvutatakse tellimuse vormistamisel pärast tarneaadressi sisestamist. Sa näed täpset summat enne maksmist; ühtegi etappi, kus kulu pärast maksmist muutuks, ei ole.",
        "Väljapoole Euroopa Liitu saadetud tellimustele võivad saabumisel lisanduda imporditollimaksud, maksud ja vedaja käitlustasud. Neid nõuab sihtriik, need tasub saaja ja meie neid ei kogu. Me ei arvuta neid ega oska neid sinu eest hinnata.",
      ],
      source: "delivery-estimates",
    },
    {
      anchor: "vat",
      heading: "Kuidas hind on esitatud",
      covers: ["vat-presentation"],
      callout: {
        lead: "{price} · sisaldab käibemaksu, kui see kuulub tasumisele",
        detail:
          "Saatekulu arvutatakse tellimuse vormistamisel. Väljaspool Euroopa Liitu kohalduvad maksud ja lõivud, kui neid on, hinnas ei sisaldu.",
      },
      body: [
        "See on hind, mida näidatakse tootelehel ja ostukorvis, ja see on hind, mille tarbija kauba eest maksab.",
        "Sisaldab tähendab, et maks on selle summa sees, mitte ei lisandu sellele. See on sama summa igale külastajale igas riigis ega muutu selle järgi, kus sa asud või kuhu sa palud meil paki saata – sealhulgas juhul, kui käibemaks ei kuulu üldse tasumisele. Kui maks kuulub tasumisele, selgitatakse tellimuse vormistamisel kinnitatud tarneaadressi põhjal välja, milline maks kohaldub.",
        "Saatekulu on ainus summa, mis tellimuse vormistamisel lisandub, ja seda näidatakse sulle enne, kui sa tellimuse kinnitad.",
        "Äriostjad: kuvatud hind on tarbijahind, milles sisaldub tasumisele kuuluv maks. Kui vajad oma raamatupidamise jaoks arvet, kus maksukäsitlus on välja toodud, kirjuta enne tellimist aadressil {merchantContactAddress}.",
      ],
      source: "price-presentation",
    },
  ],
};
