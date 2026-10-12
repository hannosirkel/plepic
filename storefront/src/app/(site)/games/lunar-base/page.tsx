import { DEFAULT_LOCALE } from "../../../../../../content/routes.js";
import { LunarBaseRoute } from "../../../localized-routes.js";
import { makeMetadata } from "../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("lunarBase");

/** The default edition uses the same renderer as prefixed editions. */
export default async function LunarBasePage() {
  return LunarBaseRoute({ routeId: "lunarBase", locale: DEFAULT_LOCALE });
}
