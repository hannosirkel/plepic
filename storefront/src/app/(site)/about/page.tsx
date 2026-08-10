import { AboutPageContent } from "../../../components/pages/AboutPageContent.js";
import { makeMetadata } from "../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("about");

export default function AboutPage() {
  return <AboutPageContent />;
}
