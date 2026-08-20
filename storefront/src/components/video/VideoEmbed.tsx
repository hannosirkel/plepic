/**
 * A YouTube video section: an aspect-ratio-aware embed when a video id is
 * configured, and an honest pending state when it is not.
 *
 * **Video stays on YouTube — the plan says so.** This component embeds; it
 * never receives or serves a video file itself (`storefront/public/` and
 * `no-live-hostname.test.ts`'s byte ceiling would refuse one anyway). The
 * local masters remain source evidence rather than public downloads. Callers
 * pass a verified public id when one exists and `null` only for an honest
 * pending state.
 *
 * **Aspect ratio is explicit, not assumed 16:9.** Callers pass the published
 * video's measured ratio; this component sizes its frame from it rather than
 * hard-coding one.
 *
 * ## The caption note is gone, and what that does and does not mean
 *
 * Every embed used to carry a line stating whether a caption track or a
 * transcript existed — in practice always "Captions and a transcript are not
 * available for this video yet." The operator removed it on 2026-08-20, when
 * the Watch section grew from two videos to six and the line would have been
 * repeated six times down one page.
 *
 * **Nothing in WCAG asked for that line.** SC 1.2.2 requires captions on
 * prerecorded synchronised media; it does not require a page to announce their
 * absence, and no arrangement of alt text, `aria-label` or `title` is a
 * substitute for the captions themselves — putting the disclosure in the
 * iframe's `title` would have renamed the video to "captions unavailable" and
 * had it read out on every focus. So removing the line costs no conformance
 * and gains none.
 *
 * **The underlying gap is real and is recorded elsewhere**, in the plan's
 * residuals, rather than repeated down the page: these videos are not known to
 * be captioned, and six uncaptioned embeds is a wider miss than two. Closing
 * it is a YouTube Studio action, not a change to this component. What this
 * file must not do is grow the line back one caller at a time; if caption
 * state becomes worth showing again, it belongs once per section, not once per
 * video.
 */

import styles from "./video-embed.module.css";

export interface VideoEmbedProps {
  readonly heading: string;
  /** The accessible name given to the embedded `<iframe>`. */
  readonly title: string;
  /** `null` when no real YouTube id is configured yet — renders the pending state. */
  readonly youTubeId: string | null;
  /** Measured source ratio, represented by one of the CSP-safe CSS classes. */
  readonly aspectRatio: "16:9" | "74:45";
  /**
   * `"feature"` — the trailer and the tutorial, one per row at full width.
   * `"compact"` — the teasers, four across on a wide viewport.
   *
   * A size rather than a width: the caller says what the video *is* in the
   * page's hierarchy and the stylesheet decides how big that is, so the four
   * teasers cannot end up larger than the tutorial by a caller passing a
   * number.
   */
  readonly size?: "feature" | "compact";
}

export function VideoEmbed({
  heading,
  title,
  youTubeId,
  aspectRatio,
  size = "feature",
}: VideoEmbedProps) {
  return (
    <div className={`${styles.wrapper} ${size === "compact" ? styles.compact : styles.feature}`}>
      <p className={styles.heading}>{heading}</p>

      {youTubeId === null ? (
        <p className={styles.pending}>
          <span className={styles.pendingLabel}>{title}</span> is not linked yet — it will be embedded from
          YouTube once a published video id is configured.
        </p>
      ) : (
        <div
          className={`${styles.frame} ${aspectRatio === "16:9" ? styles.frameWidescreen : styles.frameMeasured}`}
        >
          <iframe
            className={styles.iframe}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youTubeId)}`}
            title={title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
