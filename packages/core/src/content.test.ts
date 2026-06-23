import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  detectDuplicateSourceUrls,
  detectProbableDuplicateEvents,
  loadApprovedContent,
  loadApprovedEvents,
  loadApprovedWeeks
} from "./content";

async function makeContentRoot() {
  const root = await mkdtemp(join(tmpdir(), "mind-wiki-core-"));
  await mkdir(join(root, "approved", "events"), { recursive: true });
  await mkdir(join(root, "approved", "weeks"), { recursive: true });
  await mkdir(join(root, "drafts", "events"), { recursive: true });
  await mkdir(join(root, "approved", "events", ".local"), { recursive: true });
  return root;
}

function eventMdx(overrides: Record<string, unknown> = {}) {
  const frontmatter = {
    id: "2026-06-01-transformer-update",
    title: "Transformer Update",
    date: "2026-06-01",
    type: "architecture",
    summary: "A concise event summary.",
    why_it_matters: "It changes how teams reason about inference.",
    trajectories: ["llm_architecture"],
    sources: [
      {
        title: "Research note",
        url: "https://example.com/research#section",
        source_type: "paper"
      }
    ],
    confidence: "observed",
    watchlist: ["Check independent replication."],
    ...overrides
  };

  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\nBody copy`;
}

function weekMdx(overrides: Record<string, unknown> = {}) {
  const frontmatter = {
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    thesis: "Architecture work was the center of gravity.",
    headline_event_ids: ["2026-06-01-transformer-update"],
    watchlist_event_ids: [],
    closing_synthesis: "The week favored concrete implementation evidence.",
    ...overrides
  };

  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\nWeekly body`;
}

describe("approved content loaders", () => {
  it("loads only approved event MDX and ignores local artifacts", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(join(contentDir, "approved", "events", "event.mdx"), eventMdx());
    await writeFile(join(contentDir, "approved", "events", "._event.mdx"), eventMdx({ id: "ignored-appledouble" }));
    await writeFile(join(contentDir, "approved", "events", ".local", "hidden.mdx"), eventMdx({ id: "ignored-hidden" }));
    await writeFile(join(contentDir, "approved", "events", "notes.txt"), "not public content");
    await writeFile(join(contentDir, "drafts", "events", "draft.mdx"), eventMdx({ id: "ignored-draft" }));

    const events = await loadApprovedEvents({ contentDir });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("2026-06-01-transformer-update");
    expect(events[0]?.body.trim()).toBe("Body copy");
  });

  it("fails with a clear message when required event frontmatter is missing", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(
      join(contentDir, "approved", "events", "event.mdx"),
      eventMdx({ title: undefined })
    );

    await expect(loadApprovedEvents({ contentDir })).rejects.toThrow(
      /event\.mdx.*title.*Required/
    );
  });

  it("fails when event enum values are invalid", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(
      join(contentDir, "approved", "events", "event.mdx"),
      eventMdx({ confidence: "maybe" })
    );

    await expect(loadApprovedEvents({ contentDir })).rejects.toThrow(
      /event\.mdx.*confidence.*Invalid enum value/
    );
  });

  it("fails when weekly briefs reference unknown event IDs", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(join(contentDir, "approved", "events", "event.mdx"), eventMdx());
    await writeFile(
      join(contentDir, "approved", "weeks", "week.mdx"),
      weekMdx({ headline_event_ids: ["missing-event"] })
    );

    await expect(loadApprovedContent({ contentDir })).rejects.toThrow(
      /week\.mdx.*unknown event IDs: missing-event/
    );
  });

  it("loads weekly briefs that reference approved event IDs", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(join(contentDir, "approved", "events", "event.mdx"), eventMdx());
    await writeFile(join(contentDir, "approved", "weeks", "week.mdx"), weekMdx());

    const weeks = await loadApprovedWeeks({ contentDir });
    const content = await loadApprovedContent({ contentDir });

    expect(weeks).toHaveLength(1);
    expect(content.weeks[0]?.headline_event_ids).toEqual(["2026-06-01-transformer-update"]);
    expect(content.events[0]?.id).toBe("2026-06-01-transformer-update");
  });
});

describe("duplicate detection", () => {
  it("groups duplicate source URLs after normalizing hashes and trailing slashes", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(join(contentDir, "approved", "events", "one.mdx"), eventMdx());
    await writeFile(
      join(contentDir, "approved", "events", "two.mdx"),
      eventMdx({
        id: "2026-06-02-provider-release",
        title: "Provider Release",
        date: "2026-06-02",
        type: "model_release",
        trajectories: ["provider_releases"],
        sources: [
          {
            title: "Research mirror",
            url: "https://example.com/research/",
            source_type: "blog"
          }
        ]
      })
    );

    const events = await loadApprovedEvents({ contentDir });
    expect(detectDuplicateSourceUrls(events)).toEqual([
      {
        normalizedUrl: "https://example.com/research",
        eventIds: ["2026-06-01-transformer-update", "2026-06-02-provider-release"],
        urls: ["https://example.com/research#section", "https://example.com/research/"]
      }
    ]);
  });

  it("flags probable duplicate events with the same normalized title and date", async () => {
    const contentDir = await makeContentRoot();
    await writeFile(join(contentDir, "approved", "events", "one.mdx"), eventMdx());
    await writeFile(
      join(contentDir, "approved", "events", "two.mdx"),
      eventMdx({
        id: "2026-06-01-transformer-update-followup",
        title: "Transformer update!",
        sources: [
          {
            title: "Other source",
            url: "https://example.org/other",
            source_type: "news"
          }
        ]
      })
    );

    const events = await loadApprovedEvents({ contentDir });
    expect(detectProbableDuplicateEvents(events)).toEqual([
      {
        date: "2026-06-01",
        eventIds: [
          "2026-06-01-transformer-update",
          "2026-06-01-transformer-update-followup"
        ],
        reason: "same normalized title and date"
      }
    ]);
  });
});
