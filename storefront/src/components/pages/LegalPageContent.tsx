/**
 * The five legal pages, rendered.
 *
 * **They were not.** Every route under `src/app/legal/` returned
 * `RoutePlaceholder` — an `<h1>` and the page's own meta description — so
 * `/legal/imprint` served a heading and one sentence, and not one word of the
 * imprint, the withdrawal process, the VAT presentation, the checkout
 * acknowledgement or the privacy notice reached a visitor. `content/legal/*`
 * was complete, reviewed twice by qualified readers, and rendered by nothing.
 * Every structural test passed throughout, because each asked whether the
 * route answered 200 with a canonical, and it did.
 *
 * That is why this component exists rather than five hand-written pages: the
 * page is a projection of `content/legal/*`, section for section, in the order
 * the content declares, so a section added to the content model appears here
 * without an edit — and, more to the point, a section *deleted* from the
 * content model disappears from the page rather than lingering as markup
 * nobody updated.
 *
 * **That claim was only two-thirds true.** `LegalSection` carries `body`,
 * `items` *and* `links`, and this component read the first two. A link written
 * into the content model reached no visitor, which is precisely the defect
 * class this component exists to close — content the renderer does not read.
 * Every field the model carries is rendered now: `callout`, `body`, `items`,
 * `table` and `links`.
 *
 * ## The unconfigured state is loud, not quiet — about values
 *
 * Legal prose goes through `resolveRequiredProse`, never `resolvedParagraphs`.
 * A merchant detail this deployment has not configured is rendered as a named
 * gap — "[not configured: company registration number]" — and listed in a
 * notice at the top of the page. Every string this component renders takes that
 * path — `callout` lead, table cell and table note included — so a placeholder
 * cannot escape the treatment by moving between fields. See
 * `src/lib/configuration-placeholders.ts` for the argument; the short version
 * is that an imprint quietly missing its register number looks complete and is
 * not, and looking complete is the whole problem.
 *
 * **An unconfigured external destination is the opposite case and gets the
 * opposite treatment.** The notice is about missing *disclosures*, and a
 * destination is not one: `content/legal/terms.ts` names the Consumer Disputes
 * Committee in its own prose, which the operator and the qualified reviewer
 * confirmed on 2026-08-10 satisfies Article 6(1)(t) CRD by itself, so the
 * address only makes the remedy easier to reach. A link that resolves to no
 * `href` is therefore not rendered, and nothing else on the page changes. An
 * optional enhancement must not be able to make a legally complete page
 * announce itself as incomplete, which is what the previous revision did.
 * `src/components/mockups/link-target.ts` states the rule and why no
 * destination is in the other class.
 *
 * **The notice is built from one namespace only** — configuration placeholder
 * tokens — which is what makes "this notice is incomplete" mean exactly one
 * thing.
 *
 * ## Review status is visible, because it is a fact about the page
 *
 * All five are `draft-pending-operator-input`. That is a real property of what
 * is being served and the page says so; flipping it to `operator-approved` is
 * the operator's act, not this unit's and not this component's.
 */
import type { LegalPage } from "../../../../content/schema.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";
import {
  resolveCatalogue,
  resolveCataloguePlaceholders,
  type ResolvedCatalogue,
} from "../../lib/catalogue.js";
import {
  labelFor,
  resolveRequiredProse,
  type ConfigurationPlaceholderToken,
  type ConfigurationPlaceholderValues,
} from "../../lib/configuration-placeholders.js";
import { resolveLinkHref } from "../mockups/link-target.js";
import { SiteFooter } from "../SiteFooter.js";
import { SiteHeader } from "../SiteHeader.js";
import styles from "../../styles/pages/legal.module.css";

export interface LegalPageContentProps {
  readonly page: LegalPage;
  /** From runtime configuration (`getRuntimeConfig().merchant`), projected. */
  readonly values: ConfigurationPlaceholderValues;
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`). Absent
   * is the same as unconfigured, and unconfigured is a dropped link — no
   * destination is a required disclosure, so an unset one produces no gap
   * marker and no incompleteness notice. Defaulting to `{}` is a real default
   * rather than a shortcut: see this file's doc comment above and
   * `../mockups/link-target.ts`.
   */
  readonly externalTargets?: ExternalTargetUrls;
  /** Defaults to the mock catalogue's own product — see `src/lib/catalogue.ts`. */
  readonly catalogue?: ResolvedCatalogue;
}

export function LegalPageContent({
  page,
  values,
  externalTargets = {},
  catalogue = resolveCatalogue(),
}: LegalPageContentProps) {
  /*
   * Catalogue first, configuration second.
   *
   * `content/legal/shipping.ts` states the price a consumer pays as `{price}`,
   * in the callout the operator supplied, because a price written into a legal
   * page is a price that goes stale silently — which on the page that explains
   * VAT presentation is a misrepresentation rather than a typo. That makes a
   * **catalogue** token appear on a legal page, and the configuration resolver
   * has never known one. `{priceLine}` shipped here unresolved and unnoticed
   * for exactly as long as these routes rendered nothing.
   *
   * The two passes commute (no catalogue value contains a brace), but the
   * order is fixed anyway so that an unresolved catalogue token is never
   * mistaken for a missing legal disclosure and reported in the notice.
   */
  const resolveAll = (text: string): string => resolveCataloguePlaceholders(text, catalogue);

  const sections = page.body.map((section) => {
    const prose = resolveRequiredProse(section.body.map(resolveAll), values);

    /*
     * Everything that is not a paragraph — a callout line, a list term, a table
     * cell — goes through the same required-prose path, one string at a time,
     * with what was missing collected here. Resolving cell by cell keeps the
     * shape of the data (a table stays rows of cells) rather than flattening it
     * and slicing it back by stride, which is index arithmetic nobody should
     * have to check twice.
     */
    const missingHere = new Set<ConfigurationPlaceholderToken>();
    const resolveOne = (text: string): string => {
      const resolved = resolveRequiredProse([resolveAll(text)], values);
      for (const token of resolved.missing) missingHere.add(token);
      return resolved.paragraphs[0] ?? text;
    };

    /*
     * The operator's price presentation: an emphasised line and a plain one.
     * `lead` carries `{price}` today, and nothing stops a future one carrying a
     * configuration token, so it takes the same path as the prose around it.
     */
    const callout =
      section.callout === undefined
        ? undefined
        : {
            lead: resolveOne(section.callout.lead),
            detail: resolveOne(section.callout.detail),
          };

    const items = (section.items ?? []).map((item) => ({
      term: resolveOne(item.term),
      detail: resolveOne(item.detail),
    }));

    const table =
      section.table === undefined
        ? undefined
        : {
            caption: resolveOne(section.table.caption),
            columns: section.table.columns.map(resolveOne),
            rows: section.table.rows.map((row) => row.map(resolveOne)),
            notes: (section.table.notes ?? []).map(resolveOne),
          };

    /*
     * A link resolves to an href, or it does not, and the second case is a link
     * this page does not render. Nothing else changes: the disclosure lives in
     * the prose above, not in the destination — see this file's doc comment and
     * `../mockups/link-target.ts`.
     */
    const links = (section.links ?? []).flatMap((link) => {
      const href = resolveLinkHref(link.target, externalTargets);
      if (href === undefined) return [];
      return [{ link, href, external: link.target.kind === "external" }];
    });

    return {
      section,
      callout,
      paragraphs: prose.paragraphs,
      items,
      table,
      links,
      /*
       * Reader-facing labels rather than tokens, because the notice is a
       * sentence in the reader's namespace rather than the model's. One
       * namespace feeds it — configuration placeholder tokens — so every entry
       * is a disclosure this deployment has not supplied, and nothing else.
       */
      missing: [...prose.missing, ...missingHere].map(labelFor),
    };
  });

  /*
   * Sorted by the label a reader sees, not by the token behind it. Sorting by
   * token put "contact email address, registered company name, telephone
   * number, registered address" on the page — alphabetical in a namespace the
   * reader cannot see, and arbitrary in the one they can.
   *
   * The locale is explicit. `localeCompare` with none takes the runtime's
   * default, so the same build produced a different order in a container with
   * a different `LANG`, and the assertion pinned to it went red for a reason
   * that had nothing to do with the page.
   */
  const missing = [...new Set(sections.flatMap((entry) => entry.missing))].toSorted((a, b) =>
    a.localeCompare(b, "en"),
  );

  return (
    <div data-layer="publisher" className={styles.page}>
      <SiteHeader wordmark="primary" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>{page.title}</h1>
          <p className={styles.lede}>{page.description}</p>
        </div>

        {missing.length > 0 ? (
          <div role="alert" className={styles.notice} data-testid="legal-incomplete-notice">
            <p className={styles.noticeHeading}>This notice is incomplete.</p>
            {/*
              It deliberately does not say "write to us for it": the contact
              address is one of the details that can be missing, so that advice
              is unusable in exactly the case that produces it.
            */}
            <p className={styles.noticeBody}>
              {missing.length === 1 ? "This detail has" : "These details have"} not been configured
              for this deployment, and {missing.length === 1 ? "it is" : "they are"} marked in the
              text below: {missing.join(", ")}. Until{" "}
              {missing.length === 1 ? "it is" : "they are"} supplied, this page is not a complete
              legal notice and should not be relied on as one.
            </p>
          </div>
        ) : null}

        {page.reviewStatus === "draft-pending-operator-input" ? (
          <p className={styles.draftNote} data-testid="legal-draft-note">
            Draft, pending the operator&rsquo;s approval.
          </p>
        ) : null}

        {/*
          Keys are positional throughout this component. They used to be the
          paragraph text and the item term — content as identity, on the one
          component whose entire purpose is that no paragraph disappears.
          Two identical paragraphs are legitimate copy, and React would have
          treated them as one node.
        */}
        {sections.map(({ section, callout, paragraphs, items, table, links }) => (
          <section
            key={section.anchor}
            id={section.anchor}
            className={styles.section}
            aria-labelledby={`${section.anchor}-heading`}
          >
            <h2 id={`${section.anchor}-heading`} className={styles.sectionHeading}>
              {section.heading}
            </h2>
            {/*
              Ahead of the prose, because it is the statement the prose then
              explains — and because the operator supplied it as the first thing
              a reader meets under the heading. `<strong>` rather than a heavier
              class alone: the emphasis is semantic, not decorative.
            */}
            {callout !== undefined ? (
              <p className={styles.callout}>
                <strong className={styles.calloutLead}>{callout.lead}</strong>
                <span className={styles.calloutDetail}>{callout.detail}</span>
              </p>
            ) : null}
            {paragraphs.map((paragraph, index) => (
              <p key={`${section.anchor}-p${String(index)}`} className={styles.body}>
                {paragraph}
              </p>
            ))}
            {items.length > 0 ? (
              <dl className={styles.itemList}>
                {items.map((item, index) => (
                  <div key={`${section.anchor}-item${String(index)}`} className={styles.item}>
                    <dt className={styles.itemTerm}>{item.term}</dt>
                    <dd className={styles.itemDetail}>{item.detail}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {/*
              A four-column disclosure the two-column `items` shape cannot
              hold. The scroll container is its own element so that a table too
              wide for a 320px viewport scrolls inside itself rather than
              pushing the page sideways.
            */}
            {table !== undefined ? (
              <>
                {/*
                  `tabIndex` and a name because this container scrolls at narrow
                  viewports — the cookie table's min-content width is wider than
                  a 320px column and no font step closes that. A scrollable
                  region a keyboard cannot reach is a WCAG 2.1.1 failure that
                  nothing in this repository would have noticed.
                */}
                <div
                  className={styles.tableScroll}
                  role="region"
                  aria-label={table.caption}
                  tabIndex={0}
                >
                  <table className={styles.table}>
                    <caption className={styles.tableCaption}>{table.caption}</caption>
                    <thead>
                      <tr>
                        {table.columns.map((column, index) => (
                          <th
                            key={`${section.anchor}-col${String(index)}`}
                            scope="col"
                            className={styles.tableHeaderCell}
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={`${section.anchor}-row${String(rowIndex)}`}>
                          {row.map((cell, cellIndex) =>
                            cellIndex === 0 ? (
                              <th
                                key={`${section.anchor}-row${String(rowIndex)}-c${String(cellIndex)}`}
                                scope="row"
                                className={styles.tableRowHeader}
                              >
                                {cell}
                              </th>
                            ) : (
                              <td
                                key={`${section.anchor}-row${String(rowIndex)}-c${String(cellIndex)}`}
                                className={styles.tableCell}
                              >
                                {cell}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.notes.map((note, index) => (
                  <p key={`${section.anchor}-note${String(index)}`} className={styles.body}>
                    {note}
                  </p>
                ))}
              </>
            ) : null}
            {links.map(({ link, href, external }, index) => (
              <p key={`${section.anchor}-link${String(index)}`} className={styles.links}>
                <a
                  className={styles.link}
                  href={href}
                  /*
                   * WCAG 2.5.3 Label in Name: an accessible name that does not
                   * contain the visible text is worse than none, because a
                   * voice-control user says what they can see and nothing
                   * matches. Same rule, and the same reason, as
                   * `mockups/CallToActionLink.tsx`.
                   */
                  aria-label={
                    link.accessibleLabel !== undefined &&
                    link.accessibleLabel.includes(link.label)
                      ? link.accessibleLabel
                      : undefined
                  }
                  rel={external ? "noreferrer" : undefined}
                >
                  {link.label}
                </a>
              </p>
            ))}
          </section>
        ))}
      </main>

      <SiteFooter />
    </div>
  );
}
