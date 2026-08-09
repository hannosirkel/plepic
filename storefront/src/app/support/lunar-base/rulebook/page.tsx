import { RulebookPageContent } from "../../../../components/pages/RulebookPageContent.js";
import { makeMetadata } from "../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("rulebook");

export default function RulebookPage() {
  return <RulebookPageContent />;
}
