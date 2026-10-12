import type { RulebookText } from "../schema.js";
import { part1 } from "./part1.js";

/**
 * The Klingon rulebook text. It holds sheets 1 to 13 and is a partial record
 * until sheets 14 to 25 land; it then becomes the total `RulebookText`, and
 * a missing frame stops compiling.
 */
export const tlh: Partial<RulebookText> = { ...part1 };
