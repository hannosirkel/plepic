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
 *   quotations — the cleared overhead game-in-progress photograph is shown
 *   wide as authentic play evidence rather than fabricating a setup.
 * - **The tutorial video**, inside the same `id="video_trailer"` section as
 *   the trailer rather than a separate anchor: `content/routes.ts`'s
 *   `AnchorId` union (read-only to this unit) has no `video_tutorial` member,
 *   and the existing `video_trailer` fragment is load-bearing (existing
 *   backlinks carry it) so it stays exactly where it is. One section, two
 *   videos, is a legitimate reading of "one trailer and one tutorial video"
 *   that needs no new anchor.
 *
 * **What changed to become the real route, beyond wiring:** every catalogue
 * placeholder (`{price}`, `{priceLine}`, `{productName}`) in the
 * purchase panel and its calls to action is resolved against
 * `storefront/mock/catalogue.json` — see `src/lib/catalogue.ts` — rather
 * than rendered literally, and the rulebook is linked from the "what is in
 * the box" section rather than only named in prose.
 *
 * **Every `content/` string this component renders goes through `resolve`,
 * not only the ones a reviewer happened to look at.** The first revision
 * threaded the resolver into the purchase panel and the calls to action and
 * rendered `productFaq` verbatim, so "How much is shipping?" answered with a
 * literal "{priceLine}" on the shipping product page — inside a closed
 * `<details>`, which is exactly why every test missed it.
 * `tests/no-unresolved-placeholder.test.tsx` now fails on any `{token}`
 * reaching rendered text on any real route, open or closed `<details>`
 * included.
 *
 * **The hero carries the commercial facts, per the decision order** ("hero
 * with box, price, stock, player count, playtime and Buy"). It shipped with
 * pitch, differentiator, two facts and the box only: a visitor arriving on
 * an `#aboutgame` backlink had to scroll the whole page — 8,603 CSS px at
 * 320 — before meeting a price, a stock statement or any way to buy. The
 * price, stock and player count are read from the resolved catalogue, and
 * the Buy action is the *same* `content/lunar-base.ts` call to action the
 * purchase panel renders, not a second one invented for the hero.
 *
 * Measured in a real Chromium build, the price now sits at y=546 (1280),
 * y=699 (390) and y=772 (320), and the Buy action directly under it. At
 * 1280 both are above the fold outright. At 390 and 320 they are not, and
 * saying so is more useful than claiming otherwise: the `<h1>` is the
 * product's own 100-character pitch sentence, which is 257px of type at 390
 * and 282px at 320, and shortening it is `content/`'s decision rather than
 * this component's. What changed is the distance — from 8,603px to under
 * 800 — and the fact that everything a buyer needs is now in one place
 * instead of at opposite ends of the page.
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
  purchase,
  travelsWell,
  victoryPaths,
  victoryPathsIntro,
  victoryPathsNote,
} from "../../../../content/lunar-base.js";
import type { CallToAction } from "../../../../content/schema.js";
import { rulebookLink } from "../../../../content/support.js";
import {
  PRICE_HEADLINE_SEPARATOR,
  resolveCatalogue,
  resolveCataloguePlaceholders,
  type ResolvedCatalogue,
} from "../../lib/catalogue.js";
import { NO_CONFIGURATION_VALUES, type ConfigurationPlaceholderValues } from "../../lib/configuration-placeholders.js";
import { FeatureSpecStrip } from "../FeatureSpecStrip.js";
import { ProductSafetyBlock } from "../ProductSafetyBlock.js";
import { ReviewComposite } from "../ReviewComposite.js";
import { SectionDivider } from "../decor/SectionDivider.js";
import { PurchasePanelMockup } from "../PurchasePanelMockup.js";
import type { ReactNode } from "react";
import { SiteFooter } from "../SiteFooter.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";
import { SiteHeader } from "../SiteHeader.js";
import { VideoEmbed } from "../video/VideoEmbed.js";
import { CallToActionLink } from "./CallToActionLink.js";
import styles from "../../styles/mockups/lunar-base.module.css";

export interface LunarBaseMockupProps {
  /** Defaults to the mock catalogue's own product — see `src/lib/catalogue.ts`. */
  readonly catalogue?: ResolvedCatalogue;
  /**
   * The merchant identity, for the GPSR Article 19 block. Defaults to nothing
   * configured, which is the state every deployment is in until an operator
   * sets the `MERCHANT_*` variables — and which renders named gaps and a
   * notice rather than dropping the manufacturer disclosure.
   */
  readonly merchant?: ConfigurationPlaceholderValues;
  /** Narrow client island rendered in both existing primary purchase slots. */
  readonly primaryPurchaseAction?: ReactNode;
  /**
   * The destination control, rendered once — in the hero, directly under the
   * figure it governs.
   *
   * Once rather than twice: two selects on one page saying the same thing is
   * two controls a reader has to reconcile, and the purchase panel further
   * down carries the destination in words through
   * `catalogue.priceTaxQualifier` regardless. It is a slot rather than an
   * import because it is a client island and this component is not.
   */
  readonly destinationSelector?: ReactNode;
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`), passed
   * to the footer's social row. Absent keeps it inert text.
   */
  readonly externalTargets?: ExternalTargetUrls;
}

/**
 * The hero's Buy action, taken from `content/lunar-base.ts` rather than
 * written here, so the page has exactly one set of product copy and the hero
 * and the purchase panel cannot drift apart.
 *
 * Asserted at module scope in the same style as `FeatureSpecStrip`'s icon
 * pairing: if a future content edit removed the primary call to action, a
 * silent hero with no way to buy is exactly the regression the checkbox
 * exists to prevent, so it throws at import time — caught by any test that
 * renders this component — rather than rendering nothing.
 */
function requirePrimaryPurchaseAction(): CallToAction {
  const action = purchase.callsToAction.find((candidate) => candidate.emphasis === "primary");
  if (action === undefined) {
    throw new Error(
      "content/lunar-base.ts's purchase.callsToAction declares no primary action, so the Lunar Base " +
        "hero has no Buy action to render — the decision order requires one in the hero",
    );
  }
  return action;
}

const heroBuyAction: CallToAction = requirePrimaryPurchaseAction();

export function LunarBaseMockup({
  catalogue = resolveCatalogue(),
  merchant = NO_CONFIGURATION_VALUES,
  primaryPurchaseAction,
  destinationSelector,
  externalTargets = {},
}: LunarBaseMockupProps = {}) {
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);

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
            <h1 className={styles.pitch}>{resolve(pitch.text)}</h1>
            <p className={styles.differentiator}>{resolve(differentiator.text)}</p>
            <ul className={styles.heroFacts}>
              {heroFacts.map((fact) => (
                <li key={fact.text}>{resolve(fact.text)}</li>
              ))}
              <li>{catalogue.playerCount}</li>
            </ul>

            {/* Price, stock and Buy inside the hero, immediately under the
                pitch — see this file's doc comment. The emphasised line
                carries the figure *and* the tax qualification and the note
                under it carries shipping and duties: the operator's boundary
                of 2026-08-10, and the same split the purchase panel uses, so
                the two never read as two different prices or two different
                tax claims. */}
            <div className={styles.heroPurchase}>
              <p className={styles.heroPriceHeadline}>
                <span className={styles.heroPriceFigure}>{catalogue.price}</span>
                {`${PRICE_HEADLINE_SEPARATOR}${catalogue.priceTaxQualifier}`}
              </p>
              <p className={styles.heroPriceBreakdown}>{catalogue.priceTaxBreakdown}</p>
              <p className={styles.heroPriceNote}>{catalogue.priceShippingNote}</p>
              {destinationSelector === undefined ? null : (
                <div className={styles.heroDestination}>{destinationSelector}</div>
              )}
              <p className={styles.heroAvailability}>{catalogue.availabilityLabel}</p>
              <div className={styles.heroActions}>
                {primaryPurchaseAction ?? <CallToActionLink action={heroBuyAction} resolveLabel={resolve} />}
              </div>
            </div>
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
          <h2 className={styles.heading}>{resolve(howItPlays.heading)}</h2>
          <ol className={styles.steps}>
            {howItPlays.body.map((step) => (
              <li key={step}>{resolve(step)}</li>
            ))}
          </ol>
        </section>

        <section id="victory-paths" className={styles.section}>
          <h2 className={styles.heading}>Four ways to win</h2>
          <p className={styles.body}>{resolve(victoryPathsIntro.text)}</p>
          <dl className={styles.victoryList}>
            {victoryPaths.map((path) => (
              <div key={path.term} className={styles.victoryItem}>
                <dt>{resolve(path.term)}</dt>
                <dd>{resolve(path.detail)}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>{resolve(victoryPathsNote.text)}</p>
          <p className={styles.note}>{resolve(influenceVariantNote.text)}</p>
        </section>

        <section id="in-the-box" className={styles.section}>
          <h2 className={styles.heading}>What is in the box</h2>
          <p className={styles.body}>{resolve(inTheBoxSummary.text)}</p>
          <ul className={styles.boxList}>
            {inTheBox.map((item) => (
              <li key={item.term}>
                <strong>{resolve(item.term)}</strong> — {resolve(item.detail)}
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
                  <dt>{resolve(faction.term)}</dt>
                  <dd>{resolve(faction.detail)}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className={styles.body}>
            <CallToActionLink
              action={{ label: rulebookLink.label, emphasis: "quiet", target: rulebookLink.target, accessibleLabel: rulebookLink.accessibleLabel }}
              resolveLabel={resolve}
            />
          </p>
        </section>

        <section id="travels-well" className={styles.travelsSection}>
          <h2 className={styles.headingOnDark}>{resolve(travelsWell.heading)}</h2>
          {travelsWell.body.map((paragraph) => (
            <p key={paragraph} className={styles.bodyOnDark}>
              {resolve(paragraph)}
            </p>
          ))}
        </section>

        <section id="table-photography" className={styles.section}>
          <h2 className={styles.heading}>On the table</h2>
          <img
            className={styles.tablePhoto}
            src="/images/table/table-view-1440.webp"
            srcSet="/images/table/table-view-720.webp 720w, /images/table/table-view-1440.webp 1440w, /images/table/table-view-2048.webp 2048w"
            sizes="(max-width: 720px) 100vw, 80rem"
            width={2048}
            height={1080}
            loading="lazy"
            decoding="async"
            alt="A complete Lunar Base game in progress seen from above, with six branching player bases and cards arranged around the shared play area."
          />
        </section>

        <section id="video_trailer" className={styles.section}>
          <h2 className={styles.heading}>Watch</h2>
          {/* Both verified videos remain on YouTube. This section keeps the
              existing id="video_trailer" fragment that backlinks carry. */}
          <VideoEmbed
            heading="Trailer"
            title="Lunar Base Kickstarter Launch Video"
            youTubeId="2D_y7t7DDYM"
            aspectRatio="16:9"
            captionStatus="not-yet-available"
          />
          <VideoEmbed
            heading="Tutorial"
            title="Lunar Base - Tutorial and Playthrough"
            youTubeId="SOW3l7kdu7k"
            aspectRatio="16:9"
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
                <summary>{resolve(entry.question)}</summary>
                {entry.answer.map((paragraph) => (
                  <p key={paragraph}>{resolve(paragraph)}</p>
                ))}
              </details>
            ))}
          </div>
        </section>

        <section id="buy" className={styles.buySection}>
          <PurchasePanelMockup catalogue={catalogue} primaryAction={primaryPurchaseAction} />
        </section>

        {/* GPSR Article 19: manufacturer identity and contact, and the safety
            information, on the page that carries the offer. Last, because it
            is reference material a buyer consults rather than a sales beat —
            and above the footer rather than in it, because Article 19 attaches
            to the offer. */}
        <section id="product-safety" className={styles.section}>
          <ProductSafetyBlock values={merchant} />
        </section>
      </main>

      <SiteFooter externalTargets={externalTargets} />
    </div>
  );
}
