import { makeMetadata, RoutePlaceholder } from "../../lib/page-shell.js";

export const generateMetadata = makeMetadata("about");

export default function AboutPage() {
  return <RoutePlaceholder routeId="about" />;
}
