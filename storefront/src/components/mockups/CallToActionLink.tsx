import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { resolveLocalizedLink } from "./link-target.js";
import { CallToActionAnchor, type CallToActionContentProps } from "./CallToActionAnchor.js";

export interface CallToActionLinkProps extends CallToActionContentProps {
  /**
   * The edition of the page this link is on. A route target is linked inside
   * that edition where the edition publishes the route, and at the default
   * edition's URL, marked with its language, where it does not -- see
   * `resolveLocalizedLink` in `link-target.ts`. Defaults to the default
   * locale, whose links are the unprefixed ones every call site that passes
   * nothing has always rendered.
   */
  readonly locale?: Locale;
}

/**
 * Renders one `CallToAction` on a page served in `locale`: resolves its target
 * there (`resolveLocalizedLink`) and hands the rest to `CallToActionAnchor`,
 * which holds the rendering rules.
 */
export function CallToActionLink({ action, resolveLabel, note, locale = DEFAULT_LOCALE }: CallToActionLinkProps) {
  const { href, hrefLang } = resolveLocalizedLink(locale, action.target);
  return <CallToActionAnchor action={action} resolveLabel={resolveLabel} note={note} href={href} hrefLang={hrefLang} />;
}
