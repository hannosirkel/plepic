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
 * **The pairing is now trivial, and that is the point.** An earlier revision
 * of this file paired five icons against five bare specifications — Players,
 * Playing time, Setup, Weight, Cards — which meant matching a box caption to a
 * data-sheet row and reasoning about the two that had no printed counterpart.
 * On 2026-08-20 the operator replaced those specifications with the box's own
 * five captions, so every column now pairs with the icon drawn for it by name.
 * There is no judgement call left in this file.
 *
 * ## The age marking
 *
 * `10+` used to be rendered here, from `storefront/mock/catalogue.json`, as a
 * sentence beneath the strip: the specifications carried no age entry, so the
 * marking appeared nowhere on the product page otherwise, and it was worded as
 * a safety marking rather than a play recommendation.
 *
 * Both the sentence and the catalogue read are gone. The box's own PLAYER INFO
 * column states "2 - 6 players / Age 10 +", so the marking is on the page as
 * content, from `content/`, where the rest of the copy lives — and a component
 * reaching into the mock catalogue to supply a fact that content did not have
 * was always a workaround for that gap rather than a design.
 *
 * The safety-marking *framing* is not lost with the sentence: the CE / EN71
 * certification copy on the same page states what the age grade is and why,
 * and it belongs to `content/`, which owns it.
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
  "Fast-paced": ShuttleLaunchIcon,
  Replayable: GalaxyIcon,
  "Quick Start": MissionControlIcon,
  Portable: AlienAbductionIcon,
  "Player info": AstronautHelmetIcon,
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
    <div className={styles.stripGroup}>
      <ul className={styles.strip}>
        {specifications.map((spec) => {
          const Icon = PAIRING[spec.term]!;
          return (
            <li key={spec.term} className={styles.column}>
              <Icon title="" className={styles.icon} />
              <span className={styles.term}>{spec.term}</span>
              {spec.detail.map((line) => (
                <span key={line} className={styles.detail}>
                  {line}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
