// Weekly achievement state (8h/8i): current week's four rows + history
// grouped by weekStart, newest first.
import { NextResponse } from "next/server";
import { sessionUser } from "../../../lib/session";
import { getAchievementState } from "../../../lib/achievementsEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ weekStart: null, week: [], history: [] });
  const state = await getAchievementState(user.id);
  return NextResponse.json(state);
}
