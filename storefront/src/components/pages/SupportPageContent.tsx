/**
 * The Support page — the rulebook served from this site rather than Google
 * Drive, a rules FAQ, the tutorial video, a component list, and the contact
 * form, in the words of the edition it is given (`siteCopyFor(locale)`).
 * `content/pages.ts`'s `support.sections` is `["rules-faq",
 * "components", "contact"]`; the rulebook link and the tutorial video sit
 * inside/alongside the "rules-faq" section rather than claiming new anchors
 * of their own, since neither is in `content/routes.ts`'s `AnchorId` union
 * (read-only to this unit).
 *
 * **The rulebook stops living in Google Drive.** `rulebookLink` (from the
 * edition's `support` module) points at `/support/lunar-base/rulebook`, this
 * site's own route — see `RulebookPageContent.tsx` for the PDF itself.
 *
 * **The contact copy is resolved against configuration, and suppressed when
 * it cannot be.** The `support` module's `contact.body` ends with "You can
 * also reach us at {merchantContactAddress}." — a configuration-sourced
 * placeholder `content/schema.ts` then marked `unresolved`, which this page
 * shipped verbatim, so every visitor read the brace in plain body type at all
 * three widths. (The flag is gone now that the deployment manifests supply the
 * address; the suppression below is not, because an environment can always be
 * misconfigured.) `src/lib/configuration-placeholders.ts` resolves it from
 * `MERCHANT_CONTACT_ADDRESS` and drops the paragraph when no address is
 * configured; see that module for why dropping is the only honest third
 * option.
 */
import { siteCopyFor } from "../../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { NO_CONFIGURATION_VALUES, resolvedParagraphs } from "../../lib/configuration-placeholders.js";
import { ContactForm } from "../forms/ContactForm.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { SiteFooter } from "../SiteFooter.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";
import { SiteHeader } from "../SiteHeader.js";
import { VideoEmbed } from "../video/VideoEmbed.js";
import styles from "../../styles/pages/support.module.css";

export interface SupportPageContentProps {
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`), passed
   * to the footer's social row. Absent keeps it inert text.
   */
  readonly externalTargets?: ExternalTargetUrls;
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
  /** From runtime configuration (`getRuntimeConfig().merchant`). `null` suppresses the copy that quotes it. */
  readonly merchantContactAddress: string | null;
  /** The edition whose copy, links and contact form this renders. */
  readonly locale?: Locale;
}

export function SupportPageContent({
  turnstileSiteKey,
  nonce,
  merchantContactAddress,
  externalTargets = {},
  locale = DEFAULT_LOCALE,
}: SupportPageContentProps) {
  const copy = siteCopyFor(locale);
  const { contact, printedRulebookNote, rulebookLink, rulesFaq, supportIntro } = copy.support;
  const { inTheBox, inTheBoxSummary } = copy.lunarBase;
  const strings = copy.interface;
  const contactBody = resolvedParagraphs(contact.body, {
    ...NO_CONFIGURATION_VALUES,
    merchantContactAddress,
  });

  return (
    <div data-layer="publisher" className={styles.page}>
      <SiteHeader wordmark="primary" locale={locale} route="support" />

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
            {strings.support.faqHeading}
          </h2>

          <CallToActionLink
            locale={locale}
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
            locale={locale}
            heading={strings.product.tutorialHeading}
            title={strings.product.tutorialTitle}
            youTubeId="SOW3l7kdu7k"
            aspectRatio="16:9"
          />
        </section>

        <section id="components" className={styles.section} aria-labelledby="components-heading">
          <h2 id="components-heading" className={styles.sectionHeading}>
            {strings.product.boxHeading}
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
            {contactBody.map((paragraph) => (
              <p key={paragraph} className={styles.body}>
                {paragraph}
              </p>
            ))}
          </div>
          <div className={styles.contactForm}>
            <ContactForm turnstileSiteKey={turnstileSiteKey} nonce={nonce} locale={locale} />
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} route="support" externalTargets={externalTargets} />
    </div>
  );
}
