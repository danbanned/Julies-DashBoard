// NextAuth handler. Static routes (/api/auth/google/*, /api/auth/signup)
// take precedence over this catch-all, so the existing Google Calendar OAuth
// routes are unaffected.
import { handlers } from "../../../../auth";

export const { GET, POST } = handlers;
