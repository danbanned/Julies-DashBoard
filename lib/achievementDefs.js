// Achievement definitions shared by server engine and client UI.
// (No server imports here — this file is safe to bundle client-side.)
export const ACHIEVEMENT_DEFS = [
  {
    key: "event_explorer",
    label: "Event Explorer",
    icon: "📅",
    desc: "Attend 3 events this week",
  },
  {
    key: "community_spotlight",
    label: "Community Spotlight",
    icon: "📣",
    desc: "Share 3 events and get 3 views on them this week",
  },
  {
    key: "content_creator",
    label: "Content Creator",
    icon: "📸",
    desc: "Post about an event this week",
  },
  {
    key: "neighborhood_expert",
    label: "Neighborhood Expert",
    icon: "⭐",
    desc: "Attend an event in Fairmount, Brewerytown & Spring Garden this week",
  },
];

// Monday of the week containing `date`, as YYYY-MM-DD.
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
