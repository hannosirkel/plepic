# French translation conventions

French is a rulebook language, not a site edition: only the rulebook text (`rulebook/text/fr/`) is written in it, and `content/glossary/fr.ts` holds it to the agreed terms.

## Address and register

Use **vous** throughout, with the imperative in instructions: “Piochez 1 carte”. Headings that name an action stand in the infinitive: “Piocher (Draw)”, “Construire (Build)”. Describe a player in the masculine generic, “le joueur”, “chaque joueur”, as French rulebooks do; do not change a named character's pronoun (Kim is “il”). Keep the sentence short: French runs about a fifth longer than English and the build shrinks type only to 90%.

## Typography and numbers

- Quotation marks are guillemets: “« À la pose de cette carte »”.
- **A no-break space (U+00A0) stands before `:` `;` `!` `?` and on the inside of « and »**, and nowhere else. U+00A0 is used and not the narrow U+202F, because every font the rulebook is set in has it. A file that mixes the two fails review.
- The apostrophe is ’ (U+2019), never '.
- Keep every digit of the English frame, in the same order, including list numbers and page numbers. Say “plus de 1 carte” where English says “more than 1 card”, so the digit survives. Page ranges use an en dash: “pages 33–38”.
- Headings and captions printed in capitals carry the accents: “DÉFAUSSE”, “LIVRET DE RÈGLES”.

## Game terms in running text

Follow `content/glossary/fr.ts`. At the first use on each rulebook sheet, name the printed English word in round brackets after the French term: “étalage (Supply)”, “action principale (Main Action)”, “orbe (Orb)”. Inside a bracket use square ones: “(… les moitiés d’orbe [Orb] …)”. Later uses on the sheet have the French alone. No bracket is needed where the French word is spelled as the card prints it, which holds for **Station, Agent, Module, Base and Influence**. Write those with a capital when they name the card type or the player's built area: “carte Station”, “cartes Agent”, “votre Base”, “les Influences”.

Card names and Station names stay as printed, with no quotation marks and no article swallowing them: “Double Agent”, “Experimental Borehole”, “la Station Terran Outpost”, “The Oasis possède…”. A card title is not inflected; put a noun before it: “la carte Inflatable Habitat”, “2 cartes Rover”.

| English | French | Note |
| --- | --- | --- |
| Supply | étalage | The face-up display between the players. Not “réserve”, which suggests a hidden stock |
| deck | pioche | “La pioche” |
| discard pile | défausse | |
| Draw / Draft / Discard | piocher / sélectionner / défausser | Draft takes from the étalage, Draw from the pioche |
| Resell / Build / Flip | revendre / construire / retourner | |
| Orb | orbe | Masculine |
| Shuttle | navette | |
| Credit | crédit | Printed word named in brackets at first use on a sheet |
| Credit Counter | compteur de crédits | |
| colonist | colon | |
| scientific achievement | réalisation scientifique | |
| Main Action | action principale | |
| victory condition | condition de victoire | |
| rulebook | livret de règles | |

Two French collisions are known and accepted. “Pioche” is both the noun for the deck and the verb form “il pioche”, and “défausse” and “défausser” share a stem, so the glossary check cannot tell them apart; the reviewer reads for the right one. Table words that no card prints (main, pioche, défausse) take no bracket.

## Rulebook examples

The English sentences are from `rulebook/text/en.ts`; a bracket marks first use on the sheet.

1. `s06.f03` — “Each player draws 3 cards from the top of the deck into their hand. These are kept secret from the other players.”
   “Chaque joueur pioche (Draw) 3 cartes de la pioche et les prend en main. Elles restent secrètes pour les autres joueurs.”
2. `s06.f04` — “Deal 3 cards plus 1 additional card per player from the deck. Place these face-up between the players to form the Supply.”
   “Distribuez 3 cartes de la pioche, plus 1 carte supplémentaire par joueur. Posez-les face visible entre les joueurs pour former l’étalage (Supply).”
3. `s06.f05` — “Give each player a Credit Counter, set to 3 Credits. Use the Credit Counter to track your total Credits.”
   “Donnez à chaque joueur un compteur de crédits réglé sur 3 crédits (Credits). Servez-vous du compteur pour suivre votre total de crédits.”
4. `s07.f10` — “Colonists and scientific achievements appear on Station and Module cards. Credits are gained by various means. Influences are a special card type for advanced players.”
   “Les colons et les réalisations scientifiques figurent sur les cartes Station et Module. Les crédits s’obtiennent de diverses façons. Les Influences sont un type de carte spécial, pour joueurs avancés.”
