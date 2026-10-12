/**
 * Estonian game and shop vocabulary. Card faces remain in English.
 *
 * The five Estonian legal pages were approved before this glossary, so the
 * shop terms are theirs: ostukorv, tellimuse vormistamine, taganemine. A stem
 * stops where consonant gradation changes the word (agent, agendi).
 */
import type { Glossary } from "./schema.js";

export const estonianGlossary = {
  station: { term: "jaam", forms: ["jaam*", "Jaam*"], forbidden: ["kosmosejaam*", "Kosmosejaam*"], note: "The Station card type; jaamakaart where the card is meant. One word throughout, not the longer kosmosejaam." },
  agent: { term: "agent", forms: ["agent*", "agendi*", "Agent*", "Agendi*"], forbidden: ["spioon*", "Spioon*"], note: "The nominative is spelled as the card prints it and needs no bracket. Every other form does: the genitive stem is agendi." },
  influence: { term: "mõju", forms: ["mõju*", "Mõju*"], forbidden: ["mõjuvõim*", "Mõjuvõim*"], note: "Mõjukaart names the printed Influence card type. The stem also admits the verb mõjutama, which the reviewer reads for." },
  module: { term: "moodul", forms: ["moodul*", "Moodul*"], forbidden: [], note: "The Estonian spelling has two o's and no final e, so the first use takes the bracket (Module)." },
  credit: { term: "krediit", forms: ["krediit*", "krediidi*", "Krediit*", "Krediidi*"], forbidden: [], note: "The currency of the game, as in translated science fiction; not a loan. The genitive stem is krediidi." },
  creditCounter: { term: "krediidiloendur", forms: ["krediidiloendur*", "Krediidiloendur*"], forbidden: ["krediidilugeja*", "Krediidilugeja*"], note: "The physical dial that tracks krediidid; it is distinct from the currency." },
  supply: { term: "varu", forms: ["varu", "varus", "varust", "varusse", "varule", "varul", "varult", "varuga", "varuks", "Varu", "Varus", "Varust", "Varusse"], forbidden: ["tagavara*", "Tagavara*"], note: "The face-up cards between the players, which the Shuttles restock. Listed case by case, because the stem would also admit varustama and varuosa." },
  base: { term: "baas", forms: ["baas*", "Baas*", "*baas", "*baasi"], forbidden: [], note: "The player's built area, Station and Modules. The compound kuubaas describes the setting; the product name stays Lunar Base." },
  orb: { term: "kera", forms: ["kera*", "Kera*"], forbidden: ["sfäär*", "Sfäär*"], note: "The printed word cannot be borrowed: orb is the Estonian for an orphan. Kera is the plain word for the round symbol; a half is a kerapool." },
  shuttle: { term: "süstik", forms: ["süstik*", "Süstik*"], forbidden: ["kosmosesüstik*", "Kosmosesüstik*"], note: "The usual Estonian word for a space shuttle. One word throughout, not the longer kosmosesüstik." },
  colonist: { term: "kolonist", forms: ["kolonist*", "Kolonist*"], forbidden: ["asunik*", "Asunik*"], note: "Asunik is the settler of other games; the colonists of the Moon are kolonistid." },
  scientificAchievement: { term: "teadussaavutus", forms: ["teadussaavutus*", "Teadussaavutus*"], forbidden: ["teaduslik saavutus*", "teadusliku saavutus*", "teaduslikud saavutus*", "teaduslikke saavutus*", "Teaduslik saavutus*", "Teaduslikud saavutus*"], note: "This is the victory-condition icon and keeps the one compound throughout." },
  mainAction: { term: "põhitegevus", forms: ["põhitegevus*", "Põhitegevus*"], forbidden: ["peategevus*", "Peategevus*", "põhiaktsioon*", "Põhiaktsioon*"], note: "Tegevus is what Estonian rules call a choice on a turn; käik is the turn itself." },
  draft: { term: "valimine", forms: ["vali*", "Vali*"], forbidden: [], note: "The Draft action takes a card from the varu into the hand: vali, valib, valitud. Not võtmine, which the rules use for taking in general." },
  draw: { term: "tõmbamine", forms: ["tõmba*", "tõmma*", "Tõmba*", "Tõmma*"], forbidden: ["joonista*", "Joonista*"], note: "Draw takes the top card of the kaardipakk: tõmba, tõmbab, tõmmata. Joonistama is the other sense of the English word." },
  discard: { term: "äraviskamine", forms: ["viska*", "Viska*", "visa*", "äraviska*", "Äraviska*", "äravisa*", "Äravisa*"], forbidden: [], note: "Ära viskama moves a card to the äravisatud kaartide pakk: viska ära, viskab ära, visata, äravisatud." },
  resell: { term: "edasimüümine", forms: ["müü*", "Müü*", "edasimüü*", "Edasimüü*"], forbidden: [], note: "The action moves a card from the varu to the discard pile for a krediit: müü edasi, müüb edasi, edasi müüdud." },
  build: { term: "ehitamine", forms: ["ehit*", "Ehit*"], forbidden: [], note: "The card action builds a Module onto the baas: ehita, ehitab, ehitatud." },
  flip: { term: "ümberpööramine", forms: ["pööra*", "Pööra*", "ümberpööra*", "Ümberpööra*"], forbidden: [], note: "Flip changes which face of a Station shows: pööra ümber, pöörab ümber, ümber pööratud. Keerama is left for the dial of the krediidiloendur." },
  deck: { term: "kaardipakk", forms: ["kaardipak*", "Kaardipak*"], forbidden: ["deck", "Deck", "dekk*", "Dekk*", "tõmbepak*", "Tõmbepak*"], note: "Always the full compound: pakk alone is the parcel of the legal pages (kuhu pakk saata)." },
  hand: { term: "käsi", forms: ["käsi", "käe*", "kät*", "Käsi", "Käe*", "Kät*"], forbidden: [], note: "Running text may say käes, kätte or käest, or käekaardid for the cards themselves." },
  discardPile: { term: "äravisatud kaartide pakk", forms: ["äravisatud kaartide pak*", "Äravisatud kaartide pak*"], forbidden: ["heitepak*", "Heitepak*", "mahapandud kaartide pak*"], note: "Named by the verb of the Discard action, so a reader matches the two. Estonian rules have no settled single word for it." },
  victoryCondition: { term: "võidutingimus", forms: ["võidutingimus*", "Võidutingimus*"], forbidden: ["võitmistingimus*", "Võitmistingimus*"], note: "The compound Estonian rules use for a way to win." },
  terranOutpost: { term: "Terran Outpost", forms: ["Terran Outpost"], forbidden: [] },
  theOasis: { term: "The Oasis", forms: ["The Oasis"], forbidden: [] },
  taikotech: { term: "Taikotech", forms: ["Taikotech"], forbidden: [] },
  darkSide: { term: "Dark Side", forms: ["Dark Side"], forbidden: [] },
  shackleton: { term: "Shackleton", forms: ["Shackleton"], forbidden: [] },
  seleneLabs: { term: "Selene Labs", forms: ["Selene Labs"], forbidden: [] },
  imbrium: { term: "Imbrium", forms: ["Imbrium"], forbidden: [] },
  lunarBase: { term: "Lunar Base", forms: ["Lunar Base"], forbidden: [] },
  plepicGames: { term: "Plepic Games", forms: ["Plepic Games"], forbidden: [] },
  rulebook: { term: "reegliraamat", forms: ["reegliraamat*", "Reegliraamat*"], forbidden: ["mängujuhend*", "Mängujuhend*", "reeglivihik*", "Reeglivihik*"], note: "The booklet and its PDF. The legal pages say reeglite lugemine of reading the rules, which is the activity and not the booklet." },
  basket: { term: "ostukorv", forms: ["ostukorv*", "Ostukorv*"], forbidden: ["ostukäru*", "Ostukäru*"], note: "The word of the legal pages (sinu ostukorvi tunnus)." },
  checkout: { term: "tellimuse vormistamine", forms: ["tellimuse vormistami*", "Tellimuse vormistami*", "vormista tellimus", "Vormista tellimus"], forbidden: ["Checkout", "kassa", "Kassa", "kassas", "kassasse", "Kassasse"], note: "The legal pages say tellimuse vormistamisel and tellimuse vormistamise leht throughout, so the shop does too. A button may say Vormista tellimus." },
  parcelMachine: { term: "pakiautomaat", forms: ["pakiautomaa*", "Pakiautomaa*"], forbidden: ["pakikap*", "Pakikap*", "postiautomaa*", "Postiautomaa*"], note: "The generic word; the genitive is pakiautomaadi. The legal shipping page names the delivery method by its English label and stands as an exception." },
  withdrawal: { term: "taganemine", forms: ["taganemi*", "Taganemi*"], forbidden: [], note: "The consumer-law term of the legal pages: taganemisõigus, taganemistähtaeg, taganemisavaldus. Tagastamine is the return of the goods, a different thing." },
} as const satisfies Glossary;
