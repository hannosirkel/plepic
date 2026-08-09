/**
 * The Lunar Base page mockup — one of the plan's exactly-two mockups. A
 * single responsive design answering both desktop and mobile through CSS
 * (see `styles/mockups/lunar-base.module.css`), not two separate files.
 *
 * This renders every section `content/pages.ts` lists for the `lunarBase`
 * route, in that order, so the next unit (`t2-pages`) can lift each section
 * wholesale into `src/app/games/lunar-base/page.tsx`. It deliberately is
 * **not** imported by that route file — see the migration report for how
 * separability from the route tree is arranged.
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
import { FeatureSpecStrip } from "../FeatureSpecStrip.js";
import { ReviewComposite } from "../ReviewComposite.js";
import { SectionDivider } from "../decor/SectionDivider.js";
import { PurchasePanelMockup } from "../PurchasePanelMockup.js";
import { SiteFooter } from "../SiteFooter.js";
import { SiteHeader } from "../SiteHeader.js";
import styles from "../../styles/mockups/lunar-base.module.css";

export function LunarBaseMockup() {
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
        </section>

        <section id="travels-well" className={styles.travelsSection}>
          <h2 className={styles.headingOnDark}>{travelsWell.heading}</h2>
          {travelsWell.body.map((paragraph) => (
            <p key={paragraph} className={styles.bodyOnDark}>
              {paragraph}
            </p>
          ))}
        </section>

        <section id="video_trailer" className={styles.section}>
          <h2 className={styles.heading}>Watch the trailer</h2>
          {/* The trailer lives on YouTube per the plan's "keep video on YouTube"
              instruction. Its URL is runtime configuration (an ExternalTargetId),
              not content, so this mockup has no href to render yet — see
              components/mockups/link-target.ts. */}
          <p className={styles.body}>
            <span className={styles.pendingLink}>Watch the Lunar Base trailer on YouTube</span>
          </p>
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
          <PurchasePanelMockup />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
