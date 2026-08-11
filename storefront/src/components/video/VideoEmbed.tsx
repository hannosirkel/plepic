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
 * **Captions or a transcript.** Neither exists for any of the three masters
 * today — no caption track and no transcript text were supplied, and
 * inventing either would be fabricating the video's own content, which the
 * plan forbids outright. `captionStatus` says so plainly rather than
 * omitting the question. Approved public videos use lazy, privacy-enhanced
 * embeds; a pending video has no caption obligation yet because it delivers
 * no video content to caption.
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
  /** What exists for this specific video: a caption track, a transcript, or neither yet. */
  readonly captionStatus: "captioned" | "transcript-only" | "not-yet-available";
  /** Required when `captionStatus` is `"transcript-only"`. */
  readonly transcriptHref?: string;
}

export function VideoEmbed({
  heading,
  title,
  youTubeId,
  aspectRatio,
  captionStatus,
  transcriptHref,
}: VideoEmbedProps) {
  return (
    <div className={styles.wrapper}>
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

      {youTubeId === null ? null : captionStatus === "captioned" ? (
        <p className={styles.captionNote}>Captions are available on this video.</p>
      ) : captionStatus === "transcript-only" && transcriptHref !== undefined ? (
        <p className={styles.captionNote}>
          No captions yet — read the <a href={transcriptHref}>transcript</a> instead.
        </p>
      ) : (
        <p className={styles.captionNote}>Captions and a transcript are not available for this video yet.</p>
      )}
    </div>
  );
}
