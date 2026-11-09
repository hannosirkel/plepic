"use client";

/**
 * A YouTube video that loads YouTube only when the reader asks for it.
 *
 * Until then it is a link to the video's no-cookie player, showing the
 * video's own thumbnail (served from this site, see `posterFor`) under a play
 * mark. A press swaps the link for the player itself, already playing. Without
 * JavaScript the link still works: it opens the same player on its own.
 *
 * **Why not embed the player straight away.** An `<iframe>` of
 * `youtube-nocookie.com` still downloads YouTube's player, its scripts and
 * fonts, and lets that origin set cookies, the moment it is near the
 * viewport, for every reader, whether or not they play anything. On the
 * support page the tutorial sits near the top, so every visit paid for it,
 * and Lighthouse's best-practices audit counted the third-party cookie
 * against the page.
 */
import { useEffect, useRef, useState } from "react";

import styles from "./video-embed.module.css";

export interface VideoFacadeProps {
  readonly youTubeId: string;
  /** The video's title: the player's accessible name, and the link's after `watchLabel`. */
  readonly title: string;
  /** The edition's imperative "Watch" (`interface.product.watchHeading`). */
  readonly watchLabel: string;
  /** The frame classes `VideoEmbed` chose: the border and the measured aspect ratio. */
  readonly frameClassName: string;
}

/** The two widths of the poster under `public/images/video/`, named by video id. */
export function posterFor(youTubeId: string): { readonly src: string; readonly srcSet: string } {
  const base = `/images/video/${encodeURIComponent(youTubeId)}`;
  return { src: `${base}-960.webp`, srcSet: `${base}-480.webp 480w, ${base}-960.webp 960w` };
}

export function playerUrl(youTubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youTubeId)}`;
}

export function VideoFacade({ youTubeId, title, watchLabel, frameClassName }: VideoFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLIFrameElement>(null);
  const poster = posterFor(youTubeId);

  // The link the reader pressed is gone once the player replaces it, so focus
  // moves to the player rather than falling back to the document.
  useEffect(() => {
    if (playing) player.current?.focus();
  }, [playing]);

  return (
    <div className={frameClassName}>
      {playing ? (
        <iframe
          ref={player}
          className={styles.iframe}
          src={`${playerUrl(youTubeId)}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <a
          className={styles.facade}
          href={playerUrl(youTubeId)}
          onClick={(event) => {
            event.preventDefault();
            setPlaying(true);
          }}
        >
          <img
            className={styles.poster}
            src={poster.src}
            srcSet={poster.srcSet}
            sizes="(max-width: 720px) 92vw, 52rem"
            width={960}
            height={540}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <svg className={styles.playMark} viewBox="0 0 68 48" aria-hidden="true" focusable="false">
            <rect width="68" height="48" rx="12" />
            <path d="M27 15v18l16-9z" />
          </svg>
          <span className={styles.label}>
            {watchLabel} {title}
          </span>
        </a>
      )}
    </div>
  );
}
