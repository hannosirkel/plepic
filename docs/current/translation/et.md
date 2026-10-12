# Estonian translation conventions

## Address and register

Use **sina** everywhere: marketing copy, the rulebook, the basket and the order form. Write it in lower case („sa“, „sinu“), and give instructions in the singular imperative: „tõmba 1 kaart“. The five approved legal pages already address the reader as „sa“, so Estonian has no second register to keep apart, unlike German. Estonian has no grammatical gender: a player is „mängija“ and is referred to as „ta“.

## Typography, numbers and dates

Use Estonian quotation marks („…“). Use an en dash with a space on each side ( – ) where a sentence breaks, as the legal pages do. Write the decimal comma (1,5) and separate thousands with a non-breaking space (10 000).

Never write a price or a currency in a content string. The site formats every amount with the `et-EE` format, which puts the comma and the currency sign where Estonian has them.

Write a date out in a content string: „28. veebruar 2021“, with the month in lower case. Do not write it in digits. The content scan reads two digits after a full stop or a comma as a money amount and fails the string.

Keep rulebook quantities as digits where the English rulebook has digits. A noun after a numeral above one stands in the partitive singular: „1 kaart“, „3 kaarti“.

## Terms the legal pages set

The legal pages were approved before the glossary, and the glossary follows them. Do not edit `content/legal/et/`.

| English | Estonian, as the legal pages have it |
| --- | --- |
| basket | ostukorv |
| checkout | tellimuse vormistamine („tellimuse vormistamisel“, „tellimuse vormistamise leht“) |
| withdrawal | taganemine („taganemisõigus“, „taganemistähtaeg“, „taganemisavalduse tüüpvorm“) |
| return of the goods | tagastamine |
| terms of sale | müügitingimused |
| refund | tagasimakse |
| shipping charge | saatekulu |
| delivery address | tarneaadress |
| parcel | pakk |

Three strings of those pages stand as written and are named in `glossaryExceptions`:

- The imprint page declines the publisher's name as „Plepic Gamesi“.
- The shipping page quotes the two delivery methods by their English labels, “Standard delivery” and “Omniva parcel machine”. New copy says „pakiautomaat“.
- The privacy page's „õiguslikud alused“ are the legal bases of data protection law and no player's Base.

Because „pakk“ is the parcel, the deck is always „kaardipakk“ in full.

## Game terms in running text

Follow `content/glossary/et.ts`. Write a game term in lower case, as Estonian writes any common noun: „jaam“, „moodul“, „põhitegevus“. A capital would read as a name.

Add the English card label in round brackets at the first use on each page or rulebook sheet: „varu (Supply)“, „põhitegevus (Main Action)“, „kera (Orb)“. The label keeps the capital the card prints. Later uses on that page or sheet have the Estonian term alone. The bracket is left out only where the Estonian word stands exactly as the card prints it, which is the nominative „agent“ and nothing else. Any other form takes the bracket: „agendikaardid (Agent)“, „moodulid (Modules)“.

Name an action with its noun in a heading and inflect the verb in an instruction: „Tõmbamine (Draw)“, then „tõmba 1 kaart“. Three actions are verbs with a particle, and the particle belongs to the term: „viska ära“, „müü edasi“, „pööra ümber“. The check finds the verb. The reviewer reads for the particle.

Keep a card title, a Station name, the product name and the publisher's name in English, exactly as printed, with no quotation marks. The check wants the printed letters followed by something that is not a letter, so an Estonian case ending cannot join the name directly. There are two ways to write the case:

- Put a noun before the name and decline the noun: „mängus Lunar Base“, „kirjastuse Plepic Games mängud“, „jaama The Oasis teine pool“, „mängi välja kaart Solicitor“.
- Set the ending off with an apostrophe: „Lunar Base’i reeglid“, „Plepic Games’i mängud“. Estonian spelling requires the apostrophe after „Base“, whose last letter is silent, and permits it after any foreign name to keep the name's own form clear.

## Rulebook examples

The English sentences are from `rulebook/text/en.ts`. The Estonian lines show the glossary applied. A bracket marks the first use on the sheet. Examples 3 and 4 include the heading of their section, because the heading is where the sheet first uses the term.

1. `s06.f04` — “Deal 3 cards plus 1 additional card per player from the deck. Place these face-up between the players to form the Supply.”
   „Jaga kaardipakist 3 kaarti ja iga mängija kohta veel 1 kaart. Aseta need pildiga ülespoole mängijate vahele – neist saab varu (Supply).“
2. `s06.f05` — “Give each player a Credit Counter, set to 3 Credits. Use the Credit Counter to track your total Credits.”
   „Anna igale mängijale krediidiloendur, mis on seatud 3 krediidile (Credits). Krediidiloenduri abil pead arvet kõigi oma krediitide üle.“
3. `s11.f03`, `s11.f04` — “Orbs. You gain Orbs by building Modules to your Base and by Flipping your Station card.”
   „Kerad (Orbs). Kerasid saad, kui ehitad oma baasi (Base) mooduleid (Modules) ja kui pöörad ümber (Flip) oma jaamakaardi (Station).“
4. `s13.f18`, `s13.f17` — “Discard. Take 1 card from your hand and place it face-up on the discard pile. If you have no cards in hand, skip this action. If you are instructed to Discard more than 1 card, repeat this for each card.”
   „Äraviskamine (Discard). Võta käest 1 kaart ja aseta see pildiga ülespoole äravisatud kaartide pakile. Kui sul käes kaarte ei ole, jäta see tegevus vahele. Kui pead ära viskama rohkem kui 1 kaardi, korda seda iga kaardi puhul.“
5. `s08.f05` — “1. Optionally, play any number of Agent cards. 2. Perform one Main Action from those available in your Base. 3. Check for arriving Shuttles.”
   „1. Soovi korral mängi välja ükskõik kui palju agendikaarte (Agent). 2. Soorita üks põhitegevus (Main Action) nende seast, mida sinu baas (Base) pakub. 3. Kontrolli, kas süstikud (Shuttles) saabuvad.“
