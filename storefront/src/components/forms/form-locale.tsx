/**
 * How a public form tells the Server Function that answers it which edition
 * it was rendered in.
 *
 * The function runs on the server with nothing but the posted fields, so the
 * edition travels as one of them. It is a value the client sends, and is read
 * as one: only a declared locale is believed, and anything else is answered
 * in the default edition. That includes no value at all, which is what the
 * default edition's own forms post. Their markup is what it was before a form
 * could be rendered in a second edition.
 */
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { isLocale } from "../../../../content/schema.js";

const FORM_LOCALE_FIELD = "locale";

/** The hidden control that carries `locale`. The default edition needs none. */
export function FormLocaleField({ locale }: { readonly locale: Locale }) {
  if (locale === DEFAULT_LOCALE) return null;
  return <input type="hidden" name={FORM_LOCALE_FIELD} value={locale} />;
}

/**
 * The edition to answer a post in.
 *
 * Invalid client input uses the default edition; every declared edition has
 * copy. This returns the locale and not the copy because the forms that render
 * `FormLocaleField` run in the browser, and a lookup here would ship every
 * edition's copy with them.
 */
export function postedLocale(formData: FormData): Locale {
  const posted = formData.get(FORM_LOCALE_FIELD);
  return isLocale(posted) ? posted : DEFAULT_LOCALE;
}
