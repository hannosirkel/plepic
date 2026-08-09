/**
 * The review composite, rebuilt as layout.
 *
 * Every quotation rendered here comes from `content/proof.ts`'s `quotations`
 * list, verbatim and attributed — the content model does not offer a way to
 * write an unattributed one (`Quotation.source` is a required `SourceId`
 * keyed to the evidence manifest). This component adds no copy of its own:
 * "reviews and proof" is, per the operator's asset manifest, the one content
 * category with no fabricated substitute available, so the honest option is
 * to lay out exactly the five real quotations that exist and nothing more.
 */
import { quotations } from "../../../content/proof.js";
import styles from "../styles/review-composite.module.css";

export function ReviewComposite() {
  return (
    <ul className={styles.grid}>
      {quotations.map((quotation, index) => (
        <li key={`${quotation.source}-${index}`} className={styles.card}>
          <figure className={styles.figure}>
            <blockquote className={styles.quote}>
              <p>&ldquo;{quotation.text}&rdquo;</p>
            </blockquote>
            <figcaption className={styles.attribution}>
              {quotation.attribution}
              {quotation.context ? <span className={styles.context}> — {quotation.context}</span> : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
