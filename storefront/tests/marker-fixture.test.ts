/**
 * The two scans the locale-aware page tests rest on, tested on their own.
 *
 * `home-edition.test.tsx` passes when the scans report nothing. A scan that
 * could not report anything would pass it too, so each is first shown to
 * find what it is for, in a fixture small enough to read.
 */
import { describe, expect, it } from "vitest";

import {
  MARK_CLOSE,
  MARK_OPEN,
  editionsMarkedIn,
  markedFor,
  unmarkedText,
} from "./helpers/marker-site-copy.js";
import { readerFacingLiterals } from "./helpers/reader-facing-literals.js";

describe("the marker scan", () => {
  it("reports a sentence, an alt and a label that are outside the markers", () => {
    expect(unmarkedText("<main><p>One plain sentence.</p></main>", [])).toEqual([
      "One plain sentence.",
    ]);
    expect(unmarkedText('<img alt="A plain picture"/>', [])).toEqual(["A plain picture"]);
    expect(unmarkedText('<section aria-label="Proof"></section>', [])).toEqual(["Proof"]);
  });

  it("reports the plain half of a string that is only partly marked", () => {
    const html = `<p>${markedFor("et", "Marked")} and then not</p>`;
    expect(unmarkedText(html, [])).toEqual(["and then not"]);
  });

  it("accepts marked text, a marked sentence an element splits, and text without letters", () => {
    const html =
      `<p>${MARK_OPEN}et:<em>Finally</em>, a sentence${MARK_CLOSE}</p>` +
      `<p>€24.00 — 100%</p><img alt="${markedFor("et", "It&#x27;s marked")}"/>`;
    expect(unmarkedText(html, [])).toEqual([]);
  });

  it("accepts a named exemption and still reports the words around it", () => {
    const html = "<p>Lunar Base</p><p>Buy Lunar Base today</p>";
    expect(unmarkedText(html, ["Lunar Base"])).toEqual(["Buy", "today"]);
  });

  it("names every edition whose marked sentences a page shows", () => {
    const html = `<p>${markedFor("et", "one")}</p><p>${markedFor("en", "two")}</p>`;
    expect(editionsMarkedIn(html)).toEqual(["et", "en"]);
    expect(editionsMarkedIn(`<p>${markedFor("et", "one")}${markedFor("et", "two")}</p>`)).toEqual([
      "et",
    ]);
  });
});

describe("the source scan", () => {
  it("finds a literal in each place one can be written, and nothing else", () => {
    const code = [
      '"use client";',
      'import { a } from "./a module.js";',
      'const error = valid ? null : "Enter your email address.";',
      'const label = "Subscribe";',
      'const emphasis = "primary";',
      "const count = `${n} items`;",
      "const key = `${a}-${b}`;",
      "export const View = () => (",
      '  <p className="two words" aria-label="Proof" alt={"Box"}>',
      "    Some text{label}",
      "  </p>",
      ");",
    ].join("\n");

    expect(readerFacingLiterals("fixture.tsx", code)).toEqual([
      "Enter your email address.",
      "Subscribe",
      " items",
      "Proof",
      "Box",
      "Some text",
    ]);
  });
});
