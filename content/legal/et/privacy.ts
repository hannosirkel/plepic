/**
 * Privaatsusteade — the Estonian edition of `../privacy.ts`.
 *
 * A translation, not a revision. Everything the second qualified read and the
 * operator decided about the English page binds this one:
 *
 * - Meta is described as it is: a joint controller (kaasvastutav töötleja)
 *   for the collection and transmission, never as one processor among many.
 * - Purpose **and** legal basis per operation; third-country transfers and
 *   their safeguard — the ELi–USA andmekaitseraamistik, with standardsed
 *   andmekaitseklauslid where it does not cover a transfer.
 * - The cookie table is the operator's own content of 2026-08-10: durations
 *   hedged ("Kuni …", "Varieerub"), consent status stated in the two
 *   sentences beneath. The two non-cookie browser stores are prose above the
 *   table, one sentence each, in the same order as the English page.
 * - Single opt-in for the newsletter is a recorded, accepted operator
 *   deviation and is not "fixed" here.
 *
 * Company names, cookie names, anchors, `covers` and every placeholder
 * token are byte-identical to the English page. `reviewStatus` is
 * `operator-approved`, and it records **both** things. The page **as served**:
 * the operator supplied the merchant identity and the deployment manifests now
 * serve all seven `MERCHANT_*` values, so the tokens below resolve to the
 * registered identity rather than to visible gaps. And the **qualified
 * reader's acceptance of the Estonian text**, which the operator confirmed as
 * given on 2026-08-20 and recorded in the project's decision log, which lives
 * outside this repository; it is no longer an act recorded only outside this
 * repository, and earlier revisions of this comment saying otherwise were
 * describing a state that has since changed.
 *
 * It is not a standing approval of whatever this page may later say. A change
 * to its substance needs its own reading, exactly as the ones recorded above
 * did.
 */

import type { LegalPage } from "../../schema.js";

export const privacy: LegalPage = {
  route: "legalPrivacy",
  title: "Privaatsus",
  description:
    "Mida me kogume, miks, millisel õiguslikul alusel, kes seda töötleb, kuhu see liigub ning kuidas analüütikast keelduda või nõusolek tagasi võtta.",
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
      heading: "Mõõtmine toimub ainult siis, kui sa nõustud",
      covers: ["analytics-lawful-basis"],
      body: [
        "Esimesel saabumisel küsitakse sinult, kas tohime mõõta, kuidas saiti kasutatakse. Enne sinu vastust ei käivitu miski, mis sind mõõdab, ja keeldumine on üksainus klõps, mis ei jäta sind ilma ühestki võimalusest.",
        "Analüütika ja reklaamimõõtmise piksli õiguslik alus on sinu nõusolek ja mitte miski muu. Sa võid selle igal ajal tagasi võtta jaluses oleva lingi kaudu, mis avab sama valiku uuesti. Tagasivõtmine peatab edasise mõõtmise; juba kogutut see tagasiulatuvalt ei kustuta.",
        "Saidi osad, mis ei ole mõõtmine – mängu ostmine, meiega ühenduse võtmine, reeglite lugemine – nõusolekut ei vaja ja sinu vastus neid ei mõjuta.",
        "Sinu vastuse mõõtmisküsimusele salvestab see sait sinu brauseri kohalikku salvestusse (local storage), mitte küpsisena. Seda hoitakse, kuni sa oma brauseri andmed kustutad või vastust muudad, ja see ei salvesta muud kui sõna granted (nõustun) või declined (keeldun).",
        "Sinu ostukorvi läbipaistmatu tunnus salvestatakse selle saidi poolt sinu brauseri seansisalvestusse (session storage), mitte küpsisena. Seda hoitakse ainult vahelehe sulgemiseni ning see ei salvesta toodete üksikasju, koguseid, e-posti aadressi ega tarneaadressi.",
      ],
      table: {
        caption: "Küpsised, mida see sait võib salvestada",
        columns: ["Küpsis", "Teenusepakkuja", "Otstarve", "Kestus"],
        rows: [
          ["_ga, _ga_*", "Google Analytics", "Analüütika ja saidi kasutuse mõõtmine", "Kuni 2 aastat"],
          ["_fbp", "Meta", "Reklaamimõõtmine ja analüütika", "Kuni 3 kuud"],
          [
            "Cloudflare'i turvaküpsised",
            "Cloudflare",
            "Turvalisus, liikluse haldus ja kaitse pahatahtliku liikluse eest",
            "Varieerub",
          ],
          [
            "plepic_destination",
            "Plepic Games",
            "Jätab meelde sihtkoha, mille kohta sa palusid hinda näidata, et näidatav summa oleks selle riigi oma",
            "Kuni 1 aasta",
          ],
        ],
        notes: [
          "Google Analyticsi ja Meta küpsiseid kasutatakse ainult sinu nõusolekul. Cloudflare'i turvaküpsised on saidi toimimiseks ja turvalisuseks rangelt vajalikud ega vaja nõusolekut.",
          "Sihtkoha küpsis salvestatakse ainult siis, kui sa ise sihtkohta muudad, ja see ei sisalda muud kui sinu valitud riigi kahetähelist koodi. See ei salvesta sinu kohta midagi ega ole kasutusel mõõtmiseks või reklaamiks.",
        ],
      },
    },
    {
      anchor: "processors",
      heading: "Kes veel sinu andmeid töötleb",
      covers: ["third-party-processors", "third-country-transfers"],
      body: [
        "Need on ettevõtted, kes töötlevad andmeid, kui sa seda saiti kasutad, ja see loetelu on täielik.",
        "Cloudflare osutab selle saidi nimelahenduse teenust (DNS), lõpetab saidi krüpteeritud ühendused ja pakub turvakontrolli, mis kaitseb kontakti- ja uudiskirjavorme automatiseeritud kuritarvituse eest. Seetõttu töötleb ta sinu IP-aadressi ja päringu metaandmeid iga lehe laadimisel. See ei ole valikuline: nii jõuab sait üldse sinuni.",
        "Stripe töötleb makseid. Kui sa maksad, lähevad sinu kaardiandmed otse Stripe'ile ja meie ei saa neid kunagi. Maksekirje jääb Stripe'i kätte.",
        "Google Analytics mõõdab saidi kasutust, ainult pärast sinu nõusolekut ja mitte kunagi meie testkeskkonnas.",
        "Kui sa annad nõusoleku, saadab see sait Metale reklaamimõõtmise signaali, et näeksime, kas meie reklaam töötab. Meta kasutab saadut ka oma eesmärkidel, omal vastutusel; nende andmete kogumise ja saatmise osas oleme meie ja Meta kaasvastutavad töötlejad. Enne sinu nõusolekut ei saadeta midagi.",
        "Brevo toimetab kohale uudiskirja ja hoiab aadressi, mille sa selleks meile andsid, kuni sa uudiskirjast loobud.",
        "Tellimuste ja kontaktivormi kirjad saadetakse meie oma meiliserveri kaudu. Neid ei anta üle hulgikirjade teenusepakkujale.",
        "Google, Meta, Stripe ja Cloudflare on USA ettevõtted ning nende kasutamine tähendab, et osa andmeid töödeldakse Ameerika Ühendriikides. Igaüks neist osaleb ELi–USA andmekaitseraamistikus, ja kus see mõnda edastamist ei kata, kohaldatakse standardseid andmekaitseklausleid.",
        "Me ei müü andmeid. Peale reklaamimõõtmise, millest sa saad ülalpool keelduda, ei tohi ükski siin nimetatud ettevõte kasutada sinu andmeid oma reklaamiks, ja sellel saidil ei ole ühtegi kolmandat isikut, keda ei oleks ülal nimetatud.",
      ],
    },
    {
      anchor: "contact",
      heading: "Sinu andmed ja kuidas meid nende asjus kätte saada",
      covers: ["processing-lawful-bases"],
      body: [
        "Õiguslikud alused: sinu tellimuse täitmine ja sinu kirjadele vastamine on lepingu täitmine; tellimuse dokumentide seitsmeaastane säilitamine on Eesti raamatupidamisõigusest tulenev juriidiline kohustus; saidi pakkumine ja kaitsmine on meie õigustatud huvi; mõõtmine ja uudiskiri toimivad ainult sinu nõusolekul.",
        "Kui sa tellid, hoiame seda, mida tellimus vajab: sinu nime, tarneaadressi, e-posti aadressi, mida sa ostsid ja mida maksid. Eesti raamatupidamisõigus nõuab, et säilitaksime kirje seitse aastat alates selle majandusaasta lõpust, millesse tellimus jääb, ja pärast seda me selle kustutame.",
        "Kui sa meile kirjutad, hoiame kirja ja sinu aadressi, et saaksime vastata ja et leiaksime vestluse uuesti üles, kui sa sama tellimuse asjus tagasi tuled. Hoiame seda kaks aastat pärast vestluse viimast kirja ja siis kustutame.",
        "Kui sa tellid uudiskirja, hoiame sinu e-posti aadressi ja mitte midagi muud. Igas kirjas on loobumislink ja selle kasutamine eemaldab su nimekirjast.",
        "Sul on õigus küsida, mida me sinu kohta hoiame, lasta seda parandada, lasta see kustutada, paluda meil selle kasutamine peatada, saada sellest koopia või esitada kasutamise suhtes vastuväide. Kirjuta aadressil {merchantContactAddress} ja sinu kirja loeb inimene.",
        "Kui me eksime, võid esitada kaebuse oma riigi andmekaitseasutusele. Eestis on selleks Andmekaitse Inspektsioon.",
        "Vastutav töötleja on {merchantLegalName}, {merchantRegisteredAddress}.",
      ],
    },
  ],
};
