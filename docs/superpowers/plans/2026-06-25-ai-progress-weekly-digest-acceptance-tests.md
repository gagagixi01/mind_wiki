# AI Progress Weekly Digest Acceptance Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-subsystem tests proving the optimized public site, local workbench, backend pipeline, and static export boundaries satisfy the specs.

**Architecture:** Use Vitest for filesystem/static-output checks and Playwright for browser behavior. Tests run after subsystem implementation plans have landed.

**Tech Stack:** Playwright, Vitest, pnpm scripts, Next.js static output, Vite workbench.

---

## Task 1: Public Site Playwright Coverage

**Files:**
- Create: `e2e/ai-progress-public.spec.ts`
- Modify: `package.json` only if the existing Playwright config does not discover `e2e/**/*.spec.ts`

- [ ] **Step 1: Create public UI tests**

Create `e2e/ai-progress-public.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("public sidebar uses question labels and excludes global trajectory choices", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "本周" })).toBeVisible();
  await expect(page.getByRole("link", { name: "长期趋势" })).toBeVisible();
  await expect(page.getByRole("link", { name: "因果链" })).toBeVisible();
  await expect(page.getByRole("link", { name: "提供方" })).toBeVisible();
  await expect(page.getByRole("link", { name: "来源" })).toBeVisible();
  await expect(page.getByRole("navigation").getByText("LLM 架构")).toHaveCount(0);
});

test("event card opens detail sheet and trajectory link navigates separately", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button").filter({ hasText: /Transformer|GPT|ChatGPT|NVIDIA|Mamba/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "为什么关键" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: /View in trajectory/ }).first().click();
  await expect(page).toHaveURL(/\/trajectories\//);
});

test("public sources expose approved source metadata only", async ({ page }) => {
  await page.goto("/sources");
  await expect(page.getByText("source-packs")).toHaveCount(0);
  await expect(page.getByText("discovery-records")).toHaveCount(0);
  await expect(page.getByText("run-logs")).toHaveCount(0);
  await expect(page.getByText(".curation")).toHaveCount(0);
});
```

- [ ] **Step 2: Run public e2e tests**

Run:

```bash
pnpm test:e2e e2e/ai-progress-public.spec.ts
```

Expected: PASS when the site dev server is configured in Playwright. If no Playwright web server is configured yet, add a `webServer` entry that runs `pnpm dev:site`.

- [ ] **Step 3: Commit**

```bash
git add e2e/ai-progress-public.spec.ts package.json playwright.config.ts
git commit -m "test: cover public ai digest UI"
```

## Task 2: Workbench Playwright Coverage

**Files:**
- Create: `e2e/workbench-pipeline.spec.ts`
- Modify: `playwright.config.ts` if needed

- [ ] **Step 1: Create workbench tests**

Create `e2e/workbench-pipeline.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("workbench first viewport shows pipeline controls", async ({ page }) => {
  await page.route("**/api/pipeline/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        stale: false,
        visibleStage: "idle",
        counts: { candidates: 0, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 0 }
      })
    });
  });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByRole("button", { name: "Run discovery" })).toBeVisible();
  await expect(page.getByText("待运行")).toBeVisible();
});

test("active discovery disables duplicate trigger", async ({ page }) => {
  await page.route("**/api/pipeline/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        activeRun: { id: "run-1", stage: "discovering", started_at: "2026-06-25T00:00:00.000Z" },
        stale: false,
        visibleStage: "discovering",
        counts: { candidates: 3, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 2 }
      })
    });
  });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByRole("button", { name: "运行中" })).toBeDisabled();
  await expect(page.getByText("正在通过 RSS 和 web search 查找候选来源。")).toBeVisible();
});

test("failure state names the failure and retry action", async ({ page }) => {
  await page.route("**/api/pipeline/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        latestCompletedRun: {
          id: "run-1",
          stage: "failed",
          error: {
            message_zh: "本地搜索服务不可用。",
            source_pack_id: "provider-blogs",
            suggested_next_action: "启动 SearXNG 后重试。"
          }
        },
        stale: false,
        visibleStage: "failed",
        counts: { candidates: 0, drafts: 0, failures: 1, readyForReview: 0, sourcePacks: 1 }
      })
    });
  });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByText("本地搜索服务不可用。")).toBeVisible();
  await expect(page.getByRole("button", { name: "重试失败步骤" })).toBeVisible();
});
```

- [ ] **Step 2: Run workbench e2e tests**

Run:

```bash
pnpm test:e2e e2e/workbench-pipeline.spec.ts
```

Expected: PASS when the workbench dev server is running at `127.0.0.1:5173`.

- [ ] **Step 3: Commit**

```bash
git add e2e/workbench-pipeline.spec.ts playwright.config.ts
git commit -m "test: cover workbench pipeline UI"
```

## Task 3: Static Output Boundary Test

**Files:**
- Create: `apps/site/static-output-boundary.test.ts`

- [ ] **Step 1: Create static output test**

Create `apps/site/static-output-boundary.test.ts`:

```ts
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function allFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  }));
  return nested.flat();
}

describe("static public output", () => {
  it("excludes local pipeline state and secrets", async () => {
    const files = await allFiles(join(process.cwd(), "out"));
    const paths = files.join("\n");
    expect(paths).not.toContain(".curation");
    expect(paths).not.toContain("source-packs");
    expect(paths).not.toContain("discovery-records");

    for (const file of files.filter((path) => /\.(html|txt|js)$/.test(path))) {
      const content = await readFile(file, "utf8");
      expect(content).not.toContain("OPENAI_API_KEY");
      expect(content).not.toContain("run-logs");
      expect(content).not.toContain("agent-outputs");
    }
  });
});
```

- [ ] **Step 2: Run static output test after build**

Run:

```bash
pnpm --filter @mind-wiki/site build
pnpm --filter @mind-wiki/site test -- static-output-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/site/static-output-boundary.test.ts
git commit -m "test: guard public static output boundary"
```

## Task 4: Full Verification

**Files:**
- Modify: none unless prior test setup requires `playwright.config.ts`

- [ ] **Step 1: Run all verification commands**

Run:

```bash
pnpm clean:appledouble
pnpm test
pnpm build
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 2: Commit final test wiring**

If `playwright.config.ts`, `package.json`, or test scripts changed in this task, commit them:

```bash
git add playwright.config.ts package.json
git commit -m "test: wire ai digest acceptance suite"
```

If there are no additional changes, record the passing command output in the implementation handoff.
