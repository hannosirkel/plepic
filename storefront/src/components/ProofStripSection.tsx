/**
 * The homepage proof strip: two or three verified, attributed claims (the
 * type only allows that many — see `content/schema.ts`'s `ProofStripItems`).
 * Every headline and detail is `proofStrip.items` from the edition's `proof`
 * module verbatim; nothing here writes new copy.
 */
import { siteCopyFor } from "../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../content/routes.js";
import { resolveLinkHref } from "./mockups/link-target.js";
import type { ExternalTargetUrls } from "../config/runtime-config.js";
import styles from "../styles/proof-strip.module.css";

export interface ProofStripSectionProps {
  /** The edition whose proof strip this renders. */
  readonly locale?: Locale;
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`).
   *
   * The first item's "See the campaign" link is an external target, so without
   * this the strip renders that label as inert text — which is exactly what the
   * served site did until 2026-08-20, because no caller passed anything. A
   * static mockup with no configuration still passes nothing and still gets the
   * inert rendering; that path is unchanged and deliberate.
   */
  readonly externalTargets?: ExternalTargetUrls;
}

export function ProofStripSection({
  locale = DEFAULT_LOCALE,
  externalTargets = {},
}: ProofStripSectionProps = {}) {
  const { proofStrip } = siteCopyFor(locale).proof;

  return (
    <ul className={styles.strip}>
      {proofStrip.items.map((item) => {
        const href = item.link ? resolveLinkHref(item.link.target, externalTargets) : undefined;
        return (
          <li key={item.source} className={styles.item}>
            <p className={styles.headline}>{item.headline}</p>
            <p className={styles.detail}>{item.detail}</p>
            {item.link ? (
              href === undefined ? (
                <span className={styles.link}>{item.link.label}</span>
              ) : (
                <a className={styles.link} href={href} aria-label={item.link.accessibleLabel}>
                  {item.link.label}
                </a>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
