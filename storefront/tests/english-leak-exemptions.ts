import type { Locale } from "../../content/routes.js";
import { destinationNameIn, type Destination } from "../src/lib/destination.js";

/** Carrier brand and method name are the carrier's own labels. */
export const retainedEnglishPhrases: Readonly<Record<string, string>> = {
  "Omniva parcel machine": "Omniva names this carrier service; the branded method label is retained.",
  "Paul Grogan, Gaming Rules!": "The reviewer's name and publication are an attribution retained across editions.",
  "Rodney Smith, Watch It Played": "The reviewer's name and channel are an attribution retained across editions.",
};

/** ICU keeps proper names and has no Klingon region-name data. */
export function countryMayKeepEnglish(destination: Destination, locale: Locale): boolean {
  return destinationNameIn(destination, locale) === destination.name;
}

/** The parcel machine name is the carrier's name, shared across editions. */
export function methodMayKeepEnglish(methodId: string): boolean {
  return methodId === "omniva-parcel-machine";
}
