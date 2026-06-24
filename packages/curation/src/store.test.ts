import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadApprovedEvents } from "@mind-wiki/core/content";
import { describe, expect, it } from "vitest";

import { readRunLog } from "./run-log";
import {
  approveDraft,
  curationAreaDirs,
  ensureCurationDirs,
  inspectCurationRecord,
  rejectDraft,
  retryDraft,
  writeDraftRecord,
  writeJsonRecord,
  writeQualityReport
} from "./store";

async function makeWorkspaceRoot() {
  const root = await mkdtemp(join(tmpdir(), "mind-wiki-curation-"));
  await mkdir(join(root, "content", "approved", "events"), { recursive: true });
  return root;
}

function approvedEventMdx(id = "2026-06-01-transformer-update") {
  const frontmatter = {
    id,
    title: "Transformer Update",
    date: "2026-06-01",
    type: "architecture",
    summary: "A concise event summary.",
    why_it_matters: "It changes how teams reason about inference.",
    trajectories: ["llm_architecture"],
    sources: [
      {
        title: "Research note",
        url: "https://example.com/research",
        source_type: "paper"
      }
    ],
    confidence: "observed",
    watchlist: false
  };

  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\nApproved body`;
}

describe("local curation store", () => {
  it("creates local-only curation directories under the workspace root", async () => {
    const rootDir = await makeWorkspaceRoot();

    const dirs = await ensureCurationDirs(rootDir);

    expect(dirs.rootDir).toBe(join(rootDir, ".curation"));
    expect(Object.keys(dirs.areas).sort()).toEqual([...curationAreaDirs].sort());
    await Promise.all(
      curationAreaDirs.map(async (area) => {
        const areaStat = await stat(join(rootDir, ".curation", area));
        expect(areaStat.isDirectory()).toBe(true);
      })
    );
  });

  it("writes and inspects deterministic JSON records by curation area", async () => {
    const rootDir = await makeWorkspaceRoot();

    const written = await writeJsonRecord("raw", "source-1", { url: "https://example.com" }, { rootDir });
    const inspected = await inspectCurationRecord("raw", "source-1", { rootDir });

    expect(written.relativePath).toBe(".curation/raw/source-1.json");
    expect(inspected).toEqual({
      area: "raw",
      id: "source-1",
      data: { url: "https://example.com" },
      filePath: written.filePath,
      relativePath: ".curation/raw/source-1.json"
    });
  });

  it("rejects drafts by preserving the draft record in rejected and appending a rejection log", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeDraftRecord("draft-1", { title: "Needs work" }, { rootDir });

    const rejected = await rejectDraft("draft-1", "insufficient source quality", { rootDir });
    const rejectedRecord = await inspectCurationRecord("rejected", "draft-1", { rootDir });
    const logs = await readRunLog({ rootDir });

    expect(rejected.relativePath).toBe(".curation/rejected/draft-1.json");
    expect(rejectedRecord.data).toMatchObject({
      title: "Needs work",
      state: "rejected",
      rejection_reason: "insufficient source quality"
    });
    expect(logs.at(-1)).toMatchObject({
      eventType: "rejection",
      status: "success",
      message: "Rejected draft draft-1",
      refs: {
        draftId: "draft-1",
        reason: "insufficient source quality"
      }
    });
  });

  it("records retry intent only in run logs without creating approval-eligible draft files", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeDraftRecord("draft-1", { title: "Retry me" }, { rootDir });

    const retry = await retryDraft("draft-1", "source updated", { rootDir });
    const logs = await readRunLog({ rootDir });
    const draftFiles = await readdir(join(rootDir, ".curation", "drafts"));

    expect(retry).toMatchObject({
      eventType: "drafting",
      status: "retry_requested",
      message: "Retry requested for draft draft-1",
      refs: {
        draftId: "draft-1",
        reason: "source updated"
      }
    });
    expect(draftFiles).toEqual(["draft-1.json"]);
    expect(logs.at(-1)).toMatchObject({
      eventType: "drafting",
      status: "retry_requested",
      message: "Retry requested for draft draft-1"
    });
    await expect(
      approveDraft("draft-1.retry", {
        rootDir,
        filename: "retry.mdx",
        approvedMdx: approvedEventMdx("retry")
      })
    ).rejects.toThrow(/Retry records cannot be approved/);
  });

  it("approves only existing drafts and writes the explicit payload to content/approved/events", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeDraftRecord("draft-1", { title: "Ready for review" }, { rootDir });

    const approval = await approveDraft("draft-1", {
      rootDir,
      filename: "2026-06-01-transformer-update.mdx",
      approvedMdx: approvedEventMdx()
    });
    const events = await loadApprovedEvents({ rootDir });
    const logs = await readRunLog({ rootDir });

    expect(approval.relativePath).toBe("content/approved/events/2026-06-01-transformer-update.mdx");
    expect(events.map((event) => event.id)).toEqual(["2026-06-01-transformer-update"]);
    expect(logs.at(-1)).toMatchObject({
      eventType: "approval",
      status: "success",
      message: "Approved draft draft-1"
    });
  });

  it("does not approve missing drafts silently", async () => {
    const rootDir = await makeWorkspaceRoot();

    await expect(
      approveDraft("missing-draft", {
        rootDir,
        filename: "missing.mdx",
        approvedMdx: approvedEventMdx("missing-draft")
      })
    ).rejects.toThrow(/Draft missing-draft was not found/);

    await expect(readdir(join(rootDir, "content", "approved", "events"))).resolves.toEqual([]);
  });

  it("validates approved MDX before writing it to public content", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeDraftRecord("draft-1", { title: "Ready" }, { rootDir });

    await expect(
      approveDraft("draft-1", {
        rootDir,
        filename: "invalid-approved-event.mdx",
        approvedMdx: "---\nid: invalid-approved-event\n---\nMissing required fields"
      })
    ).rejects.toThrow(/Approved MDX did not validate/);

    await expect(readdir(join(rootDir, "content", "approved", "events"))).resolves.toEqual([]);
  });

  it("does not approve non-draft records", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeJsonRecord("invalid", "invalid-draft", { title: "Nope" }, { rootDir });

    await expect(
      approveDraft("invalid-draft", {
        rootDir,
        filename: "invalid.mdx",
        approvedMdx: approvedEventMdx("invalid-draft")
      })
    ).rejects.toThrow(/Draft invalid-draft was not found/);
  });

  it("fails approval on filename collisions and preserves the existing public file", async () => {
    const rootDir = await makeWorkspaceRoot();
    const approvedPath = join(rootDir, "content", "approved", "events", "collision.mdx");
    await writeDraftRecord("draft-1", { title: "Ready" }, { rootDir });
    await writeFile(approvedPath, approvedEventMdx("existing-event"));

    await expect(
      approveDraft("draft-1", {
        rootDir,
        filename: "collision.mdx",
        approvedMdx: approvedEventMdx("new-event")
      })
    ).rejects.toThrow(/Approved event file already exists/);

    await expect(readFile(approvedPath, "utf8")).resolves.toBe(approvedEventMdx("existing-event"));
  });

  it("rejects unsafe curation record ids and approved filenames", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeDraftRecord("draft-1", { title: "Ready" }, { rootDir });

    await expect(writeJsonRecord("raw", "../secret", { ok: false }, { rootDir })).rejects.toThrow(
      /Unsafe curation record id/
    );
    await expect(writeJsonRecord("raw", "nested/path", { ok: false }, { rootDir })).rejects.toThrow(
      /Unsafe curation record id/
    );
    await expect(
      approveDraft("draft-1", {
        rootDir,
        filename: "../event.mdx",
        approvedMdx: approvedEventMdx()
      })
    ).rejects.toThrow(/Unsafe approved event filename/);
    await expect(
      approveDraft("draft-1", {
        rootDir,
        filename: ".hidden.mdx",
        approvedMdx: approvedEventMdx()
      })
    ).rejects.toThrow(/Unsafe approved event filename/);
    await expect(
      approveDraft("draft-1", {
        rootDir,
        filename: "event.txt",
        approvedMdx: approvedEventMdx()
      })
    ).rejects.toThrow(/Unsafe approved event filename/);
  });

  it("keeps raw and draft artifacts invisible to approved content loaders until approval", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeJsonRecord("raw", "raw-mdx", { mdx: approvedEventMdx("raw-artifact") }, { rootDir });
    await writeDraftRecord("draft-mdx", { mdx: approvedEventMdx("draft-artifact") }, { rootDir });
    await writeQualityReport("report-1", { status: "needs_review" }, { rootDir });
    await mkdir(join(rootDir, "content", "drafts", "events"), { recursive: true });
    await writeFile(join(rootDir, "content", "drafts", "events", "draft.mdx"), approvedEventMdx("content-draft"));

    await expect(loadApprovedEvents({ rootDir })).resolves.toEqual([]);

    await approveDraft("draft-mdx", {
      rootDir,
      filename: "2026-06-01-transformer-update.mdx",
      approvedMdx: approvedEventMdx()
    });

    const events = await loadApprovedEvents({ rootDir });
    expect(events.map((event) => event.id)).toEqual(["2026-06-01-transformer-update"]);
  });

  it("appends JSONL run logs for extraction, validation, and duplicate warnings", async () => {
    const rootDir = await makeWorkspaceRoot();
    await writeJsonRecord("raw", "source-1", { ok: true }, { rootDir, logEvent: "extraction" });
    await writeJsonRecord("invalid", "draft-1", { errors: ["missing title"] }, { rootDir, logEvent: "validation" });
    await writeJsonRecord(
      "quality-reports",
      "duplicate-1",
      { eventIds: ["one", "two"] },
      { rootDir, logEvent: "duplicate_warning" }
    );

    const rawLog = await readFile(join(rootDir, ".curation", "run-logs", "curation.jsonl"), "utf8");
    const logs = rawLog.trim().split("\n").map((line) => JSON.parse(line) as { eventType: string });

    expect(logs.map((log) => log.eventType)).toEqual([
      "extraction",
      "validation",
      "duplicate_warning"
    ]);
  });
});
