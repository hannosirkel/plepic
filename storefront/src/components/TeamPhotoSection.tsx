/**
 * The team diagram, rebuilt as layout — a photograph and editable text, not a
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
 *    paragraph, not a grid of named headshots — so a later unit cannot
 *    "finish" it by inventing names into a layout that expects them.
 */
import { team } from "../../../content/publisher.js";
import styles from "../styles/team-photo-section.module.css";

export function TeamPhotoSection() {
  return (
    <section className={styles.section} aria-labelledby="team-heading">
      <img
        className={styles.photo}
        src="/images/team/team-1200.webp"
        srcSet="/images/team/team-640.webp 640w, /images/team/team-1200.webp 1200w, /images/team/team-2400.webp 2400w"
        sizes="(max-width: 720px) 100vw, 40rem"
        width={1200}
        height={900}
        loading="lazy"
        decoding="async"
        alt="The six people who make up Plepic Games, photographed together indoors with copies of the Lunar Base box on the table in front of them."
      />
      <div className={styles.copy}>
        <h2 id="team-heading" className={styles.heading}>
          {team.heading}
        </h2>
        {team.body.map((paragraph) => (
          <p key={paragraph} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
