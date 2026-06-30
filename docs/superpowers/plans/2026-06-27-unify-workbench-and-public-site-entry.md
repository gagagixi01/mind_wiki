# Unified Workbench And Public Site Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the public reader and workbench into one browser entry on `http://127.0.0.1:3000`, while keeping the local backend as a separate service on `http://127.0.0.1:8001`.

**Architecture:** `apps/site` becomes the canonical browser host and gains a local-only `/workbench` view. The migrated workbench UI calls `packages/local-backend` directly through `http://127.0.0.1:8001`, with CORS handled by the backend. A post-build pruning script removes workbench export artifacts so published static output remains public-content-only.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing shadcn-style UI primitives, existing Vite workbench source, Node HTTP backend, Playwright, Vitest, pnpm.

---

## File Structure

- Create: `apps/site/components/workbench/local-workbench.tsx`
  - Client component adapted from `apps/workbench/src/App.tsx`.
  - Owns workbench state, local action buttons, backend API calls, and fallback states.
- Create: `apps/site/components/workbench/primitives.tsx`
  - Temporary local copy of the current workbench primitives so the migration can preserve behavior before later visual convergence.
- Create: `apps/site/components/workbench/workbench.css`
  - Temporary local copy of `apps/workbench/src/styles.css`, scoped to `.workbench-shell`.
- Create: `apps/site/app/workbench/page.tsx`
  - Local workbench page hosted by the Next app.
- Modify: `apps/site/app/layout.tsx`
  - Import workbench CSS so the local route can render correctly.
- Modify: `apps/site/components/public-site.tsx`
  - Add a workbench navigation entry and preserve the public reader shell.
- Modify: `packages/local-backend/src/routes.ts`
  - Add CORS and `OPTIONS` support for browser calls from `127.0.0.1:3000`.
- Modify: `packages/local-backend/src/routes.test.ts`
  - Verify CORS headers and preflight behavior.
- Create: `scripts/prune-local-workbench-output.mjs`
  - Remove `/workbench` static output and workbench chunks after `apps/site` export.
- Create: `scripts/prune-local-workbench-output.test.ts`
  - Verify the pruning script removes route files and leaves public files alone.
- Modify: `package.json`
  - Update `build` to run pruning after the site build.
- Modify: `playwright.config.ts`
  - Move the workbench project to `http://127.0.0.1:3000/workbench`.
  - Replace the standalone browser server with `dev:backend`.
- Modify: `e2e/workbench.spec.ts`
  - Update route from `/` to `/workbench`.
- Modify: `e2e/public-site.spec.ts`
  - Keep public reader assertions and strengthen static export protection.
- Modify: `README.md` and `scripts/README.md`
  - Document `3000` as the unified browser entry and `8001` as the local backend.

---

### Task 1: Backend Browser Boundary

**Files:**
- Modify: `packages/local-backend/src/routes.ts`
- Modify: `packages/local-backend/src/routes.test.ts`

- [ ] **Step 1: Add failing CORS tests**

Append these tests to `packages/local-backend/src/routes.test.ts`:

```ts
it("allows local site browser requests with CORS headers", async () => {
  const response = await handleApiRequest(new Request("http://127.0.0.1:8001/api/pipeline/status"), {
    rootDir
  });

  expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3000");
  expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  expect(response.headers.get("access-control-allow-methods")).toContain("POST");
});

it("handles local site CORS preflight requests", async () => {
  const response = await handleApiRequest(new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", {
    method: "OPTIONS",
    headers: {
      origin: "http://127.0.0.1:3000",
      "access-control-request-method": "POST"
    }
  }), {
    rootDir
  });

  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3000");
});
```

- [ ] **Step 2: Run backend route tests and verify failure**

Run: `pnpm --filter @mind-wiki/local-backend test -- src/routes.test.ts`

Expected: FAIL because CORS headers and `OPTIONS` handling are missing.

- [ ] **Step 3: Add CORS helpers**

In `packages/local-backend/src/routes.ts`, add this near the top after `RouteContext`:

```ts
const localSiteOrigin = "http://127.0.0.1:3000";

function withCorsHeaders(headers: HeadersInit = {}) {
  return {
    "access-control-allow-origin": localSiteOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    ...headers
  };
}
```

Then update `json`:

```ts
function json(data: unknown, init: ResponseInit = {}) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    ...init,
    headers: withCorsHeaders({
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {})
    })
  });
}
```

At the start of `handleApiRequest`, after `const options = ...`, add:

```ts
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: withCorsHeaders()
    });
  }
```

- [ ] **Step 4: Run backend route tests and verify pass**

Run: `pnpm --filter @mind-wiki/local-backend test -- src/routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/local-backend/src/routes.ts packages/local-backend/src/routes.test.ts
git commit -m "feat: allow local site to call backend"
```

---

### Task 2: Site-Hosted Workbench View

**Files:**
- Create: `apps/site/components/workbench/primitives.tsx`
- Create: `apps/site/components/workbench/local-workbench.tsx`
- Create: `apps/site/components/workbench/workbench.css`
- Modify: `apps/site/app/layout.tsx`

- [ ] **Step 1: Add failing workbench e2e route test**

Create `e2e/unified-workbench.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("unified workbench entry", () => {
  test("opens the local workbench from the site port", async ({ page }) => {
    await page.route("http://127.0.0.1:8001/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stale: false,
          visibleStage: "idle",
          counts: { candidates: 0, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 0 }
        })
      });
    });
    await page.route("http://127.0.0.1:8001/api/discovery-records", async (route) => {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.goto("/workbench");

    await expect(page).toHaveURL(/\/workbench$/);
    await expect(page.getByRole("heading", { name: "Local Curation Workbench" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run discovery" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the new e2e test and verify failure**

Run: `pnpm test:e2e e2e/unified-workbench.spec.ts --project=public-site`

Expected: FAIL with 404 or missing workbench heading.

- [ ] **Step 3: Copy primitives into the site app**

Create `apps/site/components/workbench/primitives.tsx` from `apps/workbench/src/components/ui/primitives.tsx` and add `"use client";` as the first line:

```ts
"use client";

import { useEffect, useId, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
```

Keep the existing `Button`, `Card`, `Badge`, `Progress`, `Skeleton`, `Empty`, `Textarea`, `Input`, `Select`, `Sheet`, and `StatusToast` exports unchanged.

- [ ] **Step 4: Copy workbench CSS into the site app**

Create `apps/site/components/workbench/workbench.css` from `apps/workbench/src/styles.css` without changing selectors. The copied file must keep `.workbench-shell` as its root selector so the styles do not leak into public reader views.

- [ ] **Step 5: Import workbench CSS in the root layout**

Update `apps/site/app/layout.tsx`:

```ts
import type { Metadata } from "next";
import "@mind-wiki/core/styles/tokens.css";
import "./globals.css";
import "@/components/workbench/workbench.css";
```

- [ ] **Step 6: Create the site workbench client component**

Create `apps/site/components/workbench/local-workbench.tsx` from `apps/workbench/src/App.tsx` with these exact edits:

```ts
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { APP_NAME } from "@mind-wiki/core";
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Progress,
  Select,
  Sheet,
  Skeleton,
  StatusToast,
  Textarea
} from "./primitives";

const defaultBackendBaseUrl = "http://127.0.0.1:8001";

async function fetchJson<T>(backendBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, backendBaseUrl), init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export function LocalWorkbench({
  backendBaseUrl = defaultBackendBaseUrl
}: {
  backendBaseUrl?: string;
}) {
```

Keep the current constants, types, state, JSX, and helper functions from `apps/workbench/src/App.tsx`, but update each API call:

```ts
setStatus(await fetchJson<PipelineStatus>(backendBaseUrl, "/api/pipeline/status"));
setDiscoveryRecords(await fetchJson<DiscoveryRecord[]>(backendBaseUrl, "/api/discovery-records"));
await fetchJson(backendBaseUrl, "/api/pipeline/discovery/run", { method: "POST" });
```

Close the component with the same JSX currently returned by `App`.

- [ ] **Step 7: Add the Next route**

Create `apps/site/app/workbench/page.tsx`:

```tsx
import { LocalWorkbench } from "@/components/workbench/local-workbench";

export default function WorkbenchPage() {
  return <LocalWorkbench />;
}
```

- [ ] **Step 8: Run the new e2e test and verify pass**

Run: `pnpm test:e2e e2e/unified-workbench.spec.ts --project=public-site`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/site/app/layout.tsx apps/site/app/workbench/page.tsx apps/site/components/workbench e2e/unified-workbench.spec.ts
git commit -m "feat: host workbench in site app"
```

---

### Task 3: Unified Navigation

**Files:**
- Modify: `apps/site/components/public-site.tsx`
- Modify: `e2e/public-site.spec.ts`

- [ ] **Step 1: Add failing navigation assertion**

In `e2e/public-site.spec.ts`, inside `desktop question router navigates public research views`, add:

```ts
await expect(page.getByRole("link", { name: "工作台" })).toBeVisible();
await expect(page.getByRole("link", { name: "工作台" })).toHaveAttribute("href", "/workbench");
```

- [ ] **Step 2: Run the public-site test and verify failure**

Run: `pnpm test:e2e e2e/public-site.spec.ts --project=public-site -g "desktop question router"`

Expected: FAIL because the workbench link is not in the site shell yet.

- [ ] **Step 3: Add the workbench nav item**

In `apps/site/components/public-site.tsx`, add `ClipboardList` to the `lucide-react` import and append this item to `navGroups[0].items`:

```ts
{ href: "/workbench", label: "工作台", icon: ClipboardList }
```

Update the sidebar descriptive copy:

```tsx
<p className="mt-3 text-xs leading-5 text-muted-foreground">公开研究导航 · 本地工作台</p>
```

- [ ] **Step 4: Run public navigation test and verify pass**

Run: `pnpm test:e2e e2e/public-site.spec.ts --project=public-site -g "desktop question router"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/components/public-site.tsx e2e/public-site.spec.ts
git commit -m "feat: add workbench to site navigation"
```

---

### Task 4: Static Export Pruning

**Files:**
- Create: `scripts/prune-local-workbench-output.mjs`
- Create: `scripts/prune-local-workbench-output.test.ts`
- Modify: `package.json`
- Modify: `e2e/public-site.spec.ts`

- [ ] **Step 1: Add failing prune script unit test**

Create `scripts/prune-local-workbench-output.test.ts`:

```ts
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { pruneLocalWorkbenchOutput } from "./prune-local-workbench-output.mjs";

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("pruneLocalWorkbenchOutput", () => {
  it("removes exported workbench files and keeps public files", async () => {
    const root = await mkdtemp(join(tmpdir(), "mind-wiki-prune-"));
    const out = join(root, "apps", "site", "out");
    await mkdir(join(out, "_next", "static", "chunks", "app", "workbench"), { recursive: true });
    await writeFile(join(out, "index.html"), "public");
    await writeFile(join(out, "workbench.html"), "Local Curation Workbench");
    await writeFile(join(out, "_next", "static", "chunks", "app", "workbench", "page.js"), "workbench chunk");

    await pruneLocalWorkbenchOutput(root);

    expect(await exists(join(out, "index.html"))).toBe(true);
    expect(await readFile(join(out, "index.html"), "utf8")).toBe("public");
    expect(await exists(join(out, "workbench.html"))).toBe(false);
    expect(await exists(join(out, "_next", "static", "chunks", "app", "workbench"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run script test and verify failure**

Run: `pnpm test scripts/prune-local-workbench-output.test.ts`

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Add the pruning script**

Create `scripts/prune-local-workbench-output.mjs`:

```js
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workbenchOutputPaths = [
  "apps/site/out/workbench.html",
  "apps/site/out/workbench.txt",
  "apps/site/out/workbench",
  "apps/site/out/_next/static/chunks/app/workbench"
];

export async function pruneLocalWorkbenchOutput(root = process.cwd()) {
  await Promise.all(
    workbenchOutputPaths.map((relativePath) =>
      rm(resolve(root, relativePath), { recursive: true, force: true })
    )
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await pruneLocalWorkbenchOutput();
}
```

- [ ] **Step 4: Run script test and verify pass**

Run: `pnpm test scripts/prune-local-workbench-output.test.ts`

Expected: PASS.

- [ ] **Step 5: Update root build script**

In `package.json`, change `build` to run pruning after the site build:

```json
"build": "pnpm --filter @mind-wiki/core build && pnpm --filter @mind-wiki/curation build && pnpm --filter @mind-wiki/local-backend build && pnpm --filter @mind-wiki/site build && node scripts/prune-local-workbench-output.mjs && pnpm --filter @mind-wiki/workbench build && pnpm clean:appledouble"
```

- [ ] **Step 6: Strengthen static export assertion**

In `e2e/public-site.spec.ts`, inside `static export excludes local files, workbench strings, and secret markers`, add:

```ts
expect(relativeFiles).not.toContain("workbench.html");
expect(relativeFiles.some((file) => file.includes("_next/static/chunks/app/workbench"))).toBe(false);
```

- [ ] **Step 7: Run build and static export test**

Run: `pnpm build`

Expected: PASS and `apps/site/out/workbench.html` absent.

Run: `pnpm test:e2e e2e/public-site.spec.ts --project=public-site -g "static export excludes"`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/prune-local-workbench-output.mjs scripts/prune-local-workbench-output.test.ts e2e/public-site.spec.ts
git commit -m "build: prune local workbench from static export"
```

---

### Task 5: Playwright Port Migration

**Files:**
- Modify: `playwright.config.ts`
- Modify: `e2e/workbench.spec.ts`

- [ ] **Step 1: Update workbench tests to use `/workbench`**

In `e2e/workbench.spec.ts`, replace each:

```ts
await page.goto("/");
```

with:

```ts
await page.goto("/workbench");
```

Update route mocks from same-origin API patterns to backend-port patterns where needed:

```ts
await page.route("http://127.0.0.1:8001/api/pipeline/status", async (route) => {
```

```ts
await page.route("http://127.0.0.1:8001/api/discovery-records", async (route) => {
```

- [ ] **Step 2: Update Playwright projects and servers**

In `playwright.config.ts`, change the workbench project to use `http://127.0.0.1:3000/workbench`:

```ts
{
  name: "workbench",
  testMatch: /workbench\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:3000/workbench"
  }
}
```

Replace the standalone browser web server with the backend:

```ts
{
  command: "pnpm dev:backend",
  url: "http://127.0.0.1:8001/api/pipeline/status",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000
}
```

- [ ] **Step 3: Run workbench e2e tests**

Run: `pnpm test:e2e e2e/workbench.spec.ts --project=workbench`

Expected: PASS with the browser on `3000/workbench` and mocked or real backend traffic targeting `8001`.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/workbench.spec.ts
git commit -m "test: run workbench through unified site entry"
```

---

### Task 6: Documentation And Final Launch Contract

**Files:**
- Modify: `README.md`
- Modify: `scripts/README.md`
- Modify: `openspec/changes/unify-workbench-and-public-site-entry/tasks.md`

- [ ] **Step 1: Update README setup text**

In `README.md`, replace the separate workbench launch section with:

````md
Run the unified browser entry:

```bash
pnpm dev:site
```

Run the local backend for curation actions:

```bash
pnpm dev:backend
```

The browser entry runs on `http://127.0.0.1:3000` by default. The local backend runs on `http://127.0.0.1:8001`.
````

- [ ] **Step 2: Update local workbench docs**

In `README.md`, replace the Local Workbench opening paragraph with:

```md
Use `pnpm dev:site` and open `/workbench` to use the local-only curation cockpit from the unified browser entry. Run `pnpm dev:backend` alongside it when you want real local pipeline status and actions.
```

- [ ] **Step 3: Update lifecycle script docs**

In `scripts/README.md`, add a sentence after the first paragraph:

```md
After the unified-entry change, this site process is also the primary browser entry for local workbench UI. Backend actions still require the separate `pnpm dev:backend` service on `http://127.0.0.1:8001`.
```

- [ ] **Step 4: Mark OpenSpec tasks complete as implementation finishes**

After all implementation tasks pass, update `openspec/changes/unify-workbench-and-public-site-entry/tasks.md` by changing each checkbox from `- [ ]` to `- [x]`.

- [ ] **Step 5: Run docs-relevant verification**

Run: `rg -n "8001|3000" README.md scripts/README.md package.json playwright.config.ts`

Expected: references explain `3000` as browser entry and `8001` as backend, with no old split-runtime workflow remaining.

- [ ] **Step 6: Commit**

```bash
git add README.md scripts/README.md openspec/changes/unify-workbench-and-public-site-entry/tasks.md
git commit -m "docs: describe unified workbench entry"
```

---

### Task 7: Final Verification

**Files:**
- No new files
- Verify all touched files

- [ ] **Step 1: Run type and unit tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `pnpm build`

Expected: PASS, with `apps/site/out/workbench.html` removed by `scripts/prune-local-workbench-output.mjs`.

- [ ] **Step 4: Run e2e**

Run: `pnpm test:e2e`

Expected: PASS. Playwright should use `3000` for public site and workbench browser tests, and `8001` for backend service tests.

- [ ] **Step 5: Inspect static output for local leakage**

Run:

```bash
rg -n "Local Curation Workbench|本地工作台|OPENAI_API_KEY|CURATION_STATE_DIR|\\.curation" apps/site/out
```

Expected: no matches.

- [ ] **Step 6: Commit final fixes if verification required changes**

```bash
git status --short
git add apps/site packages/local-backend scripts e2e README.md package.json playwright.config.ts openspec/changes/unify-workbench-and-public-site-entry/tasks.md
git commit -m "fix: stabilize unified workbench entry"
```

---

## Self-Review

- Spec coverage: `Unified product entry` is covered by Tasks 2, 3, and 5. `Shared navigation context` is covered by Task 3. `Local-only workbench access` is covered by Tasks 2, 4, and 5. `Public export protection` is covered by Task 4 and Task 7. `Backend split preserved` is covered by Tasks 1, 2, and 5.
- Completion scan: no unresolved markers or unspecified edge handling remains.
- Type consistency: `LocalWorkbench`, `backendBaseUrl`, `fetchJson`, `PipelineStatus`, and `DiscoveryRecord` names are consistent across the plan.
