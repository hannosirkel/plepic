# English that is not live text

A translated edition replaces the rulebook's live text. Anything English that
is part of a picture stays unless it is patched. This file lists every such
piece, sheet by sheet, and decides each one.

Pictures of the printed cards, face or back, are not listed. The cards are
English, so their pictures stay as they are.

The list was made by rendering all 25 sheets with the live text removed
(`gs -dFILTERTEXT`) and reading what was left.

**Result: nothing needs a patch for its words.** Four sheets carry English in
pictures, and all of it stays. No diagram label on any sheet is a picture:
every one is live text and has a frame.

| Sheet | English that is not live text | Decision |
| --- | --- | --- |
| 1 | The words "LUNAR BASE" in the cover logo | Stays. It is the product name, drawn as a logo. "RULE BOOK" below it is live text (`s01.f01`) |
| 2 | None. The crescent above the introduction has no words | |
| 3 | The words on the six Credit Counters: "CREDITS", "COLONISTS", "INFLUENCES IN HAND" and "DIFFERENT SCIENTIFIC ACHIEVEMENTS" | Stays. The picture shows a printed component, and players hold the English one, as with the cards. The four counts under the pictures are live text |
| 4 | None. Every callout around the three cards is live text | |
| 5 | The Credit Counters in the table diagram, too small to read | Stays, as on sheet 3. The labels DISCARD and DECK are live text |
| 6 | The Credit Counters in the table diagram, too small to read | Stays, as on sheet 3. The labels DISCARD, DECK and SUPPLY are live text |
| 7 | None. The victory and achievement icons have no words | |
| 8 | None | |
| 9 | None. The caption under the two cards is live text | |
| 10 | None. "New Cards" and the six PLAYER labels are live text | |
| 11 | None | |
| 12 | None. PLAYER'S BASE and PLAYER'S HAND are live text | |
| 13 | None. The action icons have no words | |
| 14 | None. CORRECT and INCORRECT are live text | |
| 15 | None. The action icons have no words | |
| 16 | None. The five diagram labels are live text | |
| 17 | None. The five diagram labels are live text | |
| 18 | None. Both captions are live text | |
| 19 | The word "INFLUENCE" on the tab at the top right | Stays. It is the type tab printed on every Influence card, used here as the section's emblem. It must match the cards, like the card on sheet 20 |
| 20 | None | |
| 21 | None. The five diagram labels are live text | |
| 22 | None | |
| 23 | None | |
| 24 | None. Both headings and all names are live text | |
| 25 | "lunarbasegame.com", "facebook.com/lunarbasegame", "instagram.com/lunarbasegame" and "@LunarBaseGame" | Stays. They are addresses and handles, not words. The QR code and the logo are pictures too |

## Artwork placed for the English text

These pictures hold no words, but each was drawn to fit the English text. A
translated edition has to deal with them.

| Sheet | Artwork | Decision |
| --- | --- | --- |
| 9 | Three filled circles inside the third line of the first paragraph. The letters A, B and C on them are the frames `s09.f11a` to `s09.f11c` | Patch. A translated line breaks elsewhere, so the circles cannot stay where they are. The paragraph's text anchors each letter (`{s09.f11a}`). The build removes the three circles from this sheet's underlay and draws each one with its letter at the anchor |
| 16 | Two outlined circles, inside steps 1 and 4. The letter A in each is `s16.f13` and `s16.f14` | Patch, in the same way |
| 4 | A white pill behind each callout around the three cards | Stays. A translated callout must fit its pill, or be shortened |
| 4 to 6, 8, 9, 11 to 14, 16, 17, 20, 21 | A circle under every step numeral and diagram marker | Stays. The numerals are frames of their own and do not move |
