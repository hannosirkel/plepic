/**
 * The homepage proof strip: two or three verified, attributed claims (the
 * type only allows that many — see `content/schema.ts`'s `ProofStripItems`).
 * Every headline and detail is `proofStrip.items` from `content/proof.ts`
 * verbatim; nothing here writes new copy.
 */
import { proofStrip } from "../../../content/proof.js";
import { resolveLinkHref } from "./mockups/link-target.js";
import styles from "../styles/proof-strip.module.css";

export function ProofStripSection() {
  return (
    <ul className={styles.strip}>
      {proofStrip.items.map((item) => {
        const href = item.link ? resolveLinkHref(item.link.target) : undefined;
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
