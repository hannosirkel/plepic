import { DEFAULT_LOCALE } from "../../../../../../content/routes.js";
import { makeMetadata } from "../../../../lib/page-shell.js";
import { SupportRoute } from "../../../localized-routes.js";

export const generateMetadata = makeMetadata("support");

/** The default edition uses the same renderer as prefixed editions. */
export default function SupportPage() {
  return <SupportRoute routeId="support" locale={DEFAULT_LOCALE} />;
}
