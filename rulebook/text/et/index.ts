import type { RulebookText } from "../schema.js";
import { part1 } from "./part1.js";

/** Estonian rulebook text available through sheet 13. */
export const et: Partial<RulebookText> = { ...part1 };
