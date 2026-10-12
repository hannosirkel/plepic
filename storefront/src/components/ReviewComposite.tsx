/**
 * The review composite, rebuilt as layout.
 *
 * Every quotation rendered here comes from the `quotations` list of the
 * edition's `proof` module, verbatim and attributed — the content model does
 * not offer a way to write an unattributed one (`Quotation.source` is a
 * required `SourceId` keyed to the evidence manifest). This component adds no copy of its own:
 * "reviews and proof" is, per the operator's asset manifest, the one content
 * category with no fabricated substitute available, so the honest option is
 * to lay out exactly the five real quotations that exist and nothing more.
 * The quotation marks and the dash before a context line are the edition's
 * too (`content/interface.ts`), because they differ between languages.
 */
import { siteCopyFor } from "../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../content/routes.js";
import styles from "../styles/review-composite.module.css";

export interface ReviewCompositeProps {
  /** The edition whose quotations this renders. */
  readonly locale?: Locale;
}

export function ReviewComposite({ locale = DEFAULT_LOCALE }: ReviewCompositeProps = {}) {
  const copy = siteCopyFor(locale);
  const { quotations } = copy.proof;
  const { quotationOpen, quotationClose, contextSeparator } = copy.interface.reviews;

  return (
    <ul className={styles.grid}>
      {quotations.map((quotation, index) => (
        <li key={`${quotation.source}-${index}`} className={styles.card}>
          <figure className={styles.figure}>
            <blockquote className={styles.quote}>
              <p>
                {quotationOpen}
                {quotation.text}
                {quotationClose}
              </p>
            </blockquote>
            <figcaption className={styles.attribution}>
              {quotation.attribution}
              {quotation.context ? (
                <span className={styles.context}>
                  {contextSeparator}
                  {quotation.context}
                </span>
              ) : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
