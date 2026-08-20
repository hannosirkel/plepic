/**
 * The homepage — developed from `t2-design-assets`'s `HomepageMockup` into
 * the real route (`src/app/page.tsx` renders this directly). One responsive
 * design, desktop and mobile answered through CSS (see
 * `styles/mockups/homepage.module.css`).
 *
 * Renders every section `content/pages.ts` lists for the `home` route
 * (`proof`, `story`, `newsletter`) beneath a hero that needs no anchor of its
 * own — `home`'s section list in `content/pages.ts` has no `hero` entry,
 * because nothing on the page links to it — plus one section the page
 * registry does not enumerate: the immersive featured-game section the
 * checkbox asks for between the proof strip and the publisher story. It gets
 * a plain `id` for in-page linkability, not an `AnchorId`, because nothing in
 * `content/` targets it as a link destination.
 *
 * **What changed to become the real route, beyond wiring:**
 *
 * - The hero uses the cleared front/back box cut-out (`box-front-back-*.webp`)
 *   so the publisher page shows both the cover and the real product summary.
 * - `{price}` in the "Buy for {price}" call to action, and every other
 *   catalogue placeholder on this page, is resolved against
 *   `storefront/mock/catalogue.json` through `resolveCataloguePlaceholders`
 *   — see `src/lib/catalogue.ts` — rather than rendered literally.
 * - The newsletter section mounts the real `NewsletterForm`, which in turn
 *   mounts `TurnstileWidget` and `HoneypotField` — both built and mounted
 *   nowhere until this unit.
 */
import { pitch, differentiator, featuredDescription } from "../../../../content/lunar-base.js";
import {
  homepageCallsToAction,
  publisherSentence,
  publisherStory,
  newsletter,
} from "../../../../content/publisher.js";
import { resolveCatalogue, resolveCataloguePlaceholders, type ResolvedCatalogue } from "../../lib/catalogue.js";
import { NewsletterForm } from "../forms/NewsletterForm.js";
import { CallToActionLink } from "./CallToActionLink.js";
import { ProofStripSection } from "../ProofStripSection.js";
import { TeamPhotoSection } from "../TeamPhotoSection.js";
import { SiteHeader } from "../SiteHeader.js";
import { SiteFooter } from "../SiteFooter.js";
import { resolveLinkHref } from "./link-target.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";
import styles from "../../styles/mockups/homepage.module.css";

export interface HomepageMockupProps {
  /** Defaults to the mock catalogue's own product — see `src/lib/catalogue.ts`. */
  readonly catalogue?: ResolvedCatalogue;
  /** From runtime configuration (`getRuntimeConfig().turnstile.siteKey`). `null` renders no widget. */
  readonly turnstileSiteKey?: string | null;
  /** This request's CSP nonce (`getRequestNonce()`). */
  readonly nonce?: string | undefined;
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`), passed
   * to the proof strip and the footer. Absent keeps both in their inert-text
   * form, which is what a static mockup wants and what the served page got by
   * accident until 2026-08-20.
   */
  readonly externalTargets?: ExternalTargetUrls;
}

export function HomepageMockup({
  catalogue = resolveCatalogue(),
  turnstileSiteKey = null,
  nonce = undefined,
  externalTargets = {},
}: HomepageMockupProps = {}) {
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);
  /*
   * One link in the story section, and it is the heading. `content` still
   * declares it as a link on the section, so the label and the destination stay
   * where every other label and destination live.
   */
  const originStory = (publisherStory.links ?? [])[0];
  const originStoryHref =
    originStory === undefined ? undefined : resolveLinkHref(originStory.target, externalTargets);
  const storyHeading = originStory?.label ?? publisherStory.heading;

  return (
    <div data-layer="publisher" className={styles.page}>
      <SiteHeader wordmark="primary" />

      <main className={styles.main}>
        <section className={styles.hero}>
          {/* One element per named grid area. The four copy elements are wrapped
              rather than each given `grid-area: copy` directly: several items
              assigned to the same named area do not stack vertically, they
              occupy the same cell and overlap. */}
          <div className={styles.heroCopy}>
            <p className={styles.publisherLine}>{publisherSentence.text}</p>
            <h1 className={styles.pitch}>{pitch.text}</h1>
            <p className={styles.differentiator}>{differentiator.text}</p>
            <div className={styles.heroActions}>
              {homepageCallsToAction.map((action) => (
                <CallToActionLink key={action.label} action={action} resolveLabel={resolve} />
              ))}
            </div>
          </div>
          <img
            className={styles.heroImage}
            src="/images/box/box-front-back-960.webp"
            srcSet="/images/box/box-front-back-480.webp 480w, /images/box/box-front-back-960.webp 960w, /images/box/box-front-back-1600.webp 1600w"
            sizes="(max-width: 720px) 92vw, 40rem"
            width={1600}
            height={864}
            loading="eager"
            decoding="async"
            alt="The front and back of the Lunar Base game box, showing the astronaut cover and the component and game summary on the reverse."
          />
        </section>

        <section id="proof" className={styles.section} aria-label="Proof">
          <ProofStripSection externalTargets={externalTargets} />
        </section>

        <section id="featured-game" data-layer="lunar" className={styles.featured} aria-labelledby="featured-game-heading">
          <div className={styles.featuredCopy}>
            <h2 id="featured-game-heading" className={styles.featuredHeading}>
              {resolve("{productName}")}
            </h2>
            {featuredDescription.map((paragraph) => (
              <p key={paragraph} className={styles.featuredBody}>
                {paragraph}
              </p>
            ))}
            <CallToActionLink
              action={{ label: "Explore Lunar Base", emphasis: "primary", target: { kind: "route", to: "lunarBase" } }}
            />
          </div>
          <img
            className={styles.featuredImage}
            src="/images/components/hand-cards-780.webp"
            srcSet="/images/components/hand-cards-480.webp 480w, /images/components/hand-cards-780.webp 780w"
            sizes="(max-width: 860px) 90vw, 26rem"
            width={780}
            height={598}
            loading="lazy"
            decoding="async"
            alt="A hand of Lunar Base cards, fanned out."
          />
        </section>

        <section id="story" className={styles.section} aria-labelledby="story-heading">
          {/*
            * The heading is the link to the published origin story, on the
            * operator's instruction of 2026-08-20. It replaces both the old
            * heading and the plain-text link that used to sit under the last
            * paragraph, unformatted and easy to miss.
            *
            * When no deployment configures the destination the heading is still
            * a heading — text, not a dead anchor. That is `link-target.ts`'s
            * class-2 degradation applied to a heading rather than a link: the
            * section must keep its accessible name either way, because
            * `aria-labelledby` points at it.
            */}
          <h2 id="story-heading" className={styles.heading}>
            {originStoryHref === undefined ? (
              storyHeading
            ) : (
              <a className={styles.headingLink} href={originStoryHref} rel="noopener">
                {storyHeading}
              </a>
            )}
          </h2>
          <div className={styles.storyLayout}>
            <TeamPhotoSection />
            <div className={styles.storyBody}>
              {publisherStory.body.map((paragraph) => (
                <p key={paragraph} className={styles.body}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section id="newsletter" className={styles.newsletter} aria-labelledby="newsletter-heading">
          <h2 id="newsletter-heading" className={styles.heading}>
            {newsletter.heading}
          </h2>
          {newsletter.body.map((paragraph) => (
            <p key={paragraph} className={styles.body}>
              {paragraph}
            </p>
          ))}
          <NewsletterForm turnstileSiteKey={turnstileSiteKey} nonce={nonce} />
        </section>
      </main>

      <SiteFooter externalTargets={externalTargets} />
    </div>
  );
}
