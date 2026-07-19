// Family Group Chat (12i) — PUBLIC page: anonymous visitors can read.
// Posts are created by Julie from the admin console.
import { prisma } from "../../lib/db";
import styles from "../Events.module.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Family Group Chat — Julie's Event" };

export default async function ChatPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      caption: true,
      coverImageUrl: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  return (
    <div className={styles.shell}>
      <header className={styles.vHero}>
        <div className={styles.vBrandRow}>
          <a className={styles.vSignIn} href="/">← Events</a>
          <span className={styles.vBrand}>Julie&apos;s Event</span>
          <span />
        </div>
        <h1 className={styles.vHeroTitle}>💬 Family Group Chat</h1>
        <p className={styles.vHeroSub}>Updates from Julie to the community.</p>
      </header>

      {posts.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.empty}>
            <h3>No posts yet</h3>
            <p>When Julie shares an update, it lands here.</p>
          </div>
        </div>
      ) : (
        posts.map((p) => (
          <article key={p.id} className={styles.panel}>
            {p.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.postCover} src={p.coverImageUrl} alt="" />
            )}
            <div className={styles.panelHead}><h2>{p.title}</h2></div>
            <p className={styles.postCaption}>{p.caption}</p>
            <p className={styles.postMeta}>
              {p.author?.name || "Julie"} ·{" "}
              {new Date(p.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </article>
        ))
      )}
    </div>
  );
}
