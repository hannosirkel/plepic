/**
 * The GPSR Article 19 block: manufacturer identity and contact, plus the
 * safety information, on the product page where the offer is.
 *
 * **Regulation (EU) 2023/988 Article 19** requires an online offer to display
 * the manufacturer's name, postal address and electronic address, and any
 * warnings or safety information. None of that was on the product page. The
 * second qualified read could not assess it because it sits outside the five
 * legal files, and said so under "unable to assess" — it is a launch matter.
 *
 * ## Three things this component is careful about
 *
 * 1. **The manufacturer is the merchant, not the printer.** Directive
 *    2009/48/EC Article 2(3) and GPSR Article 3(8) make the manufacturer
 *    whoever has the product made and markets it under their own name. The
 *    contract producer is named as the producer and never as the manufacturer;
 *    naming the wrong entity is itself a compliance defect. `content/` holds
 *    the wording, and the operator decided it.
 * 2. **Certification, never an accolade.** The test results are a table of
 *    standards and outcomes. No wreath, no badge, no trophy, no ribbon, and no
 *    styling that could be mistaken for one — a test certificate presented as
 *    an accolade is a fabricated award, which the plan forbids outright.
 * 3. **The age marking is not restated.** `FeatureSpecStrip` already renders
 *    "Age 10+ — a safety marking for this product, not a play recommendation."
 *    higher up the same page, from `mock/catalogue.json`. This block says what
 *    stands behind that marking rather than repeating it.
 *
 * The identity comes from configuration through the same resolver the legal
 * pages use, and for the same reason: an unconfigured manufacturer address is
 * a named, visible gap and a notice, never a silently dropped line. Article 19
 * is not satisfied by a page that looks complete.
 */
import { productSafety } from "../../../content/lunar-base.js";
import { DEFAULT_LOCALE, LOCALE_DEFINITIONS, type Locale } from "../../../content/routes.js";
import {
  labelFor,
  resolveRequiredProse,
  type ConfigurationPlaceholderValues,
} from "../lib/configuration-placeholders.js";
import styles from "../styles/product-safety.module.css";

export interface ProductSafetyBlockProps {
  /** From runtime configuration (`getRuntimeConfig().merchant`), projected. */
  readonly values: ConfigurationPlaceholderValues;
  /**
   * The edition this block is served in. It selects the collation for the
   * incompleteness list below and nothing else.
   *
   * It does **not** select the copy. `productSafety` comes from
   * `content/lunar-base.ts`, which is not locale-registered — the product
   * page has no localized renderer for exactly that reason, so this block is
   * only ever served in the default edition today. The parameter exists so
   * that the day the product page does get one, the sort is already right
   * rather than pinned to a literal nobody remembers to change.
   */
  readonly locale?: Locale;
}

export function ProductSafetyBlock({ values, locale = DEFAULT_LOCALE }: ProductSafetyBlockProps) {
  const manufacturer = resolveRequiredProse(productSafety.manufacturer.body, values);
  const safety = resolveRequiredProse(productSafety.safety.body, values);
  /*
   * Sorted by the label a reader sees, not by the token behind it — and with
   * an explicit collation, because `localeCompare` with none takes the
   * runtime's default and the order then depends on the container's `LANG`
   * rather than on the page. The collation is the served edition's language
   * tag rather than the literal `"en"` it used to be; see the prop's note.
   */
  const collation = LOCALE_DEFINITIONS[locale].languageTag;
  const missing = [...new Set([...manufacturer.missing, ...safety.missing])].toSorted((a, b) =>
    labelFor(a, locale).localeCompare(labelFor(b, locale), collation),
  );

  return (
    <div className={styles.block}>
      <h2 className={styles.heading}>{productSafety.heading}</h2>

      {missing.length > 0 ? (
        <p role="alert" className={styles.notice} data-testid="product-safety-incomplete-notice">
          This manufacturer information is incomplete: {missing.map((token) => labelFor(token, locale)).join(", ")}{" "}
          {missing.length === 1 ? "has" : "have"} not been configured for this deployment.
        </p>
      ) : null}

      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby="product-manufacturer-heading">
          <h3 id="product-manufacturer-heading" className={styles.subheading}>
            {productSafety.manufacturer.heading}
          </h3>
          {/* Positional keys: content is not identity, and two identical
              paragraphs are legitimate copy on a page whose whole point is
              that no paragraph disappears. */}
          {manufacturer.paragraphs.map((paragraph, index) => (
            <p key={`manufacturer-p${String(index)}`} className={styles.body}>
              {paragraph}
            </p>
          ))}
        </section>

        <section className={styles.column} aria-labelledby="product-safety-heading">
          <h3 id="product-safety-heading" className={styles.subheading}>
            {productSafety.safety.heading}
          </h3>
          {safety.paragraphs.map((paragraph, index) => (
            <p key={`safety-p${String(index)}`} className={styles.body}>
              {paragraph}
            </p>
          ))}
          <dl className={styles.results}>
            {productSafety.safety.results.map((result, index) => (
              <div key={`safety-result${String(index)}`} className={styles.result}>
                <dt className={styles.resultTerm}>{result.term}</dt>
                <dd className={styles.resultDetail}>{result.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
