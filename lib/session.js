// Session helpers (12a/12b). Role checks happen SERVER-SIDE here — hiding UI
// is not the privacy boundary, these are.
import { auth } from "../auth";

export async function sessionUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

// Returns the admin user or null — callers return 403 on null.
export async function requireAdmin() {
  const user = await sessionUser();
  return user && user.role === "ADMIN" ? user : null;
}
