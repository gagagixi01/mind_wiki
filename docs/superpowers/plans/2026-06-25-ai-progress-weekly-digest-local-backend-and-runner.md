# AI Progress Weekly Digest Local Backend And Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the local-only backend API and whitelisted Codex CLI runner that turns the workbench into a real activation surface for manual discovery.

**Architecture:** `packages/local-backend` binds to `127.0.0.1` and exposes only typed pipeline endpoints. `packages/curation/src/codex-runner.ts` invokes Codex CLI with fixed repo cwd, structured input JSON, output refs under `.curation`, timeouts, and allowed skill names.

**Tech Stack:** TypeScript, Node HTTP server, Fetch `Request`/`Response`, execa, Zod schemas from `@mind-wiki/core`, curation helpers, Vitest.

---

## Task 1: Codex CLI Runner

**Files:**
- Create: `packages/curation/src/codex-runner.ts`
- Create: `packages/curation/src/codex-runner.test.ts`
- Modify: `packages/curation/package.json`
- Modify: `packages/curation/src/index.ts`

- [ ] **Step 1: Add dependency**

Add to `packages/curation/package.json` dependencies:

```json
"execa": "^9.6.0"
```

- [ ] **Step 2: Write failing runner tests**

Create `packages/curation/src/codex-runner.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runCodexSkill } from "./codex-runner";

async function makeRoot() {
  const rootDir = await mkdtemp(join(tmpdir(), "mind-wiki-runner-"));
  await mkdir(join(rootDir, ".agents", "skills", "ai-weekly-discovery"), { recursive: true });
  await writeFile(join(rootDir, ".agents", "skills", "ai-weekly-discovery", "SKILL.md"), "# Skill", "utf8");
  return rootDir;
}

describe("codex runner", () => {
  it("rejects non-whitelisted skills", async () => {
    const rootDir = await makeRoot();
    await expect(runCodexSkill({
      runId: "run-1",
      skillName: "shell-anything",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl: vi.fn()
    })).rejects.toThrow(/not whitelisted/);
  });

  it("writes input and output refs for allowed skills", async () => {
    const rootDir = await makeRoot();
    await runCodexSkill({
      runId: "run-1",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: { week_start: "2026-06-22" },
      timeoutMs: 1000,
      execaImpl: vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 })
    });
    await expect(readFile(join(rootDir, ".curation", "pipeline-runs", "run-1", "input.json"), "utf8"))
      .resolves.toContain("week_start");
    await expect(readFile(join(rootDir, ".curation", "agent-outputs", "run-1", "stdout.txt"), "utf8"))
      .resolves.toBe("ok");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm --filter @mind-wiki/curation test -- codex-runner.test.ts
```

Expected: FAIL because `codex-runner.ts` does not exist.

- [ ] **Step 4: Implement runner**

Create `packages/curation/src/codex-runner.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { allowedPipelineSkillNames, type AllowedPipelineSkillName } from "@mind-wiki/core/schema";

export type CodexRunnerOptions = {
  runId: string;
  skillName: string;
  rootDir: string;
  input: unknown;
  timeoutMs: number;
  execaImpl?: typeof execa;
};

const allowedEnv = ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "SEARXNG_BASE_URL", "CRAWL4AI_COMMAND", "TRAFILATURA_COMMAND"] as const;

function assertAllowedSkill(skillName: string): asserts skillName is AllowedPipelineSkillName {
  if (!allowedPipelineSkillNames.includes(skillName as AllowedPipelineSkillName)) {
    throw new Error(`${skillName} is not whitelisted`);
  }
}

function runnerEnv() {
  return Object.fromEntries(allowedEnv.flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
}

export async function runCodexSkill(options: CodexRunnerOptions) {
  assertAllowedSkill(options.skillName);
  await readFile(join(options.rootDir, ".agents", "skills", options.skillName, "SKILL.md"), "utf8")
    .catch(() => {
      throw new Error(`skill_missing: ${options.skillName}`);
    });

  const inputDir = join(options.rootDir, ".curation", "pipeline-runs", options.runId);
  const outputDir = join(options.rootDir, ".curation", "agent-outputs", options.runId);
  await Promise.all([mkdir(inputDir, { recursive: true }), mkdir(outputDir, { recursive: true })]);
  const inputPath = join(inputDir, "input.json");
  await writeFile(inputPath, `${JSON.stringify(options.input, null, 2)}\n`, "utf8");

  const result = await (options.execaImpl ?? execa)("codex", [
    "--ask-for-approval",
    "never",
    "--cd",
    options.rootDir,
    `Use ${options.skillName}. Read ${inputPath}. Write outputs under ${outputDir}. Do not write content/approved.`
  ], {
    cwd: options.rootDir,
    env: runnerEnv(),
    timeout: options.timeoutMs,
    reject: false
  });

  await writeFile(join(outputDir, "stdout.txt"), result.stdout ?? "", "utf8");
  await writeFile(join(outputDir, "stderr.txt"), result.stderr ?? "", "utf8");
  await writeFile(join(outputDir, "status.json"), `${JSON.stringify({
    exitCode: result.exitCode,
    skillName: options.skillName,
    inputPath,
    outputDir
  }, null, 2)}\n`, "utf8");

  return {
    exitCode: result.exitCode,
    outputRefs: [
      `.curation/agent-outputs/${options.runId}/stdout.txt`,
      `.curation/agent-outputs/${options.runId}/stderr.txt`,
      `.curation/agent-outputs/${options.runId}/status.json`
    ]
  };
}
```

- [ ] **Step 5: Export runner**

Add to `packages/curation/src/index.ts`:

```ts
export * from "./codex-runner";
```

- [ ] **Step 6: Verify runner tests pass**

Run:

```bash
pnpm --filter @mind-wiki/curation test -- codex-runner.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/curation/package.json packages/curation/src/codex-runner.ts packages/curation/src/codex-runner.test.ts packages/curation/src/index.ts
git commit -m "feat: add whitelisted codex runner"
```

## Task 2: Local Backend Package And Routes

**Files:**
- Create: `packages/local-backend/package.json`
- Create: `packages/local-backend/tsconfig.json`
- Create: `packages/local-backend/vitest.config.ts`
- Create: `packages/local-backend/src/routes.ts`
- Create: `packages/local-backend/src/server.ts`
- Create: `packages/local-backend/src/routes.test.ts`
- Modify: root `package.json`

- [ ] **Step 1: Create package files**

Create `packages/local-backend/package.json`:

```json
{
  "name": "@mind-wiki/local-backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@mind-wiki/core": "workspace:*",
    "@mind-wiki/curation": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.20.3",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

Create `packages/local-backend/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Create `packages/local-backend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" }
});
```

- [ ] **Step 2: Write failing route tests**

Create `packages/local-backend/src/routes.test.ts`:

```ts
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleApiRequest } from "./routes";

async function makeRoot() {
  const rootDir = await mkdtemp(join(tmpdir(), "mind-wiki-api-"));
  await mkdir(join(rootDir, "content", "approved", "events"), { recursive: true });
  return rootDir;
}

describe("local backend routes", () => {
  it("returns status without secrets", async () => {
    process.env.OPENAI_API_KEY = "secret-key";
    const response = await handleApiRequest(new Request("http://127.0.0.1:8001/api/pipeline/status"), {
      rootDir: await makeRoot(),
      now: () => new Date("2026-06-25T00:00:00.000Z")
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("visibleStage");
    expect(body).not.toContain("secret-key");
  });

  it("starts discovery through injected runner", async () => {
    const runner = vi.fn().mockResolvedValue({ outputRefs: [], exitCode: 0 });
    const response = await handleApiRequest(new Request("http://127.0.0.1:8001/api/pipeline/discovery/run", { method: "POST" }), {
      rootDir: await makeRoot(),
      now: () => new Date("2026-06-25T00:00:00.000Z"),
      runner
    });
    expect(response.status).toBe(202);
    expect(runner).toHaveBeenCalledWith(expect.objectContaining({ skillName: "ai-weekly-discovery" }));
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm --filter @mind-wiki/local-backend test
```

Expected: FAIL because route implementation does not exist.

- [ ] **Step 4: Implement routes**

Create `packages/local-backend/src/routes.ts`:

```ts
import {
  approveDraft,
  getPipelineStatus,
  rejectDraft,
  retryDraft,
  runCodexSkill,
  startDiscoveryRunRecord
} from "@mind-wiki/curation";

export type RouteContext = {
  rootDir: string;
  now?: () => Date;
  runner?: typeof runCodexSkill;
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers ?? {}) }
  });
}

export async function handleApiRequest(request: Request, context: RouteContext): Promise<Response> {
  const url = new URL(request.url);
  const options = { rootDir: context.rootDir, now: context.now };

  if (request.method === "GET" && url.pathname === "/api/pipeline/status") {
    return json(await getPipelineStatus(options));
  }

  if (request.method === "POST" && url.pathname === "/api/pipeline/discovery/run") {
    try {
      const run = await startDiscoveryRunRecord(options);
      await (context.runner ?? runCodexSkill)({
        runId: run.id,
        skillName: "ai-weekly-discovery",
        rootDir: context.rootDir,
        input: { run_id: run.id },
        timeoutMs: 600000
      });
      return json({ run }, { status: 202 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, { status: message.includes("active_run_exists") ? 409 : 500 });
    }
  }

  const draftMatch = /^\/api\/drafts\/([^/]+)\/(approve|reject|retry)$/.exec(url.pathname);
  if (request.method === "POST" && draftMatch) {
    const [, draftId, action] = draftMatch;
    const payload = await request.json().catch(() => ({}));
    if (action === "approve") {
      return json(await approveDraft(draftId, {
        ...options,
        filename: String(payload.filename),
        approvedMdx: String(payload.approvedMdx)
      }));
    }
    if (action === "reject") {
      return json(await rejectDraft(draftId, String(payload.reason ?? "Rejected from workbench."), options));
    }
    return json(await retryDraft(draftId, String(payload.reason ?? "Retry requested from workbench."), options));
  }

  return json({ error: "not_found" }, { status: 404 });
}
```

Create `packages/local-backend/src/server.ts`:

```ts
import { createServer } from "node:http";
import { handleApiRequest } from "./routes";

const host = "127.0.0.1";
const port = Number(process.env.MIND_WIKI_BACKEND_PORT ?? 8001);
const rootDir = process.env.MIND_WIKI_ROOT_DIR ?? process.cwd();

const server = createServer(async (nodeRequest, nodeResponse) => {
  const chunks: Buffer[] = [];
  for await (const chunk of nodeRequest) {
    chunks.push(Buffer.from(chunk));
  }
  const request = new Request(`http://${host}:${port}${nodeRequest.url ?? "/"}`, {
    method: nodeRequest.method,
    headers: nodeRequest.headers as HeadersInit,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined
  });
  const response = await handleApiRequest(request, { rootDir });
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => nodeResponse.setHeader(key, value));
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, host, () => {
  console.log(`mind_wiki local backend listening on http://${host}:${port}`);
});
```

- [ ] **Step 5: Add root script**

In root `package.json`, add:

```json
"dev:backend": "pnpm --filter @mind-wiki/local-backend dev"
```

- [ ] **Step 6: Verify backend tests and build**

Run:

```bash
pnpm --filter @mind-wiki/local-backend test
pnpm --filter @mind-wiki/local-backend build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json packages/local-backend
git commit -m "feat: add local backend api"
```
