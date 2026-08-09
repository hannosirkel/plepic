/**
 * The five-column feature graphic, rebuilt as layout.
 *
 * The old WooCommerce shop baked this into a single image. It carried five
 * facts about the game — players, playing time, setup time, weight, card
 * count — next to five small icons. There is nothing in that composite that
 * is not layout: five facts, five icons, one row. Rebuilding it as HTML means
 * the facts come from `content/lunar-base.ts`'s `specifications` list
 * (already exactly five entries, already sourced to the evidence manifest)
 * instead of being burned into a raster nobody can edit.
 *
 * **Icon-to-fact pairing is not a judgement call, and the authority for it is
 * the printed product.** An earlier revision assigned the five icons to the
 * five facts in filename order, on the stated grounds that the source files
 * "carry no metadata tying a given icon to a given fact". They do — each
 * carries a `<g id>` naming its subject (see `icons/FeatureIcons.tsx`) — and
 * the retail box back, photographed in `public/images/box/box-hero-*.webp` in
 * this same repository, prints the pairing outright:
 *
 * | Box icon               | Box caption   | Box detail                     |
 * |------------------------|---------------|--------------------------------|
 * | `space-shuttle-launch` | FAST-PACED    | Average game approx. 30 min    |
 * | `astronaut-helmet`     | PLAYER INFO   | 2–6 players, age 10+           |
 * | `alien-obduction`      | PORTABLE      | Travel sized. Play it anywhere!|
 * | `mission-control`      | QUICK START   | Learn it in 20 min. Setup in 1 |
 * | `galaxy`               | REPLAYABLE    | Add cards or alternate rules   |
 *
 * The old order put the rocket on Players and the galaxy on Playing time,
 * contradicting the box a buyer is holding. `PAIRING` below follows the box
 * for the three facts the box states (Players, Playing time, Setup). Weight
 * and Cards have no printed counterpart, so they take the two remaining
 * icons on the nearest reading the box supports — PORTABLE for a
 * medium-light game, REPLAYABLE for the card count that supplies the
 * replay — and that residue, not the box-stated three, is the only judgement
 * call in this file.
 */
import { specifications } from "../../../content/lunar-base.js";
import {
  AlienAbductionIcon,
  AstronautHelmetIcon,
  GalaxyIcon,
  MissionControlIcon,
  ShuttleLaunchIcon,
} from "./icons/FeatureIcons.js";
import type { FeatureIconProps } from "./icons/FeatureIcons.js";
import type { FC } from "react";
import styles from "../styles/feature-spec-strip.module.css";

/**
 * Keyed by `specifications`' `term`, not by list position, so reordering
 * `content/lunar-base.ts` moves a column without silently re-pairing the
 * icons — which is exactly how the previous mispairing survived review.
 */
const PAIRING: Readonly<Record<string, FC<FeatureIconProps>>> = {
  Players: AstronautHelmetIcon,
  "Playing time": ShuttleLaunchIcon,
  Setup: MissionControlIcon,
  Weight: AlienAbductionIcon,
  Cards: GalaxyIcon,
};

/**
 * `specifications` is a plain `readonly ListItem[]`, so the pairing with a
 * fixed five-icon set is asserted at module scope rather than in the type: if
 * a future edit to `lunar-base.ts` renames, adds or drops a term, this throws
 * at import time (caught by any test that renders the component) instead of
 * silently dropping or misaligning a column.
 */
const unpaired = specifications.filter((spec) => !(spec.term in PAIRING)).map((spec) => spec.term);

if (unpaired.length > 0 || specifications.length !== Object.keys(PAIRING).length) {
  throw new Error(
    `FeatureSpecStrip pairs ${Object.keys(PAIRING).length} icons but content/lunar-base.ts declares ` +
      `${specifications.length} specifications${unpaired.length > 0 ? ` (unpaired: ${unpaired.join(", ")})` : ""} — ` +
      "check the pairing against the box back before changing it",
  );
}

export function FeatureSpecStrip() {
  return (
    <ul className={styles.strip}>
      {specifications.map((spec) => {
        const Icon = PAIRING[spec.term]!;
        return (
          <li key={spec.term} className={styles.column}>
            <Icon title="" className={styles.icon} />
            <span className={styles.term}>{spec.term}</span>
            <span className={styles.detail}>{spec.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}
