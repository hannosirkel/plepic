/**
 * `/` in the default edition. The page itself is `HomeRoute` in
 * `src/app/localized-routes.tsx`, which a prefixed edition's home page
 * renders too.
 */
import { DEFAULT_LOCALE } from "../../../../content/routes.js";
import { makeMetadata } from "../../lib/page-shell.js";
import { HomeRoute } from "../localized-routes.js";

export const generateMetadata = makeMetadata("home", DEFAULT_LOCALE);

export default function HomePage() {
  return <HomeRoute routeId="home" locale={DEFAULT_LOCALE} />;
}
