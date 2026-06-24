import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadApprovedContent } from "@mind-wiki/core/content";
import type { Confidence, EventType, Trajectory } from "@mind-wiki/core/schema";
import { approvedTrajectoryPrimerList } from "../../../content/approved/trajectories";

if (typeof window !== "undefined") {
  throw new Error("apps/site/lib/public-content.ts is server-only and must not be imported by client code.");
}

export type PublicSource = {
  title: string;
  url: string;
  sourceType: string;
};

export type PublicCausalLink = {
  sourceEventId: string;
  sourceEventTitle: string;
  targetEventId?: string;
  targetEventTitle?: string;
  targetConcept?: string;
  relationshipType: string;
  explanation: string;
  confidence: Confidence;
  sources: PublicSource[];
};

export type PublicEvent = {
  id: string;
  title: string;
  date: string;
  type: EventType;
  summary: string;
  whyItMatters: string;
  trajectories: Trajectory[];
  primaryTrajectory: Trajectory;
  sources: PublicSource[];
  confidence: Confidence;
  watchlist: boolean;
  providers: string[];
  causalLinks: PublicCausalLink[];
  relatedEvents: string[];
  body: string;
};

export type PublicWeek = {
  weekStart: string;
  weekEnd: string;
  thesis: string;
  headlineEventIds: string[];
  watchlistEventIds: string[];
  closingSynthesis: string;
  body: string;
};

export type PublicTrajectoryPrimer = {
  id: Trajectory;
  title: string;
  primer: string;
  watchQuestions: string[];
};

export type PublicSiteData = {
  latestWeek: PublicWeek;
  weeks: PublicWeek[];
  events: PublicEvent[];
  trajectories: PublicTrajectoryPrimer[];
  providers: string[];
  eventTypes: EventType[];
  confidenceLevels: Confidence[];
};

function resolveRootDir() {
  const candidates = [process.cwd(), join(process.cwd(), "../..")];
  const rootDir = candidates.find((candidate) => existsSync(join(candidate, "content", "approved")));

  if (!rootDir) {
    throw new Error("Unable to locate content/approved from site build cwd.");
  }

  return rootDir;
}

function mapSource(source: { title: string; url: string; source_type: string }): PublicSource {
  return {
    title: source.title,
    url: source.url,
    sourceType: source.source_type
  };
}

function primaryTrajectory(trajectories: Trajectory[]) {
  const primary = trajectories[0];
  if (!primary) {
    throw new Error("Approved events must include at least one trajectory.");
  }
  return primary;
}

export async function getPublicSiteData(): Promise<PublicSiteData> {
  const { events, weeks } = await loadApprovedContent({ rootDir: resolveRootDir() });
  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));

  const publicEvents: PublicEvent[] = events
    .map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      type: event.type,
      summary: event.summary,
      whyItMatters: event.why_it_matters,
      trajectories: event.trajectories,
      primaryTrajectory: primaryTrajectory(event.trajectories),
      sources: event.sources.map(mapSource),
      confidence: event.confidence,
      watchlist: event.watchlist,
      providers: event.providers ?? [],
      causalLinks: (event.causal_links ?? []).map((link) => ({
        sourceEventId: link.source_event_id,
        sourceEventTitle: eventTitleById.get(link.source_event_id) ?? link.source_event_id,
        targetEventId: link.target_event_id,
        targetEventTitle: link.target_event_id ? eventTitleById.get(link.target_event_id) : undefined,
        targetConcept: link.target_concept,
        relationshipType: link.relationship_type,
        explanation: link.explanation,
        confidence: link.confidence,
        sources: link.sources.map(mapSource)
      })),
      relatedEvents: event.related_events ?? [],
      body: event.body.trim()
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const publicWeeks: PublicWeek[] = weeks
    .map((week) => ({
      weekStart: week.week_start,
      weekEnd: week.week_end,
      thesis: week.thesis,
      headlineEventIds: week.headline_event_ids,
      watchlistEventIds: week.watchlist_event_ids,
      closingSynthesis: week.closing_synthesis,
      body: week.body.trim()
    }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const providers = [...new Set(publicEvents.flatMap((event) => event.providers))].sort((a, b) =>
    a.localeCompare(b)
  );
  const eventTypes = [...new Set(publicEvents.map((event) => event.type))].sort() as EventType[];
  const confidenceLevels = [...new Set(publicEvents.map((event) => event.confidence))].sort() as Confidence[];

  if (!publicWeeks[0]) {
    throw new Error("Approved public site requires at least one weekly brief.");
  }

  return {
    latestWeek: publicWeeks[0],
    weeks: publicWeeks,
    events: publicEvents,
    trajectories: approvedTrajectoryPrimerList,
    providers,
    eventTypes,
    confidenceLevels
  };
}
