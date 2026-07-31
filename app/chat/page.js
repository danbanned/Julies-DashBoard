// Newsletter subscribe page (Phase 19 — was the public Family Chat feed).
// Two audiences, handled by the client component: a logged-in viewer only
// picks neighborhood preferences (we already have their email from login);
// an anonymous visitor gets the full "give us your email" pitch.
import { sessionUser } from "../../lib/session";
import { prisma } from "../../lib/db";
import SubscribePage from "../../components/SubscribePage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Weekly Neighborhood Events — Julie Tours Philly" };

export default async function ChatPage() {
  const user = await sessionUser();
  let subscriber = null;
  if (user) {
    subscriber = await prisma.subscriber.findUnique({ where: { userId: user.id } });
  }

  return (
    <SubscribePage
      viewerEmail={user?.email || null}
      initialSubscriber={subscriber ? { neighborhoods: subscriber.neighborhoods, emailVerified: subscriber.emailVerified } : null}
    />
  );
}
