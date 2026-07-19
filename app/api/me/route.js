// Who am I — used by the login page for role-based redirect and by client
// components that need session state without a provider.
import { NextResponse } from "next/server";
import { sessionUser } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await sessionUser();
  return NextResponse.json({ user });
}
