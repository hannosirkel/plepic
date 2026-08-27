/**
 * Saatmine ja kättetoimetamine — the Estonian edition of `../shipping.ts`.
 *
 * A translation, not a revision. Everything the English page decided binds
 * this one:
 *
 * - Every estimate is the commercial model Task 1 froze. Two shipping zones,
 *   Euroopa Liit and the rest of the world, until 2026-08-26; nothing
 *   territory-by-territory is elaborated here beyond what that decision
 *   added, by standing operator decision.
 * - **The advertised figure is net, and the VAT section says so in both
 *   directions.** The advertised figure is the price before tax; Estonian VAT
 *   is added for a delivery address in the European Union and added nowhere
 *   else. The previous Estonian text said the opposite — *"Sisaldab tähendab, et maks on
 *   selle summa sees"* and *"See on sama summa igale külastajale igas riigis"*
 *   — because the English text it translated did. Both were rewritten on
 *   2026-08-18, together.
 * - The figure itself is never written here; it resolves from the catalogue.
 *
 * ## The parcel machine method, added 2026-08-26
 *
 * `../shipping.ts` gained a paragraph naming the free Omniva parcel machine
 * method the operator added for a delivery address in Estonia, Latvia or
 * Lithuania, alongside Standard delivery rather than instead of it — see that
 * file's own header for the full reasoning, including why the method's rate
 * is written as the plain word "free" instead of through a placeholder. The
 * paragraph below is this file's translation of it, added in the same
 * change so the two editions' delivery sections keep the identical structure
 * `content/content.test.ts`'s edition-parity check requires. `Standard
 * delivery` and `Omniva parcel machine` are left untranslated because they
 * are the exact option names Medusa returns at checkout in every locale —
 * translating them here would give an Estonian reader a name they will not
 * meet at checkout.
 *
 * **This one paragraph has not itself had the qualified reader's separate
 * confirmation the header below records for the rest of the page's Estonian
 * text**, for the reason that header already gives: a change to this page's
 * substance needs its own reading. It is added now so the structural
 * guarantee holds and no legally required disclosure exists in one edition
 * and not the other; the operator's own review of this specific Estonian
 * wording is outstanding and should happen before this page is next
 * reviewed as a whole.
 *
 * Anchors, `covers`, sources and every placeholder token are byte-identical to
 * the English page, which is why the callout's `lead` is `{priceTaxQualifier}`
 * rather than a phrase written out in Estonian.
 *
 * **That has a consequence a qualified reader should look at first.** The
 * qualifier now names the reader's *destination* as well as the tax state —
 * "VAT added, delivering to Estonia" — so it cannot be a fixed phrase in a
 * content file, and `storefront/src/lib/catalogue.ts` composes it once, in
 * English, from `storefront/mock/countries.json`'s English country names. The
 * Estonian page therefore renders that one line in English. It is a known
 * limitation of composing the qualification in exactly one place, recorded
 * here rather than left to be discovered; resolving it means giving the
 * catalogue resolver a locale and the country list Estonian names, which is a
 * change to the storefront rather than to this file.
 *
 * `reviewStatus` is `operator-approved`, and it records **both** things: the
 * page as served — the operator supplied the merchant identity and the
 * deployment manifests now serve it — and the qualified reader's acceptance of
 * the Estonian legal text, which the operator confirmed as given on
 * 2026-08-20 and recorded in the project's decision log, which lives outside
 * this repository. The Estonian VAT wording below is a translation of English
 * wording the operator approved, so its substance is covered and the
 * acceptance is of the text as it stands. It is not a standing approval of
 * whatever these pages may later say: a change to their substance needs its own
 * reading, exactly as this one did.
 */

import type { LegalPage } from "../../schema.js";

export const shipping: LegalPage = {
  route: "legalShipping",
  title: "Saatmine ja kättetoimetamine",
  description:
    "Kuhu me saadame, kui kaua teelepanek ja kättetoimetamine aega võtavad, kuidas saatekulu arvestatakse ja kuidas maks lisandub hinnale, mida sa näed.",
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
        "Standard delivery on saadaval igale aadressile, kuhu me saadame: üks kindel tariif tarneaadressile, mis asub Euroopa Liidu liikmesriigis, ja kõrgem kindel tariif tarneaadressile mujal — mõlemad arvutatakse tellimuse vormistamisel. Kui sinu tarneaadress on Eestis, Lätis või Leedus, võid Standard delivery asemel valida Omniva parcel machine, ja see viis on tasuta.",
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
        lead: "{price} · {priceTaxQualifier}",
        detail:
          "Saatekulu arvutatakse tellimuse vormistamisel ja Euroopa Liidu sisese kättetoimetamise puhul lisandub sellele käibemaks. Väljaspool Euroopa Liitu kohalduvad maksud ja lõivud, kui neid on, hinnas ei sisaldu.",
      },
      body: [
        "Mängu hind enne maksu on {priceNet}. See summa on sama, kus sa ka ei asuks; muutub üksnes maks, mis sellele lisandub.",
        "Euroopa Liidus asuvale aadressile kättetoimetamisel lisame Eesti käibemaksu määraga {vatRate}. Kauba hind on siis {priceGross} — {priceNet} pluss {priceVat} käibemaksu — ja see on summa, mille sa maksad.",
        "Mujale kättetoimetamisel Euroopa Liidu käibemaksu tasuda ei tule ja seda ei lisata. Kauba hind on {priceNet} ja see on summa, mille sa maksad.",
        "Saatekulu arvestatakse samamoodi. Saatekulu esitatakse enne maksu; Euroopa Liidu sisese kättetoimetamise puhul lisandub sellele Eesti käibemaks määraga {vatRate}, mujale kättetoimetamisel mitte. Sa näed täpset summat — koos selles sisalduva maksuga, kui seda on — enne maksmist.",
        "Milline neist sinu puhul kehtib, selgitatakse välja tellimuse vormistamisel kinnitatud tarneaadressi põhjal. Enne selle sisestamist valitakse näidatav summa sellel saidil määratud sihtkoha järgi, mida sa saad muuta; see ei määra kunagi, mida sinult võetakse.",
        "Äriostjad: kuvatud hind on tarbijahind. Kui Eesti käibemaks lisandub, näidatakse selle summat eraldi tellimuse vormistamisel, enne maksmist. Kui vajad oma raamatupidamise jaoks arvet, kus maksukäsitlus on välja toodud, kirjuta enne tellimist aadressil {merchantContactAddress}.",
      ],
      source: "price-presentation",
    },
  ],
};
