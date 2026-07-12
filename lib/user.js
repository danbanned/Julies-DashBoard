// Single-user mode (Phase 8): Julie is the only user, seeded in the DB.
// All queries filter by this id so real auth can swap in later without
// touching the data model.
export const CURRENT_USER_ID = "julie";
