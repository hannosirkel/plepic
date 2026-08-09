/**
 * The homepage mockup — the other of the plan's exactly-two mockups. One
 * responsive design, desktop and mobile answered through CSS (see
 * `styles/mockups/homepage.module.css`).
 *
 * Renders every section `content/pages.ts` lists for the `home` route
 * (`proof`, `story`, `newsletter`) beneath a hero that needs no anchor of its
 * own — `home`'s section list in `content/pages.ts` has no `hero` entry,
 * because nothing on the page links to it. Not imported by
 * `src/app/page.tsx`; see the migration report for why.
 */
import { pitch, differentiator } from "../../../../content/lunar-base.js";
import { homepageCallsToAction, publisherSentence, publisherStory, newsletter } from "../../../../content/publisher.js";
import { CallToActionLink } from "./CallToActionLink.js";
import { ProofStripSection } from "../ProofStripSection.js";
import { TeamPhotoSection } from "../TeamPhotoSection.js";
import { SiteHeader } from "../SiteHeader.js";
import { SiteFooter } from "../SiteFooter.js";
import styles from "../../styles/mockups/homepage.module.css";

export function HomepageMockup() {
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
              {/* {price} is a catalogue placeholder (content/schema.ts) — rendered
                  literally, like the purchase panel's price line, rather than
                  resolved against a catalogue this static mockup has no access to. */}
              {homepageCallsToAction.map((action) => (
                <CallToActionLink key={action.label} action={action} />
              ))}
            </div>
          </div>
          <img
            className={styles.heroImage}
            src="/images/box/box-hero-960.webp"
            srcSet="/images/box/box-hero-480.webp 480w, /images/box/box-hero-960.webp 960w, /images/box/box-hero-1600.webp 1600w"
            sizes="(max-width: 720px) 92vw, 40rem"
            width={1600}
            height={864}
            loading="eager"
            decoding="async"
            alt="The Lunar Base box, front and back, shown together."
          />
        </section>

        <section id="proof" className={styles.section} aria-label="Proof">
          <ProofStripSection />
        </section>

        <section id="story" className={styles.section} aria-labelledby="story-heading">
          <h2 id="story-heading" className={styles.heading}>
            {publisherStory.heading}
          </h2>
          <div className={styles.storyBody}>
            {publisherStory.body.map((paragraph) => (
              <p key={paragraph} className={styles.body}>
                {paragraph}
              </p>
            ))}
          </div>
          <TeamPhotoSection />
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
          {/* Static markup only — no submit handler. Newsletter signup wiring is
              explicitly out of scope: the plan forbids building a subscriber
              subsystem in this repository at all. */}
          <form className={styles.form} aria-label={newsletter.heading}>
            <label className={styles.fieldLabel} htmlFor="newsletter-email">
              {newsletter.fieldLabel}
            </label>
            <div className={styles.fieldRow}>
              <input id="newsletter-email" className={styles.field} type="email" name="email" />
              <button type="submit" className={styles.submit}>
                {newsletter.submitLabel}
              </button>
            </div>
            <p className={styles.consentNote}>{newsletter.consentNote}</p>
          </form>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
