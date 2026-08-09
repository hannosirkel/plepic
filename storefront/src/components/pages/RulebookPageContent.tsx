/**
 * `/support/lunar-base/rulebook` — the rulebook stops living in Google
 * Drive. Served from `storefront/public/documents/lunar-base-rulebook.pdf`,
 * a byte-identical copy of the operator's verified master: **tagged, not
 * encrypted, 25 pages, and text-extractable** — `pdfinfo`/`pdftotext`
 * verified in the migration report, which also records the 8.9 MB size
 * decision (shipped as-is; recompressing it strips the tag structure this
 * checkbox requires).
 *
 * An `<object>` gives most browsers an inline, natively accessible PDF
 * viewer (the browser's own reader honours the file's tag structure and text
 * selection — nothing here re-implements that); its children are the
 * standards fallback content for a browser or assistive technology that
 * cannot render the object, so a screen reader user or a browser with no PDF
 * viewer at all still gets a working, styled link rather than a blank frame.
 */
import { SiteFooter } from "../SiteFooter.js";
import { SiteHeader } from "../SiteHeader.js";
import ctaStyles from "../../styles/mockups/call-to-action.module.css";
import styles from "../../styles/pages/rulebook.module.css";

const RULEBOOK_PATH = "/documents/lunar-base-rulebook.pdf";

export function RulebookPageContent() {
  return (
    <div data-layer="lunar" className={styles.page}>
      <SiteHeader wordmark="dark" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>Lunar Base rulebook</h1>
          <p className={styles.lede}>
            The complete rulebook, exactly as printed in the box — 25 pages, tagged and selectable rather than a
            scan, so you can search it, copy from it, and read it with a screen reader.
          </p>
          <div className={styles.actions}>
            <a className={`${ctaStyles.cta} ${ctaStyles.primary}`} href={RULEBOOK_PATH}>
              Open the rulebook (PDF)
            </a>
          </div>
        </div>

        <object className={styles.viewer} data={RULEBOOK_PATH} type="application/pdf" aria-label="Lunar Base rulebook">
          <p className={styles.fallback}>
            Your browser cannot display the rulebook inline. <a href={RULEBOOK_PATH}>Open the rulebook (PDF)</a>{" "}
            directly instead.
          </p>
        </object>
      </main>

      <SiteFooter />
    </div>
  );
}
