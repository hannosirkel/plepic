/**
 * The glossary: the term list, the model, and what each language has registered.
 *
 * `content/index.ts` does not export this directory. The glossary is a tool
 * for translators and for `glossary.test.ts`; its forbidden variants are words
 * the site must not show, and they have no place in a bundle.
 */

import type { GlossaryException, GlossaryRegistry } from "./schema.js";
import { germanGlossary } from "./de.js";
import { estonianGlossary } from "./et.js";

export * from "./terms.js";
export * from "./schema.js";

/**
 * A language registers here in its first task, with a sibling `<locale>.ts`
 * that holds its `Glossary`. From then on `glossary.test.ts` checks every
 * translated string of that locale.
 */
export const glossaries: GlossaryRegistry = { de: germanGlossary, et: estonianGlossary };

/**
 * The strings the check would fail and that stand as written. An entry that
 * no longer suppresses a failure fails the test, so the list cannot rot.
 */
export const glossaryExceptions: readonly GlossaryException[] = [
  {
    locale: "de",
    key: "legal.legalPrivacy.body[2].body[0]",
    term: "base",
    rule: "missing-term",
    reason:
      'The English "legal bases" is the plural of "legal basis" under data protection law, and no player\'s Base is meant. The German says „Rechtsgrundlagen“, the regulation\'s own word.',
  },
  {
    locale: "de",
    key: "site.pages.pages[10].body[2].body[0]",
    term: "base",
    rule: "missing-term",
    reason: "The published page registry also carries the privacy page. Its legal bases are Rechtsgrundlagen, not a player's Base.",
  },
  {
    locale: "de",
    key: "rulebook.s04.f34",
    term: "scientificAchievement",
    rule: "missing-term",
    reason:
      "A callout on sheet 4 stands on a white pill of the artwork, here about 31 pt wide, and „Wissenschaftliche“ alone measures 35 pt at the callout's 5 pt. The callout keeps the noun, „Errungenschaften“. Its numeral 7 names the entry of the list beside the cards, which has the term in full.",
  },
  {
    locale: "et",
    key: "legal.legalImprint.description",
    term: "plepicGames",
    rule: "altered-as-printed",
    reason:
      'The approved page declines the name as Estonian spelling has it, "Plepic Gamesi taga", and the ending joins the last letter. The name itself is unchanged. New copy keeps the letters apart, as `docs/working/site-translation/et.md` says.',
  },
  {
    locale: "et",
    key: "legal.legalShipping.body[0].body[1]",
    term: "parcelMachine",
    rule: "missing-term",
    reason:
      'The approved page names the two delivery methods by the English labels of `content/interface.ts`, "Standard delivery" and "Omniva parcel machine". The second is a label quoted in English and not the glossary\'s pakiautomaat.',
  },
  {
    locale: "et",
    key: "legal.legalPrivacy.body[2].body[0]",
    term: "base",
    rule: "missing-term",
    reason:
      'The English "legal bases" is the plural of "legal basis" under data protection law, and no player\'s Base is meant. The Estonian says "Õiguslikud alused", the regulation\'s own word.',
  },
];
