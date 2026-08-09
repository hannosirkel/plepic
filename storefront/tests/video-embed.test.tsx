/**
 * `VideoEmbed`: the pending state (every call site in this unit, since no
 * real YouTube id exists yet — see the component's doc comment) and the
 * embedded state, exercised with a fixture id so the component itself is
 * proven correct independently of whether a real id is ever supplied.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VideoEmbed } from "../src/components/video/VideoEmbed.js";

describe("VideoEmbed: pending state", () => {
  const html = renderToStaticMarkup(
    <VideoEmbed
      heading="Watch the trailer"
      title="Lunar Base trailer"
      youTubeId={null}
      aspectRatio={16 / 9}
      captionStatus="not-yet-available"
    />,
  );

  it("renders no iframe", () => {
    expect(html).not.toContain("<iframe");
  });

  it("names the video honestly as not yet linked", () => {
    expect(html).toContain("Lunar Base trailer");
    expect(html).toContain("not linked yet");
  });

  it("embeds nothing from youtube.com", () => {
    expect(html).not.toContain("youtube.com");
  });
});

describe("VideoEmbed: embedded state", () => {
  const html = renderToStaticMarkup(
    <VideoEmbed
      heading="Watch the tutorial"
      title="Lunar Base tutorial"
      youTubeId="dQw4w9WgXcQ"
      aspectRatio={1184 / 720}
      captionStatus="not-yet-available"
    />,
  );

  it("embeds youtube-nocookie.com, not youtube.com directly", () => {
    expect(html).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("gives the iframe an accessible title", () => {
    expect(html).toContain('title="Lunar Base tutorial"');
  });

  it("lazy-loads the iframe", () => {
    expect(html).toMatch(/<iframe[^>]*loading="lazy"/);
  });

  it("sizes the frame from the measured aspect ratio, not a hard-coded 16:9", () => {
    expect(html).toMatch(/aspect-ratio:\s*1\.6444/);
  });

  it("says plainly that no caption or transcript exists yet", () => {
    expect(html).toContain("Captions and a transcript are not available for this video yet.");
  });
});

describe("VideoEmbed: caption states", () => {
  it("reports a captioned video", () => {
    const html = renderToStaticMarkup(
      <VideoEmbed
        heading="Watch"
        title="A captioned video"
        youTubeId="abc123"
        aspectRatio={16 / 9}
        captionStatus="captioned"
      />,
    );
    expect(html).toContain("Captions are available on this video.");
  });

  it("links a transcript when only a transcript exists", () => {
    const html = renderToStaticMarkup(
      <VideoEmbed
        heading="Watch"
        title="A transcribed video"
        youTubeId="abc123"
        aspectRatio={16 / 9}
        captionStatus="transcript-only"
        transcriptHref="/support/lunar-base#transcript"
      />,
    );
    expect(html).toMatch(/<a href="\/support\/lunar-base#transcript">transcript<\/a>/);
  });
});
