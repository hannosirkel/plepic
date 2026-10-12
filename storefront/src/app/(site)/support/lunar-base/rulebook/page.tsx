import { DEFAULT_LOCALE } from "../../../../../../../content/routes.js";
import { makeMetadata } from "../../../../../lib/page-shell.js";
import { RulebookRoute } from "../../../../localized-routes.js";

export const generateMetadata = makeMetadata("rulebook");

/** The default edition uses the same renderer as prefixed editions. */
export default function RulebookPage() {
  return <RulebookRoute routeId="rulebook" locale={DEFAULT_LOCALE} />;
}
