/**
 * `/support/lunar-base/rulebook` — the rulebook stops living in Google
 * Drive. Served from `storefront/public/documents/lunar-base-rulebook.pdf`,
 * a byte-identical copy of the operator's verified master: **tagged, not
 * encrypted, 25 pages, and text-extractable** — `pdfinfo`/`pdftotext`
 * verified in the migration report, which also records the 8.9 MB size
 * decision (shipped as-is; recompressing it strips the tag structure this
 * checkbox requires).
 *
 * **This page links the PDF; it does not embed a viewer.** It shipped with an
 * inline `<object data="…pdf" type="application/pdf">`, and this
 * application's own Content-Security-Policy (`src/lib/csp.ts`) sends
 * `object-src 'none'`. Chromium refused it — *"Loading plugin data … violates
 * … "object-src 'none'". The action has been blocked."* — and painted an
 * empty bordered box roughly 1168×720. The doc comment here previously
 * claimed the opposite of what the page did.
 *
 * The `<object>` is gone rather than the policy widened: `object-src` is a
 * plugin-embedding directive on a public site, relaxing it is a security
 * decision well outside a page component, and it buys nothing here — the
 * link below already works, and every browser this site targets opens a PDF
 * natively from it, with its own reader honouring the file's tag structure
 * and text selection. The dead `.viewer`/`.fallback` rules were deleted from
 * `styles/pages/rulebook.module.css` with it, along with the one WCAG
 * contrast failure on the page: the fallback's unclassed `<a>` inherited the
 * user-agent `rgb(0, 0, 238)` on the Lunar layer's `rgb(27, 34, 86)`, which
 * measures 1.59:1 against a 4.5:1 requirement. Every link that remains on
 * this page is token-coloured.
 */
import { siteCopyFor } from "../../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { SiteFooter } from "../SiteFooter.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";
import { SiteHeader } from "../SiteHeader.js";
import ctaStyles from "../../styles/mockups/call-to-action.module.css";
import styles from "../../styles/pages/rulebook.module.css";

const RULEBOOK_PATH = "/documents/lunar-base-rulebook.pdf";

/**
 * 8,898,253 bytes, stated to one decimal place. Committed as-is: the
 * migration report records that Ghostscript recompression strips the
 * structure tree the "tagged and selectable rather than a scan" requirement
 * depends on. Since it cannot be made smaller without breaking it, the honest
 * thing is to tell a visitor on a metered connection what they are about to
 * fetch.
 */
const RULEBOOK_MEGABYTES = "8.9";

export interface RulebookPageContentProps {
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`), passed
   * to the footer's social row. Absent keeps it inert text.
   */
  readonly externalTargets?: ExternalTargetUrls;
  /** The edition whose copy and links this renders. The file is the same in every edition. */
  readonly locale?: Locale;
}

export function RulebookPageContent({
  externalTargets = {},
  locale = DEFAULT_LOCALE,
}: RulebookPageContentProps = {}) {
  const copy = siteCopyFor(locale).interface.rulebook;
  // The figure stays a text node of its own, as it was when the sentence was written here.
  const [beforeSize, afterSize] = copy.downloadNote.split("%megabytes%");

  return (
    <div data-layer="lunar" className={styles.page}>
      <SiteHeader wordmark="dark" locale={locale} route="rulebook" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>{copy.heading}</h1>
          <p className={styles.lede}>{copy.lede}</p>
          <div className={styles.actions}>
            <a className={`${ctaStyles.cta} ${ctaStyles.primary}`} href={RULEBOOK_PATH}>
              {copy.openLabel}
            </a>
          </div>
          <p className={styles.note}>
            {beforeSize}
            {RULEBOOK_MEGABYTES}
            {afterSize}
          </p>
        </div>
      </main>

      <SiteFooter locale={locale} route="rulebook" externalTargets={externalTargets} />
    </div>
  );
}
