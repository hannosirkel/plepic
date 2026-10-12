/**
 * The glossary: the term list, the model, and what each language has registered.
 *
 * `content/index.ts` does not export this directory. The glossary is a tool
 * for translators and for `glossary.test.ts`; its forbidden variants are words
 * the site must not show, and they have no place in a bundle.
 */

import type { GlossaryException, GlossaryRegistry } from "./schema.js";
import { germanGlossary } from "./de.js";

export * from "./terms.js";
export * from "./schema.js";

/**
 * A language registers here in its first task, with a sibling `<locale>.ts`
 * that holds its `Glossary`. From then on `glossary.test.ts` checks every
 * translated string of that locale.
 */
export const glossaries: GlossaryRegistry = { de: germanGlossary };

/**
 * The strings the check would fail and that stand as written. An entry that
 * no longer suppresses a failure fails the test, so the list cannot rot.
 */
export const glossaryExceptions: readonly GlossaryException[] = [];
