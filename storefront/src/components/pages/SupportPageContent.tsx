/**
 * The Support page — the rulebook served from this site rather than Google
 * Drive, a rules FAQ, the tutorial video, a component list, and the contact
 * form. `content/pages.ts`'s `support.sections` is `["rules-faq",
 * "components", "contact"]`; the rulebook link and the tutorial video sit
 * inside/alongside the "rules-faq" section rather than claiming new anchors
 * of their own, since neither is in `content/routes.ts`'s `AnchorId` union
 * (read-only to this unit).
 *
 * **The rulebook stops living in Google Drive.** `rulebookLink` (from
 * `content/support.ts`) points at `/support/lunar-base/rulebook`, this site's
 * own route — see `RulebookPageContent.tsx` for the PDF itself.
 */
import { inTheBox, inTheBoxSummary } from "../../../../content/lunar-base.js";
import { contact, printedRulebookNote, rulebookLink, rulesFaq, supportIntro } from "../../../../content/support.js";
import { ContactForm } from "../forms/ContactForm.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { SiteFooter } from "../SiteFooter.js";
import { SiteHeader } from "../SiteHeader.js";
import { VideoEmbed } from "../video/VideoEmbed.js";
import styles from "../../styles/pages/support.module.css";

export interface SupportPageContentProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}

export function SupportPageContent({ turnstileSiteKey, nonce }: SupportPageContentProps) {
  return (
    <div data-layer="publisher" className={styles.page}>
      <SiteHeader wordmark="primary" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>{supportIntro.heading}</h1>
          {supportIntro.body.map((paragraph) => (
            <p key={paragraph} className={styles.lede}>
              {paragraph}
            </p>
          ))}
        </div>

        <div className={styles.printedNote} aria-labelledby="printed-note-heading">
          <h2 id="printed-note-heading" className={styles.sectionHeading}>
            {printedRulebookNote.heading}
          </h2>
          {printedRulebookNote.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <section id="rules-faq" className={styles.section} aria-labelledby="rules-faq-heading">
          <h2 id="rules-faq-heading" className={styles.sectionHeading}>
            Frequently asked questions
          </h2>

          <CallToActionLink
            action={{
              label: rulebookLink.label,
              emphasis: "primary",
              target: rulebookLink.target,
              accessibleLabel: rulebookLink.accessibleLabel,
            }}
          />

          <div className={styles.faq}>
            {rulesFaq.map((entry) => (
              <details key={entry.question}>
                <summary>{entry.question}</summary>
                {entry.answer.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </details>
            ))}
          </div>

          <VideoEmbed
            heading="Tutorial"
            title="Lunar Base tutorial"
            youTubeId={null}
            aspectRatio={1184 / 720}
            captionStatus="not-yet-available"
          />
        </section>

        <section id="components" className={styles.section} aria-labelledby="components-heading">
          <h2 id="components-heading" className={styles.sectionHeading}>
            What is in the box
          </h2>
          <p className={styles.body}>{inTheBoxSummary.text}</p>
          <ul className={styles.boxList}>
            {inTheBox.map((item) => (
              <li key={item.term}>
                <strong>{item.term}</strong> — {item.detail}
              </li>
            ))}
          </ul>
        </section>

        <section id="contact" className={styles.section} aria-labelledby="contact-heading">
          <h2 id="contact-heading" className={styles.sectionHeading}>
            {contact.heading}
          </h2>
          <div className={styles.contactBody}>
            {contact.body.map((paragraph) => (
              <p key={paragraph} className={styles.body}>
                {paragraph}
              </p>
            ))}
          </div>
          <div className={styles.contactForm}>
            <ContactForm turnstileSiteKey={turnstileSiteKey} nonce={nonce} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
