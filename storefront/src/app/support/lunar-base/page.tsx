import { makeMetadata, RoutePlaceholder } from "../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("support");

export default function SupportPage() {
  return <RoutePlaceholder routeId="support" />;
}
