import { makeMetadata, RoutePlaceholder } from "../lib/page-shell.js";

export const generateMetadata = makeMetadata("home");

export default function HomePage() {
  return <RoutePlaceholder routeId="home" />;
}
