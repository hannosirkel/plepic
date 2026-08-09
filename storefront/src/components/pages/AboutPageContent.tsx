/**
 * The About page — built around the real team photograph
 * (`TeamPhotoSection`), the origin story, and a compact timeline.
 *
 * **Six founders, uniformly, not seven.** The checkbox's own text says "the
 * seven-friends origin"; the operator decided 2026-08-09 that the site says
 * six everywhere, because that is what the one genuine team photograph and
 * the evidence manifest both show. `content/publisher.ts`'s `publisherStory`
 * and `team` sections — which this page renders verbatim — already say six;
 * this component invents no headcount of its own.
 *
 * **No names or roles.** No roster exists in any source, and the operator
 * confirmed none is coming — a recorded, accepted deviation from the
 * checkbox's "names and roles in HTML." `team.body` is a photograph and one
 * paragraph, not a grid this component could "finish" by inventing names
 * into. The timeline below is the "compact timeline" the checkbox asks for,
 * and it never stands in as the page's only human element — the photograph
 * comes first.
 */
import { publisherSentence, publisherStory, timeline } from "../../../../content/publisher.js";
import { TeamPhotoSection } from "../TeamPhotoSection.js";
import { SiteFooter } from "../SiteFooter.js";
import { SiteHeader } from "../SiteHeader.js";
import styles from "../../styles/pages/about.module.css";

export function AboutPageContent() {
  return (
    <div data-layer="publisher" className={styles.page}>
      <SiteHeader wordmark="primary" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>About Plepic Games</h1>
          <p className={styles.lede}>{publisherSentence.text}</p>
        </div>

        <section id="story" className={styles.section} aria-labelledby="story-heading">
          <h2 id="story-heading" className={styles.sectionHeading}>
            {publisherStory.heading}
          </h2>
          <div className={styles.storyBody}>
            {publisherStory.body.map((paragraph) => (
              <p key={paragraph} className={styles.body}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section id="team" aria-labelledby="team-heading">
          <TeamPhotoSection />
        </section>

        <section id="timeline" className={styles.section} aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className={styles.sectionHeading}>
            Timeline
          </h2>
          <ol className={styles.timeline}>
            {timeline.map((entry) => (
              <li key={entry.term} className={styles.timelineItem}>
                <p className={styles.timelineTerm}>{entry.term}</p>
                <p className={styles.timelineDetail}>{entry.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
