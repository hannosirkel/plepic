import type { RulebookText } from "../schema.js";
import { part1 } from "./part1.js";
import { part2 } from "./part2.js";

/**
 * The Klingon rulebook text, checked as a total record of every frame.
 */
export const tlh: RulebookText = { ...part1, ...part2 };
