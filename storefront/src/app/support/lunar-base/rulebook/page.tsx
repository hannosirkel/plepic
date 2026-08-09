import { makeMetadata, RoutePlaceholder } from "../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("rulebook");

export default function RulebookPage() {
  return <RoutePlaceholder routeId="rulebook" />;
}
