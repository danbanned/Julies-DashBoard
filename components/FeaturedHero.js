"use client";

// Shared Featured Image hero-photo slot — reuses the exact classes/mechanism
// already built for ViewerApp.js's Home hero (.vPhotoHero/.vPhotoInner).
// Always rendered; hidden by default via [data-featured-only="true"] in
// Events.module.css and only shown when the nearest .shell ancestor has
// data-jw-layout="featured-image" — so pages using this on other Layouts see
// nothing extra (no empty band, no JS branching needed here). The seasonal
// photo swap (spring/summer/fall/winter) is the SAME generic
// html[data-jw-season] + .vPhotoHero CSS rule Home already uses — nothing
// new to wire per page.
import styles from "../app/Events.module.css";

export default function FeaturedHero({ title, subtitle }) {
  return (
    <section className={styles.vPhotoHero} data-featured-only="true">
      <div className={styles.vPhotoInner}>
        <h1 className={styles.vPhotoTitle}>{title}</h1>
        {subtitle && <p className={styles.vPhotoSub}>{subtitle}</p>}
      </div>
    </section>
  );
}
