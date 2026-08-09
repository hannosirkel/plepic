/**
 * The Lunar Base page — developed from `t2-design-assets`'s `LunarBaseMockup`
 * into the real, canonical product route (`src/app/games/lunar-base/page.tsx`
 * renders this directly). A single responsive design answering both desktop
 * and mobile through CSS (see `styles/mockups/lunar-base.module.css`).
 *
 * Renders every section `content/pages.ts` lists for the `lunarBase` route,
 * in that order, plus two beats the decision-order checkbox names that the
 * page registry does not carry its own anchor for:
 *
 * - **Table photography**, between "why it travels well" and the
 *   quotations — the printed-component render already used in "what is in
 *   the box" (`layout-base-*.webp`), shown large rather than paired small,
 *   because no second distinct table photograph exists in this repository
 *   and the plan forbids fabricating one.
 * - **The tutorial video**, inside the same `id="video_trailer"` section as
 *   the trailer rather than a separate anchor: `content/routes.ts`'s
 *   `AnchorId` union (read-only to this unit) has no `video_tutorial` member,
 *   and the existing `video_trailer` fragment is load-bearing (existing
 *   backlinks carry it) so it stays exactly where it is. One section, two
 *   videos, is a legitimate reading of "one trailer and one tutorial video"
 *   that needs no new anchor.
 *
 * **What changed to become the real route, beyond wiring:** every catalogue
 * placeholder (`{price}`, `{priceLine}`, `{taxNote}`, `{productName}`) in the
 * purchase panel and its calls to action is resolved against
 * `storefront/mock/catalogue.json` — see `src/lib/catalogue.ts` — rather
 * than rendered literally, and the rulebook is linked from the "what is in
 * the box" section rather than only named in prose.
 */
import {
  differentiator,
  factions,
  heroFacts,
  howItPlays,
  inTheBox,
  inTheBoxSummary,
  influenceVariantNote,
  pitch,
  productFaq,
  travelsWell,
  victoryPaths,
  victoryPathsIntro,
  victoryPathsNote,
} from "../../../../content/lunar-base.js";
import { rulebookLink } from "../../../../content/support.js";
import { resolveCatalogue, type ResolvedCatalogue } from "../../lib/catalogue.js";
import { FeatureSpecStrip } from "../FeatureSpecStrip.js";
import { ReviewComposite } from "../ReviewComposite.js";
import { SectionDivider } from "../decor/SectionDivider.js";
import { PurchasePanelMockup } from "../PurchasePanelMockup.js";
import { SiteFooter } from "../SiteFooter.js";
import { SiteHeader } from "../SiteHeader.js";
import { VideoEmbed } from "../video/VideoEmbed.js";
import { CallToActionLink } from "./CallToActionLink.js";
import styles from "../../styles/mockups/lunar-base.module.css";

export interface LunarBaseMockupProps {
  /** Defaults to the mock catalogue's own product — see `src/lib/catalogue.ts`. */
  readonly catalogue?: ResolvedCatalogue;
}

export function LunarBaseMockup({ catalogue = resolveCatalogue() }: LunarBaseMockupProps = {}) {
  return (
    <div data-layer="lunar" className={styles.page}>
      <SiteHeader wordmark="dark" />

      <main className={styles.main}>
        <section id="aboutgame" className={styles.hero}>
          <div className={styles.heroCopy}>
            {/* The page's one <h1>. This is the visually dominant text on the
                page — `--step-5`, bold — and it is the product's own pitch, so
                the structure a sighted visitor sees and the structure exposed
                to assistive technology have to be the same one. */}
            <h1 className={styles.pitch}>{pitch.text}</h1>
            <p className={styles.differentiator}>{differentiator.text}</p>
            <ul className={styles.heroFacts}>
              {heroFacts.map((fact) => (
                <li key={fact.text}>{fact.text}</li>
              ))}
            </ul>
          </div>
          <img
            className={styles.heroImage}
            src="/images/box/box-open-960.webp"
            srcSet="/images/box/box-open-480.webp 480w, /images/box/box-open-960.webp 960w, /images/box/box-open-1500.webp 1500w"
            sizes="(max-width: 720px) 90vw, 32rem"
            width={1500}
            height={1000}
            loading="eager"
            decoding="async"
            alt="The Lunar Base box open on a plain background, its lid raised behind the empty tray, with a squared stack of cards topped by the Shackleton main-action card, a small card tuck box, the rulebook standing open, and several round scoring discs arranged in front."
          />
        </section>

        <section className={styles.specSection}>
          <FeatureSpecStrip />
        </section>

        <SectionDivider className={styles.divider} />

        <section id="how-it-plays" className={styles.section}>
          <h2 className={styles.heading}>{howItPlays.heading}</h2>
          <ol className={styles.steps}>
            {howItPlays.body.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section id="victory-paths" className={styles.section}>
          <h2 className={styles.heading}>Four ways to win</h2>
          <p className={styles.body}>{victoryPathsIntro.text}</p>
          <dl className={styles.victoryList}>
            {victoryPaths.map((path) => (
              <div key={path.term} className={styles.victoryItem}>
                <dt>{path.term}</dt>
                <dd>{path.detail}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>{victoryPathsNote.text}</p>
          <p className={styles.note}>{influenceVariantNote.text}</p>
        </section>

        <section id="in-the-box" className={styles.section}>
          <h2 className={styles.heading}>What is in the box</h2>
          <p className={styles.body}>{inTheBoxSummary.text}</p>
          <ul className={styles.boxList}>
            {inTheBox.map((item) => (
              <li key={item.term}>
                <strong>{item.term}</strong> — {item.detail}
              </li>
            ))}
          </ul>
          <div className={styles.componentGallery}>
            <img
              src="/images/components/hand-cards-480.webp"
              srcSet="/images/components/hand-cards-480.webp 480w, /images/components/hand-cards-780.webp 780w"
              sizes="(max-width: 720px) 45vw, 20rem"
              width={780}
              height={598}
              loading="lazy"
              decoding="async"
              alt="A hand of Lunar Base cards, fanned out."
            />
            <img
              src="/images/components/layout-base-480.webp"
              srcSet="/images/components/layout-base-480.webp 480w, /images/components/layout-base-960.webp 960w"
              sizes="(max-width: 720px) 45vw, 20rem"
              width={960}
              height={611}
              loading="lazy"
              decoding="async"
              alt="A player's base laid out with a station and several module cards attached."
            />
          </div>
          <details className={styles.factions}>
            <summary>The six factions</summary>
            <dl className={styles.victoryList}>
              {factions.map((faction) => (
                <div key={faction.term} className={styles.victoryItem}>
                  <dt>{faction.term}</dt>
                  <dd>{faction.detail}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className={styles.body}>
            <CallToActionLink
              action={{ label: rulebookLink.label, emphasis: "quiet", target: rulebookLink.target, accessibleLabel: rulebookLink.accessibleLabel }}
            />
          </p>
        </section>

        <section id="travels-well" className={styles.travelsSection}>
          <h2 className={styles.headingOnDark}>{travelsWell.heading}</h2>
          {travelsWell.body.map((paragraph) => (
            <p key={paragraph} className={styles.bodyOnDark}>
              {paragraph}
            </p>
          ))}
        </section>

        <section id="table-photography" className={styles.section}>
          <h2 className={styles.heading}>On the table</h2>
          <img
            className={styles.tablePhoto}
            src="/images/components/layout-base-960.webp"
            srcSet="/images/components/layout-base-480.webp 480w, /images/components/layout-base-960.webp 960w"
            sizes="(max-width: 720px) 92vw, 40rem"
            width={960}
            height={611}
            loading="lazy"
            decoding="async"
            alt="A player's base laid out with a station and several module cards attached."
          />
        </section>

        <section id="video_trailer" className={styles.section}>
          <h2 className={styles.heading}>Watch</h2>
          {/* Both videos live on YouTube per the plan's "keep video on YouTube"
              instruction; this unit embeds, it does not host one. Neither has a
              published YouTube id yet (see VideoEmbed.tsx's doc comment), so
              both render the honest pending state rather than a fabricated
              embed. This section keeps the id="video_trailer" fragment
              existing backlinks carry — see content/routes.ts. */}
          <VideoEmbed
            heading="Trailer"
            title="Lunar Base trailer"
            youTubeId={null}
            aspectRatio={16 / 9}
            captionStatus="not-yet-available"
          />
          <VideoEmbed
            heading="Tutorial"
            title="Lunar Base tutorial"
            youTubeId={null}
            aspectRatio={1184 / 720}
            captionStatus="not-yet-available"
          />
        </section>

        <section id="reviews" className={styles.section}>
          <h2 className={styles.heading}>What reviewers say</h2>
          <ReviewComposite />
        </section>

        <section id="shipping-and-returns" className={styles.section}>
          <h2 className={styles.heading}>Shipping, returns and other questions</h2>
          <div className={styles.faq}>
            {productFaq.map((entry) => (
              <details key={entry.question}>
                <summary>{entry.question}</summary>
                {entry.answer.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </details>
            ))}
          </div>
        </section>

        <section id="buy" className={styles.buySection}>
          <PurchasePanelMockup catalogue={catalogue} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
