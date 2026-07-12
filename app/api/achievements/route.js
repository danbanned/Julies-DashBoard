// Weekly achievement state (8h/8i): current week's four rows + history
// grouped by weekStart, newest first.
import { NextResponse } from "next/server";
import { CURRENT_USER_ID } from "../../../lib/user";
import { getAchievementState } from "../../../lib/achievementsEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getAchievementState(CURRENT_USER_ID);
  return NextResponse.json(state);
}
