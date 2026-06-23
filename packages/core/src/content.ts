import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import { normalizeEventTitle, normalizeSourceUrl, slugifyEventTitle } from "./ids";
import { eventSchema, weeklyBriefSchema, type Event, type WeeklyBrief } from "./schema";

export type ContentLoaderOptions = {
  contentDir?: string;
  rootDir?: string;
};

export type EventContent = Event & {
  body: string;
  filePath: string;
  relativePath: string;
};

export type WeeklyBriefContent = WeeklyBrief & {
  body: string;
  filePath: string;
  relativePath: string;
};

export type ApprovedContent = {
  events: EventContent[];
  weeks: WeeklyBriefContent[];
};

export type DuplicateSourceUrl = {
  normalizedUrl: string;
  eventIds: string[];
  urls: string[];
};

export type ProbableDuplicateEvent = {
  date: string;
  eventIds: string[];
  reason: "same normalized title and date" | "same title slug and date";
};

const APPROVED_EVENT_DIR = ["approved", "events"] as const;
const APPROVED_WEEK_DIR = ["approved", "weeks"] as const;
const CONTENT_EXTENSIONS = new Set([".md", ".mdx"]);
const DENIED_LOCAL_ARTIFACT_DIRS = new Set([
  "drafts",
  "raw",
  "invalid",
  "rejected",
  "quality-reports",
  "run-logs",
  ".curation"
]);

function resolveContentDir(options: ContentLoaderOptions = {}) {
  return options.contentDir ?? join(options.rootDir ?? process.cwd(), "content");
}

function shouldIgnoreName(name: string) {
  return name.startsWith(".") || name.startsWith("._");
}

function shouldIgnoreDirectoryName(name: string) {
  return shouldIgnoreName(name) || DENIED_LOCAL_ARTIFACT_DIRS.has(name);
}

function hasContentExtension(name: string) {
  return [...CONTENT_EXTENSIONS].some((extension) => name.endsWith(extension));
}

async function findContentFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = await Promise.all(
    entries
      .filter((entry) => !shouldIgnoreName(entry.name))
      .map(async (entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (shouldIgnoreDirectoryName(entry.name)) {
            return [];
          }
          return findContentFiles(path);
        }
        if (entry.isFile() && hasContentExtension(entry.name)) {
          return [path];
        }
        return [];
      })
  );

  return files.flat().sort();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatZodError(filePath: string, error: z.ZodError) {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
  return `${filePath}: ${details}`;
}

async function parseFrontmatter<T>(
  filePath: string,
  contentDir: string,
  schema: z.ZodType<T>
): Promise<T & { body: string; filePath: string; relativePath: string }> {
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const displayPath = relative(contentDir, filePath) || filePath;

  if (!raw.trimStart().startsWith("---")) {
    throw new Error(`${displayPath}: missing frontmatter`);
  }

  const result = schema.safeParse(parsed.data);

  if (!result.success) {
    throw new Error(formatZodError(displayPath, result.error));
  }

  return {
    ...result.data,
    body: parsed.content,
    filePath,
    relativePath: displayPath
  };
}

export async function loadApprovedEvents(
  options: ContentLoaderOptions = {}
): Promise<EventContent[]> {
  const contentDir = resolveContentDir(options);
  const eventDir = join(contentDir, ...APPROVED_EVENT_DIR);
  const files = await findContentFiles(eventDir);
  const events = await Promise.all(
    files.map((file) => parseFrontmatter(file, contentDir, eventSchema))
  );

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export async function loadApprovedWeeks(
  options: ContentLoaderOptions = {}
): Promise<WeeklyBriefContent[]> {
  const contentDir = resolveContentDir(options);
  const weekDir = join(contentDir, ...APPROVED_WEEK_DIR);
  const files = await findContentFiles(weekDir);
  const weeks = await Promise.all(
    files.map((file) => parseFrontmatter(file, contentDir, weeklyBriefSchema))
  );

  return weeks.sort(
    (a, b) => a.week_start.localeCompare(b.week_start) || a.week_end.localeCompare(b.week_end)
  );
}

export async function loadApprovedContent(
  options: ContentLoaderOptions = {}
): Promise<ApprovedContent> {
  const [events, weeks] = await Promise.all([
    loadApprovedEvents(options),
    loadApprovedWeeks(options)
  ]);
  assertWeeklyEventIds(events, weeks);
  return { events, weeks };
}

export function assertWeeklyEventIds(events: Event[], weeks: WeeklyBrief[]) {
  const eventIds = new Set(events.map((event) => event.id));

  for (const week of weeks) {
    const referencedIds = [...week.headline_event_ids, ...week.watchlist_event_ids];
    const missingIds = referencedIds.filter((id) => !eventIds.has(id));
    if (missingIds.length > 0) {
      const filePath =
        "relativePath" in week && typeof week.relativePath === "string"
          ? week.relativePath
          : "weekly brief";
      throw new Error(`${filePath}: unknown event IDs: ${[...new Set(missingIds)].join(", ")}`);
    }
  }
}

export function detectDuplicateSourceUrls(events: Event[]): DuplicateSourceUrl[] {
  const groups = new Map<string, { eventIds: Set<string>; urls: string[] }>();

  for (const event of events) {
    for (const source of event.sources) {
      const normalizedUrl = normalizeSourceUrl(source.url);
      const group = groups.get(normalizedUrl) ?? { eventIds: new Set<string>(), urls: [] };
      group.eventIds.add(event.id);
      group.urls.push(source.url);
      groups.set(normalizedUrl, group);
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.urls.length > 1)
    .map(([normalizedUrl, group]) => ({
      normalizedUrl,
      eventIds: [...group.eventIds].sort(),
      urls: group.urls
    }))
    .sort((a, b) => a.normalizedUrl.localeCompare(b.normalizedUrl));
}

export function detectProbableDuplicateEvents(events: Event[]): ProbableDuplicateEvent[] {
  const titleGroups = groupEvents(events, (event) => `${event.date}:${normalizeEventTitle(event.title)}`);
  const slugGroups = groupEvents(events, (event) => `${event.date}:${slugifyEventTitle(event.title)}`);
  const seen = new Set<string>();

  return [
    ...formatProbableDuplicates(titleGroups, "same normalized title and date", seen),
    ...formatProbableDuplicates(slugGroups, "same title slug and date", seen)
  ].sort((a, b) => a.date.localeCompare(b.date) || a.eventIds.join(",").localeCompare(b.eventIds.join(",")));
}

function groupEvents(events: Event[], keyForEvent: (event: Event) => string) {
  const groups = new Map<string, Event[]>();
  for (const event of events) {
    const key = keyForEvent(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return groups;
}

function formatProbableDuplicates(
  groups: Map<string, Event[]>,
  reason: ProbableDuplicateEvent["reason"],
  seen: Set<string>
) {
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const eventIds = group.map((event) => event.id).sort();
      const key = eventIds.join("\u0000");
      if (seen.has(key)) {
        return undefined;
      }
      seen.add(key);
      return {
        date: group[0]?.date ?? "",
        eventIds,
        reason
      };
    })
    .filter((duplicate): duplicate is ProbableDuplicateEvent => Boolean(duplicate));
}
