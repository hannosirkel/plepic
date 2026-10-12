/**
 * De' QanmeH mIw — the Klingon edition of `../privacy.ts`.
 *
 * A translation, not a revision. Everything the second qualified read and the
 * operator decided about the English page binds this one:
 *
 * - Meta is described as it is: a joint controller for the collection and
 *   transmission (`De' SeHwI' maH … nItebHa' mangoy'`, "we are controllers of
 *   the data … we are responsible together"), never as one processor among
 *   many. The section heading says `vu'`, "manage", for "handles".
 * - Purpose **and** legal basis per operation; third-country transfers and
 *   their safeguard — the EU–US Data Privacy Framework under its own name,
 *   with `mab 'ay'mey motlh`, "standard parts of a contract", where it does
 *   not cover a transfer.
 * - The cookie table is the operator's own content of 2026-08-10: durations
 *   hedged (`'aqroS: …`, "maximum: …", and `pIm`, "they differ"), consent
 *   status stated in the two sentences beneath. The two non-cookie browser
 *   stores are prose above the table, one sentence each, in the same order as
 *   the English page.
 * - Single opt-in for the newsletter is a recorded, accepted operator
 *   deviation and is not "fixed" here.
 *
 * The stored consent answer is the literal word `granted` or `declined`, so
 * the sentence names those two words and glosses each in Klingon, as the
 * German and Estonian pages do. `local storage` and `session storage` stand in
 * brackets after their Klingon descriptions, because those are the names a
 * browser shows. `DNS` and `IP` are loans, each explained where it stands.
 * All six are on the loan list of `scripts/klingon-words.ts`.
 *
 * Company names, cookie names, route, anchors, `covers`, the table's shape and
 * every placeholder token are identical to the English page.
 *
 * Staged: the file is not registered in `../index.ts`, so no visitor reaches
 * it yet. The mirror test, the content scans and the Klingon word check read
 * it from disk.
 *
 * `reviewStatus` is `operator-approved`: the operator approved every
 * translation of the site-translation job in advance on 2026-10-10, legal
 * pages included. The field records that advance approval. No separate reading
 * of this Klingon wording is recorded here, and the approval is not a standing
 * one for whatever this page may later say: a change to its substance needs
 * its own reading.
 *
 * The coined terms are written out in `content/glossary/tlh.ts`
 * (`klingonLegalTerms`). Three carry the page: `ghIb`, "consent", with
 * `ghIbHa'`, "undo consenting", for withdrawing it; `juvmeH mIw`, "the
 * procedure for measuring", for analytics; and `De' chabHom`, "data cookie",
 * a calque on the attested word for the biscuit. Klingon has no noun for
 * "consent", so a sentence that rests on the noun says "because you consent"
 * or "only if you consent".
 *
 * `chut meqmey`, "reasons of law", is the regulation's "legal bases". The
 * glossary reads the English "bases" as the game term Base, `waw'`; when this
 * edition is registered, `content/glossary/index.ts` needs the exception the
 * German and Estonian pages already have, for the same reason.
 */

import type { LegalPage } from "../../schema.js";

export const privacy: LegalPage = {
  route: "legalPrivacy",
  title: "De' QanmeH mIw",
  description:
    "De' wIboSbogh, boSmeH meq, chut meq, De' vu'bogh malja'mey, De' wIngeHmeH Daqmey, juvmeH mIw DalajQo'meH pagh bIghIbHa'meH mIw je.",
  indexable: true,
  sections: ["consent", "processors", "contact"],
  covers: [
    "analytics-lawful-basis",
    "third-party-processors",
    "third-country-transfers",
    "processing-lawful-bases",
  ],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "consent",
      heading: "bIghIbchugh neH juvlu'",
      covers: ["analytics-lawful-basis"],
      body: [
        "wa'DIch bIpawDI' pIghel: SIr'o' Daqvam lo'meH mIw wIjuvlaH'a'? bIjangpa' Qapbe' Dujuvbogh Hoch jan. bIlajQo'meH wa' leQ neH yI'uy; SIr'o' Daq laHmey Hoch Dalo'laHtaH.",
        "bIghIbmo' neH mub juvmeH mIw, vep juvmeH jan je; latlh chut meq tu'lu'be'. reH bIghIbHa'laH: tenwal bertlhamDaq rarwI' yIlo'; ghIq bIwIvqa'laH. bIghIbHa'DI' mev juvmeH mIw. 'ach De' boSlu'pu'bogh Qaw'be'.",
        "SIr'o' Daq latlh mIwmeyvaD — Quj Daje'meH, QIn jungeHmeH, Quj chutmey DalaDmeH — bIghIbnISbe'; bIlajchugh pagh bIlajQo'chugh, rap mIwmeyvam.",
        "juvmeH mIw DalajDI' pagh DalajQo'DI', mu'lIj pol SIr'o' Daqvam; SIr'o' leghmeH janlIj polmeH Daq (local storage) lo', 'ej De' chabHom lo'be'. SIr'o' leghmeH jan De' DaQaw'pa', pagh mu'lIj DachoHpa', pollu'. wa' mu' neH qon: granted (chaw'lu'), declined (lajlu'Qo') ghap.",
        "je'meH ngaSwI'lIj ngu'bogh ngoq pol SIr'o' Daqvam; SIr'o' leghmeH janlIj polmeH Daq ru' (session storage) lo', 'ej De' chabHom lo'be'. tenwal DaSoQmoHpa' neH pollu'. Doch De', Doch mI', QIn Daq, HIjmeH Daq je qonbe'.",
      ],
      table: {
        caption: "De' chabHommey lanlaHbogh SIr'o' Daqvam",
        columns: ["De' chabHom", "nobwI'", "ngoQ", "poH"],
        rows: [
          ["_ga, _ga_*", "Google Analytics", "juvmeH mIw; SIr'o' Daq lo'meH mIw juv", "'aqroS: 2 DIS"],
          ["_fbp", "Meta", "vep juvmeH mIw, juvmeH mIw je", "'aqroS: 3 jar"],
          [
            "Cloudflare Hung De' chabHommey",
            "Cloudflare",
            "Hung, SIr'o' Daq ghoSbogh De' vu'meH mIw, HIvbogh De' botmeH mIw je",
            "pIm",
          ],
          [
            "plepic_destination",
            "Plepic Games",
            "HIjmeH Sep DawIvbogh qaw; vaj SepvetlhvaD DIlmeH Huch Dalegh",
            "'aqroS: 1 DIS",
          ],
        ],
        notes: [
          "bIghIbchugh neH Google Analytics De' chabHommey, Meta De' chabHommey je lo'lu'. QapmeH SIr'o' Daq 'ej Hung ghajmeH, Cloudflare Hung De' chabHommey poQlu'bej; chabHommeyvamvaD bIghIbnISbe'.",
          "HIjmeH Sep DachoHDI' SoH neH, HIjmeH Sep De' chabHom lanlu'. Sep DawIvbogh ngoq neH ngaS; cha' ngutlh ghaj ngoqvam. De'lIj qonbe', 'ej juvmeH mIwvaD vepvaD ghap lo'lu'be'.",
        ],
      },
    },
    {
      anchor: "processors",
      heading: "De'lIj vu'bogh latlh malja'mey",
      covers: ["third-party-processors", "third-country-transfers"],
      body: [
        "SIr'o' Daqvam Dalo'taHvIS De' vu' malja'meyvam; Hoch bIH.",
        "SIr'o' Daqvam DNS (SIr'o' pong tetlh) vu' Cloudflare, SIr'o' Daq De' So' 'ej So'Ha', 'ej qaD nob: QIn ghItlhmeH Daq, De' chu' QIn qI'meH Daq je lo'Ha'laHbe'meH janmey, qaD nob. vaj Hoch tenwal DaleghDI', IP mI'lIj (SIr'o'Daq janlIj ngu'bogh mI') tenwal tlhobmeH De' je lo' Cloudflare. mIwvam DalajnIS: mIwvam lo'lu'be'chugh, SIr'o' Daq DaleghlaHbe'.",
        "Huch nobmeH mIw vu' Stripe. Huch DanobDI', Huch chaw' De' Hev Stripe neH; not De'vam wIHev maH. Huch nobmeH mIw ta pol Stripe.",
        "SIr'o' Daq lo'meH mIw juv Google Analytics; bIghIbpu'DI' neH juv, 'ej waHmeH SIr'o' DaqmajDaq not juv.",
        "bIghIbchugh, vep juvmeH De' ngeH SIr'o' Daqvam; De'vam Hev Meta. vepmaj Qapla' wIjuvmeH ngeHlu'. ngoQmeyDajvaD De' Hevbogh lo' Meta je, 'ej lo'meH mIwvetlhvaD ngoy' Meta. De'vam boSlu'DI' 'ej ngeHlu'DI', De' SeHwI' maH — maH Meta je — 'ej nItebHa' mangoy'. bIghIbpa' pagh ngeHlu'.",
        "De' chu' QInmey ngeH Brevo, 'ej De' chu' QInmeyvaD QIn Daq Danobbogh pol; De' chu' QInmey DaqI'Ha'pa' pol.",
        "vunmeH QInmey, jangmeH QInmey je ngeH QIn De'wI'maj. QInmeyvam Hevbe' QInmey law' ngeHbogh latlh malja'.",
        "United States malja'mey bIH malja'meyvam'e': Google, Meta, Stripe, Cloudflare. vaj malja'meyvam DIlo'mo', United States SepDaq 'op De' lo'lu'. EU–US Data Privacy Framework mabDaq jeS Hoch. De' lablu'bogh Qanbe'chugh mabvetlh, mab 'ay'mey motlh lo'lu'.",
        "De' wIngevbe'. tenwalvamDaq malja'mey ngu'lu'; vepchajvaD De'lIj lo' malja'meyvam net chaw'be'. vep juvmeH mIw neH chaw'lu', 'ej mIwvetlh DalajnISbe' (DungDaq yIlegh). SIr'o' DaqvamDaq latlh malja' tu'lu'be': Hoch malja' ngu' tenwalvam.",
      ],
    },
    {
      anchor: "contact",
      heading: "De'lIj, De'lIjmo' QIn jungeHmeH mIw je",
      covers: ["processing-lawful-bases"],
      body: [
        "chut meqmey: Doch Davunbogh wIngeHmeH QInmeylIj DIjangmeH je, mab wIpab; qaStaHvIS Soch DIS vunmeH QIn tamey DIpolmeH, Estonia Huch ta chut wIpab, 'ej poQ chutvam; SIr'o' Daq wIQapmoHmeH wIHubmeH je, ngoQmaj mub wIlo'; bIghIbmo' neH Qap juvmeH mIw, De' chu' QInmey je.",
        "bIvunDI', vunmeH QInvaD De' poQlu'bogh wIpol: ponglIj, HIjmeH DaqlIj, QIn DaqlIj, Doch Daje'bogh, Huch Danobbogh je. qaStaHvIS Soch DIS ta wIpol 'e' poQ Estonia Huch ta chut; bIvunDI' qaSbogh Huch DIS DorDI' tagh Soch DISvam. ghIq ta wIQaw'.",
        "QIn jungeHDI', QIn QIn DaqlIj je DIpol; vaj pIjanglaH, 'ej rapbogh vunmeH QInmo' QIn jungeHqa'chugh, QInmey ngo' DISamlaH. QIn Qav ngeHlu'DI' — QInlIj, QInmaj ghap — tagh cha' DIS poH; qaStaHvIS poHvam QInmey DIpol, ghIq DIQaw'.",
        "De' chu' QInmey DaqI'DI', QIn DaqlIj neH wIpol. qI'Ha'meH rarwI' ngaS Hoch QIn; rarwI'vam Dalo'DI', tetlhvo' pIteq.",
        "DIbmeyvam Daghaj: De'lIj wIpolbogh DaghellaH; De' wIlughmoH 'e' DatlhoblaH; De' wIQaw' 'e' DatlhoblaH; De' lo'meH mIw wIyevmoH 'e' DatlhoblaH; De' velqa' DatlhoblaH; De' wIlo'meH mIw DaqaDlaH. QIn ghongeH: {merchantContactAddress}. QInlIj laD nuv.",
        "maQaghchugh, SeplIjDaq De' Qanbogh qum DIvI'vaD bIbeplaH. Estonia SepDaq Andmekaitse Inspektsioon 'oH DIvI'vam'e'.",
        "De' SeHwI': {merchantLegalName}, {merchantRegisteredAddress}.",
      ],
    },
  ],
};
