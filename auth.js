// Auth.js (NextAuth v5) — Phase 12a foundation.
// Credentials (email + bcrypt) with JWT sessions. Roles: ADMIN (Julie) and
// VIEWER. Session maxAge is a year so Julie stays signed in indefinitely.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 365 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    // ADMIN — completely unchanged (21a explicitly scopes the magic-link
    // change to viewers only). Julie's login stays password + this provider.
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email || "").toLowerCase().trim();
        const password = String(creds?.password || "");
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (!bcrypt.compareSync(password, user.passwordHash)) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    // VIEWER — 21a magic link. A one-time token (emailed via Resend by
    // /api/auth/magic-link/request) stands in for a password; the token is
    // validated and cleared here, then a normal long-lived JWT session takes
    // over exactly like the credentials flow above.
    Credentials({
      id: "magic-link",
      credentials: { token: {} },
      authorize: async (creds) => {
        const token = String(creds?.token || "");
        if (!token) return null;
        const user = await prisma.user.findUnique({ where: { loginToken: token } });
        if (!user) return null;
        if (!user.loginTokenExpiresAt || user.loginTokenExpiresAt < new Date()) return null;
        // one-time use — clear immediately so the link can't be replayed
        await prisma.user.update({ where: { id: user.id }, data: { loginToken: null, loginTokenExpiresAt: null } });
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
