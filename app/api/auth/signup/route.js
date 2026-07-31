// Viewer password sign-up — RETIRED (21a). Viewers now authenticate via
// magic link (/api/auth/magic-link/request); creating a password-based
// viewer account is no longer supported so this endpoint can't be used to
// bypass that. Admin accounts were never created here and still aren't.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Password sign-up has been replaced by email sign-in — see /login." },
    { status: 410 }
  );
}
