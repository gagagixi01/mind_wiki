import type { Event, WeeklyBrief } from "./schema";

export const fixtureSource = {
  title: "Example research note",
  url: "https://example.com/research",
  source_type: "paper"
} satisfies Event["sources"][number];

export const fixtureEvent = {
  id: "2026-06-01-transformer-update",
  title: "Transformer Update",
  date: "2026-06-01",
  type: "architecture",
  summary: "A concise event summary.",
  why_it_matters: "It changes how teams reason about inference.",
  trajectories: ["llm_architecture"],
  sources: [fixtureSource],
  confidence: "observed",
  watchlist: ["Check independent replication."]
} satisfies Event;

export const fixtureWeeklyBrief = {
  week_start: "2026-06-01",
  week_end: "2026-06-07",
  thesis: "Architecture work was the center of gravity.",
  headline_event_ids: [fixtureEvent.id],
  watchlist_event_ids: [],
  closing_synthesis: "The week favored concrete implementation evidence."
} satisfies WeeklyBrief;
