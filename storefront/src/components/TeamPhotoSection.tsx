/**
 * The team photograph and its caption — a photograph and editable text, not a
 * baked composite.
 *
 * Two decided facts constrain this component and it does not try to work
 * around either:
 *
 * 1. **Six founders, uniformly.** The evidence manifest's one genuine
 *    high-resolution photograph (`~/lunarsnips/lbteam.jpg`, 9248x6936) shows
 *    six people, so the copy in `content/publisher.ts` says six, and this
 *    component renders that copy rather than a caption of its own invention.
 * 2. **No names or roles.** No roster exists in any source the operator has
 *    supplied. This component has no slot for one — it is a photograph and a
 *    caption, not a grid of named headshots — so a later unit cannot "finish"
 *    it by inventing names into a layout that expects them.
 *
 * ## It is a figure, not a section
 *
 * It used to be a `<section>` with its own `<h2>` — "The six" — sitting below
 * the publisher story. The operator merged the two on 2026-08-20: one story
 * section, with the photograph beside the prose and the story's own heading
 * above both. So this renders a `<figure>` and no heading at all.
 *
 * That is also the accessible reading of what it now is. A `<section>` with a
 * heading announces itself as a distinct part of the document, and this is no
 * longer one — it is the illustration belonging to the section that encloses
 * it. `<figcaption>` says the text belongs to the image, which is what the
 * caption is: a note about the moment photographed, not a claim about the
 * company.
 */
import { team } from "../../../content/publisher.js";
import { withEmphasis } from "../lib/emphasis.js";
import styles from "../styles/team-photo-section.module.css";

export function TeamPhotoSection() {
  return (
    <figure className={styles.figure}>
      <img
        className={styles.photo}
        src="/images/team/team-1200.webp"
        srcSet="/images/team/team-640.webp 640w, /images/team/team-1200.webp 1200w, /images/team/team-2400.webp 2400w"
        sizes="(max-width: 860px) 100vw, 32rem"
        width={1200}
        height={900}
        loading="lazy"
        decoding="async"
        alt="The six people who make up Plepic Games, photographed together indoors with copies of the Lunar Base box on the table in front of them."
      />
      <figcaption className={styles.caption}>
        {team.body.map((paragraph) => (
          <span key={paragraph} className={styles.captionLine}>
            {withEmphasis(paragraph)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
