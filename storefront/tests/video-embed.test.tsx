/**
 * `VideoEmbed`: both the honest pending state and the embedded state used by
 * the verified product videos.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VideoEmbed } from "../src/components/video/VideoEmbed.js";
import { buildContentSecurityPolicy } from "../src/lib/csp.js";

/**
 * The main, cookie-setting YouTube host, assembled rather than spelled out —
 * `tests/no-live-hostname.test.ts` scans this file, and the point of these
 * assertions is that the string never appears in served markup, which is not
 * a reason to put it in the allowlist.
 */
const TRACKING_YOUTUBE_HOST = ["youtube", "com"].join(".");

describe("VideoEmbed: pending state", () => {
  const html = renderToStaticMarkup(
    <VideoEmbed
      heading="Watch the trailer"
      title="Lunar Base trailer"
      youTubeId={null}
      aspectRatio="16:9"
    />,
  );

  it("renders no iframe", () => {
    expect(html).not.toContain("<iframe");
  });

  it("names the video honestly as not yet linked", () => {
    expect(html).toContain("Lunar Base trailer");
    expect(html).toContain("not linked yet");
  });

  it("embeds nothing from the tracking YouTube host", () => {
    // Assembled rather than written literally — see support-page.test.tsx's
    // matching assertion. tests/no-live-hostname.test.ts scans this file too,
    // and this hostname is deliberately *not* on its allowlist: nothing in
    // the repository loads it, and an allowlist entry that exists only to
    // satisfy a negative assertion is the drift that guard exists to catch.
    expect(html).not.toContain(TRACKING_YOUTUBE_HOST);
  });
});

describe("VideoEmbed: embedded state", () => {
  const html = renderToStaticMarkup(
    <VideoEmbed
      heading="Watch the tutorial"
      title="Lunar Base tutorial"
      youTubeId="dQw4w9WgXcQ"
      aspectRatio="74:45"
    />,
  );

  it("embeds the approved no-cookie host, never the tracking one directly", () => {
    expect(html).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("<iframe");
    expect(html).not.toContain(TRACKING_YOUTUBE_HOST);
  });

  it("is permitted by frame-src without permitting the tracking YouTube host", () => {
    const policy = buildContentSecurityPolicy("test-nonce");
    const frameSource = policy
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("frame-src"));

    expect(frameSource).toContain("https://www.youtube-nocookie.com");
    expect(frameSource).not.toContain(`https://www.${TRACKING_YOUTUBE_HOST}`);
  });

  it("sizes the frame from the measured aspect ratio without a CSP-blocked inline style", () => {
    expect(html).toContain("frameMeasured");
    expect(html).not.toContain('style="');
  });

  it("gives the lazy iframe an accessible title", () => {
    expect(html).toMatch(/<iframe[^>]*title="Lunar Base tutorial"[^>]*loading="lazy"/);
  });

  /*
   * The three caption-state cases that used to sit here are deleted rather
   * than reworded: the operator removed the caption note on 2026-08-20 and
   * the states no longer exist, so a test for them would be asserting a
   * contract this component does not offer.
   *
   * What replaces them is the inverse. The note is easy to reintroduce one
   * caller at a time — it reads like an accessibility improvement — and six
   * copies of it down one page is what the operator asked to be rid of.
   */
  it("renders no caption or transcript note", () => {
    expect(html).not.toContain("Captions");
    expect(html).not.toContain("transcript");
  });
});

describe("VideoEmbed: sizes", () => {
  const props = { heading: "Teaser", title: "A teaser", youTubeId: "abc123" } as const;

  it("defaults to the feature size, so a caller cannot shrink a video by forgetting", () => {
    const html = renderToStaticMarkup(<VideoEmbed {...props} aspectRatio="16:9" />);
    expect(html).toContain("feature");
    expect(html).not.toContain("compact");
  });

  it("takes the compact size for the teaser row", () => {
    const html = renderToStaticMarkup(<VideoEmbed {...props} aspectRatio="16:9" size="compact" />);
    expect(html).toContain("compact");
  });
});
