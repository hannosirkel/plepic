/**
 * Tagastamine ja taganemisõigus — the Estonian edition of `../returns.ts`.
 *
 * A translation, not a revision. The deadlines are the statutory ones for
 * distance selling to consumers and are written as entitlements, exactly as
 * the English page writes them:
 *
 * - **The withdrawal period is 14 days** — taganemistähtaeg, VÕS § 56. The
 *   operator decided on 2026-08-09 to keep the statutory 14 rather than
 *   extend it; that decision binds this edition identically.
 * - The withdrawal-form section provides the Annex I(B) model form — the
 *   taganemisavalduse tüüpvorm of VÕS lisa 1 — in the same condensed
 *   singular shape the English page provides it.
 * - The legal-guarantee section states the two-year conformity liability
 *   positively, in the settled consumer vocabulary (lepingutingimustele
 *   vastavus, pretensiooni esitamise õigus), including the two-month
 *   notification duty of VÕS § 220(1).
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

export const returns: LegalPage = {
  route: "legalReturns",
  title: "Tagastamine ja taganemisõigus",
  description:
    "Sinu 14-päevane õigus tellimusest taganeda, kuidas seda kasutada, taganemisavalduse tüüpvorm, kes maksab tagastamise postikulu, kuhu pakk saata ja kuidas tagasimakse toimib.",
  indexable: true,
  sections: ["withdrawal", "withdrawal-form", "returns-process", "legal-guarantee"],
  covers: [
    "withdrawal-process",
    "withdrawal-deadline",
    "model-withdrawal-form",
    "return-postage-liability",
    "return-address",
    "legal-guarantee-of-conformity",
  ],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "withdrawal",
      heading: "Sul on 14 päeva, et ümber mõelda",
      covers: ["withdrawal-process", "withdrawal-deadline"],
      body: [
        "Kui sa ostad tarbijana, võid lepingust taganeda põhjust avaldamata.",
        "Taganemistähtaeg on 14 päeva alates päevast, mil sina või sinu nimetatud isik, kes ei ole vedaja, saab kauba füüsiliselt enda valdusesse.",
        "Taganemiseks anna meile sellest teada enne 14 päeva möödumist. Saada aadressil {merchantContactAddress} kiri oma tellimuse numbriga ja lausega, et sa taganed – sellest piisab. Soovi korral võid kasutada allolevat taganemisavalduse tüüpvormi, kuid see ei ole kohustuslik. Ka lihtsalt paki tagasi saatmine ilma meile teatamata toimib, kuid sõnum on kiirem ja laseb meil tagastust oodata.",
        "Seadusjärgne 14-päevane tagasimakse tähtaeg hakkab kulgema päevast, mil sa meile teatad; kui pakk on sinu ainus sõnum, algab tagasimakse tähtaeg siis, kui pakk või sinu postitõend meieni jõuab.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "withdrawal-form",
      heading: "Taganemisavalduse tüüpvorm",
      covers: ["model-withdrawal-form"],
      body: [
        "Taganemisavalduse tüüpvorm (kasuta ainult soovi korral):",
        "Kellele: {merchantLegalName}, {merchantRegisteredAddress}, {merchantContactAddress}: käesolevaga teatan, et taganen müügilepingust, mille esemeks on järgmine kaup: …",
        "Tellimuse esitamise kuupäev / kättesaamise kuupäev: …",
        "Tarbija nimi ja aadress: …",
        "Allkiri (ainult juhul, kui vorm esitatakse paberil), kuupäev.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "returns-process",
      heading: "Tagasisaatmine ja raha tagasisaamine",
      covers: ["return-postage-liability", "return-address"],
      body: [
        "Saada kaup tagasi 14 päeva jooksul pärast seda, kui teatasid meile taganemisest. Tagastusaadress on {returnAddress}.",
        "Paki tagastamise kulu kannad sina. Palun kasuta jälgitavat teenust ja hoia alles postitõend – kui sa selle meile esitad, kuulub tagasimakse tasumisele isegi siis, kui pakk on alles teel – ning vali odavaim jälgimisega teenus; rohkemat me ei küsi.",
        "Tagastame kauba eest makstu koos standardse väljasaatmise tasuga 14 päeva jooksul pärast seda, kui saime teada sinu taganemisest. Kui valisid meie standardsest kiirema või kallima tarneviisi, tagastame standardkulu, mitte lisatasu. Võime tagasimakset kinni hoida, kuni kaup meieni jõuab või kuni sa esitad postitõendi – olenevalt sellest, kumb juhtub varem.",
        "Tagasimakse läheb tagasi sama makseviisiga, millega sa maksid, ja see ei maksa sulle midagi.",
        "Sa võid mängu lahti pakkida ja seda vaadata – sama teeksid poes. Kui komponendid tulevad tagasi kahjustatuna või mittetäielikuna sellise käsitsemise tõttu, mis läheb kaugemale mänguga tutvumisest, võime tagasimakset väärtuse vähenemise võrra vähendada.",
        "Miski siin ei mõjuta sinu eraldi seadusest tulenevaid õigusi, kui kaup saabub puudusega, kahjustatuna või kirjeldusele mittevastavana. Kui kaart on puudu või karp saabus muljutuna, kirjuta aadressil {merchantContactAddress} ja me teeme asja korda; ära kasuta selleks taganemismenetlust.",
      ],
      source: "return-postage",
    },
    {
      anchor: "legal-guarantee",
      heading: "Sinu seadusjärgne õigus, mis on kõigest sellest eraldi",
      covers: ["legal-guarantee-of-conformity"],
      body: [
        "Sõltumata 14-päevasest õigusest ümber mõelda annab Euroopa Liidu õigus sulle seadusjärgse tagatise, et kaup vastab lepingutingimustele: sul on õigus esitada pretensioon kahe aasta jooksul alates kauba üleandmisest iga puuduse kohta, mis oli olemas kauba üleandmisel, ja esimese aasta jooksul eeldatakse, et puudus oli olemas juba üleandmisel, kui me ei tõenda vastupidist. Kui midagi on valesti, teata meile kahe kuu jooksul pärast puuduse märkamist ja me parandame kauba, asendame selle, alandame hinda või tagastame raha, sinu jaoks tasuta.",
      ],
    },
  ],
};
