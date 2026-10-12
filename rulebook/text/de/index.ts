import type { RulebookText } from "../schema.js";
import { part1 } from "./part1.js";
import { part2 } from "./part2.js";

/**
 * The complete German rulebook text. A missing frame stops compiling.
 */
export const de: RulebookText = { ...part1, ...part2 };
