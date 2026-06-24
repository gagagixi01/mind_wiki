import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { readRunLog } from "./run-log";
import {
  draftEventFromExtraction,
  type DraftFetch
} from "./draft";
import {
  extractUrl,
  isPublicHttpUrl,
  type CommandExecutor,
  type ExtractedSource,
  type HostResolver
} from "./extractors";
import { CurationQueue } from "./queue";
import { inspectCurationRecord } from "./store";

async function makeWorkspaceRoot() {
  const root = await mkdtemp(join(tmpdir(), "mind-wiki-curation-pipeline-"));
  await mkdir(join(root, "content", "approved", "events"), { recursive: true });
  return root;
}

function longChineseText() {
  return "这是一段用于测试抽取质量的中文正文，描述模型发布、技术背景、影响范围和来源细节。".repeat(30);
}

function validChineseEvent() {
  return {
    id: "2026-06-24-chinese-model-release",
    title: "中文模型发布带来新的推理能力",
    date: "2026-06-24",
    type: "model_release",
    summary: "这次发布展示了更强的中文推理和多模态理解能力。",
    why_it_matters: "它说明主流实验室正在把中文能力作为模型竞争的重要维度。",
    trajectories: ["provider_releases"],
    sources: [
      {
        title: "发布公告",
        url: "https://example.com/news",
        source_type: "company"
      }
    ],
    confidence: "observed",
    watchlist: false,
    providers: ["示例实验室"]
  };
}

function jsonFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}): DraftFetch {
  return async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  });
}

const publicResolver: HostResolver = async () => ["93.184.216.34"];
const fetchedHtml = `<html><head><title>模型发布</title></head><body>${longChineseText()}</body></html>`;

async function controlledContent() {
  return {
    finalUrl: "https://example.com/news",
    contentType: "text/html",
    body: fetchedHtml
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public URL validation", () => {
  it("allows only public http and https URLs", () => {
    expect(isPublicHttpUrl("https://example.com/article")).toBe(true);
    expect(isPublicHttpUrl("http://news.example.org/post")).toBe(true);
    expect(isPublicHttpUrl("http://[::ffff:8.8.8.8]/post")).toBe(true);

    for (const unsafeUrl of [
      "file:///tmp/secret",
      "data:text/plain,hello",
      "ftp://example.com/file",
      "https://user@example.com/post",
      "https://user:pass@example.com/post",
      "http://localhost/post",
      "http://localhost./post",
      "http://foo.localhost./post",
      "http://127.0.0.1/post",
      "http://10.1.2.3/post",
      "http://0.0.0.0/post",
      "http://169.254.1.1/post",
      "http://100.64.0.1/post",
      "http://172.16.0.1/post",
      "http://192.168.1.10/post",
      "http://192.0.2.1/post",
      "http://198.18.0.1/post",
      "http://203.0.113.1/post",
      "http://224.0.0.1/post",
      "http://[::1]/post",
      "http://[fc00::1]/post",
      "http://[fe80::1]/post",
      "http://[::ffff:127.0.0.1]/post",
      "http://[::ffff:7f00:1]/post",
      "http://[::ffff:10.0.0.1]/post",
      "http://[::ffff:a00:1]/post",
      "http://[::ffff:192.168.1.10]/post",
      "http://[::ffff:c0a8:10a]/post",
      "https:"
    ]) {
      expect(isPublicHttpUrl(unsafeUrl), unsafeUrl).toBe(false);
    }
  });
});

describe("extractUrl", () => {
  it("uses Crawl4AI as the primary extractor and writes raw plus quality records", async () => {
    const rootDir = await makeWorkspaceRoot();
    const calls: string[] = [];
    const executor: CommandExecutor = async (command, args, options) => {
      calls.push(`${command} ${args.join(" ")}`);
      expect(args).not.toContain("https://example.com/news");
      expect(options?.input).toBe(fetchedHtml);
      return {
        stdout: JSON.stringify({
          title: "模型发布",
          url: "https://example.com/news",
          text: longChineseText(),
          sources: [{ title: "发布公告", url: "https://example.com/news" }]
        }),
        stderr: "",
        exitCode: 0
      };
    };

    const result = await extractUrl("https://example.com/news", {
      rootDir,
      executor,
      resolver: publicResolver,
      redirectChecker: async () => [],
      contentFetcher: controlledContent
    });
    const raw = await inspectCurationRecord<ExtractedSource>("raw", result.id, { rootDir });
    const report = await inspectCurationRecord("quality-reports", result.id, { rootDir });
    const logs = await readRunLog({ rootDir });

    expect(calls).toEqual(["crawl4ai --input - --output json"]);
    expect(raw.data).toMatchObject({
      status: "success",
      extractor: "crawl4ai",
      title: "模型发布"
    });
    expect(report.data).toMatchObject({
      status: "success",
      extractor: "crawl4ai",
      source_count: 1,
      missing_fields: [],
      errors: [],
      reviewable: true
    });
    expect(logs.at(-1)).toMatchObject({
      eventType: "extraction",
      status: "success"
    });
  });

  it("falls back to Trafilatura when Crawl4AI fails", async () => {
    const rootDir = await makeWorkspaceRoot();
    const commands: string[] = [];
    const executor: CommandExecutor = async (command, args, options) => {
      commands.push(command);
      expect(args).not.toContain("https://example.com/static");
      expect(options?.input).toBe(fetchedHtml);
      if (command === "crawl4ai") {
        return { stdout: "", stderr: "crawl failed", exitCode: 2 };
      }
      return {
        stdout: JSON.stringify({
          title: "静态文章",
          url: args.at(-1),
          text: longChineseText()
        }),
        stderr: "",
        exitCode: 0
      };
    };

    const result = await extractUrl("https://example.com/static", {
      rootDir,
      executor,
      resolver: publicResolver,
      redirectChecker: async () => [],
      contentFetcher: async () => ({
        finalUrl: "https://example.com/static",
        contentType: "text/html",
        body: fetchedHtml
      })
    });
    const raw = await inspectCurationRecord<ExtractedSource>("raw", result.id, { rootDir });
    const report = await inspectCurationRecord("quality-reports", result.id, { rootDir });

    expect(commands).toEqual(["crawl4ai", "trafilatura"]);
    expect(raw.data.extractor).toBe("trafilatura");
    expect(raw.data.status).toBe("success");
    expect(report.data).toMatchObject({
      extractor: "trafilatura",
      status: "success",
      reviewable: true
    });
  });

  it("writes visible failed extraction records when extractor tools are missing", async () => {
    const rootDir = await makeWorkspaceRoot();
    const executor: CommandExecutor = async (command) => {
      const error = new Error(`${command} not found`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    };

    const result = await extractUrl("https://example.com/missing-tools", {
      rootDir,
      executor,
      resolver: publicResolver,
      redirectChecker: async () => [],
      contentFetcher: controlledContent
    });
    const raw = await inspectCurationRecord<ExtractedSource>("raw", result.id, { rootDir });
    const report = await inspectCurationRecord("quality-reports", result.id, { rootDir });
    const logs = await readRunLog({ rootDir });

    expect(result.status).toBe("failure");
    expect(raw.data).toMatchObject({
      status: "failure",
      extractor: "none"
    });
    expect(report.data).toMatchObject({
      status: "failure",
      failure: expect.stringContaining("not found"),
      reviewable: false
    });
    expect(logs.at(-1)).toMatchObject({
      eventType: "extraction",
      status: "failure"
    });
  });

  it("rejects private DNS resolutions before adapter execution", async () => {
    const rootDir = await makeWorkspaceRoot();
    let executed = false;
    const executor: CommandExecutor = async () => {
      executed = true;
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    const result = await extractUrl("https://public-name.example/news", {
      rootDir,
      executor,
      resolver: async () => ["10.0.0.5"],
      redirectChecker: async () => []
    });
    const raw = await inspectCurationRecord<ExtractedSource>("raw", result.id, { rootDir });

    expect(executed).toBe(false);
    expect(result.status).toBe("failure");
    expect(raw.data).toMatchObject({
      status: "failure",
      extractor: "none",
      failure: expect.stringContaining("resolved to non-public address")
    });
  });

  it("rejects redirect chains to private hosts before adapter execution", async () => {
    const rootDir = await makeWorkspaceRoot();
    let executed = false;
    const executor: CommandExecutor = async () => {
      executed = true;
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    const result = await extractUrl("https://example.com/redirect", {
      rootDir,
      executor,
      resolver: publicResolver,
      redirectChecker: async () => ["http://localhost/internal"]
    });
    const report = await inspectCurationRecord("quality-reports", result.id, { rootDir });

    expect(executed).toBe(false);
    expect(result.status).toBe("failure");
    expect(report.data).toMatchObject({
      status: "failure",
      failure: expect.stringContaining("Redirect target is not public")
    });
  });

  it("default redirect preflight rejects private targets without requesting them", async () => {
    const rootDir = await makeWorkspaceRoot();
    const requestedUrls: string[] = [];
    let executed = false;
    const executor: CommandExecutor = async () => {
      executed = true;
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    vi.stubGlobal("fetch", async () => {
      throw new Error("unpinned fetch should not be used");
    });

    const result = await extractUrl("https://example.com/redirect", {
      rootDir,
      executor,
      resolver: publicResolver,
      requestTransport: async (request: { url: string }) => {
        requestedUrls.push(request.url);
        if (request.url.startsWith("http://localhost")) {
          throw new Error("private redirect target was contacted");
        }
        return {
          status: 302,
          headers: {
            location: "http://localhost/internal"
          },
          body: ""
        };
      }
    });

    expect(executed).toBe(false);
    expect(result.status).toBe("failure");
    expect(requestedUrls).toEqual(["https://example.com/redirect"]);
  });

  it("controlled fetch rejects GET-time private redirects without contacting the target", async () => {
    const rootDir = await makeWorkspaceRoot();
    const requestedUrls: string[] = [];
    let executed = false;
    const executor: CommandExecutor = async () => {
      executed = true;
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    vi.stubGlobal("fetch", async () => {
      throw new Error("unpinned fetch should not be used");
    });

    const result = await extractUrl("https://example.com/rebind", {
      rootDir,
      executor,
      resolver: publicResolver,
      redirectChecker: async () => [],
      requestTransport: async (request: { url: string; method: string }) => {
        requestedUrls.push(request.url);
        if (request.url.startsWith("http://localhost")) {
          throw new Error("private GET redirect target was contacted");
        }
        if (request.method === "HEAD") {
          return { status: 200, headers: {} as Record<string, string>, body: "" };
        }
        return {
          status: 302,
          headers: {
            location: "http://localhost/private"
          },
          body: ""
        };
      }
    });
    const raw = await inspectCurationRecord<ExtractedSource>("raw", result.id, { rootDir });

    expect(executed).toBe(false);
    expect(result.status).toBe("failure");
    expect(requestedUrls).toEqual(["https://example.com/rebind"]);
    expect(raw.data.failure).toContain("Redirect target is not public");
  });

  it("controlled fetch uses the pinned resolved address instead of a second DNS lookup", async () => {
    const rootDir = await makeWorkspaceRoot();
    const pinnedRequests: Array<{ url: string; pinnedAddress: string; method: string }> = [];
    const executor: CommandExecutor = async (_command, _args, options) => ({
      stdout: JSON.stringify({
        title: "模型发布",
        url: "https://example.com/news",
        text: options?.input ?? "",
        sources: [{ title: "发布公告", url: "https://example.com/news" }]
      }),
      stderr: "",
      exitCode: 0
    });
    vi.stubGlobal("fetch", async () => {
      throw new Error("unpinned fetch should not be used");
    });

    const result = await extractUrl("https://example.com/pinned", {
      rootDir,
      executor,
      resolver: async () => ["93.184.216.34"],
      redirectChecker: async () => [],
      requestTransport: async (request: { url: string; pinnedAddress: string; method: string }) => {
        pinnedRequests.push(request);
        return {
          status: 200,
          headers: { "content-type": "text/html" },
          body: fetchedHtml
        };
      }
    });
    const raw = await inspectCurationRecord<ExtractedSource>("raw", result.id, { rootDir });

    expect(raw.data.failure).toBeUndefined();
    expect(result.status).toBe("success");
    expect(pinnedRequests).toEqual([
      {
        url: "https://example.com/pinned",
        pinnedAddress: "93.184.216.34",
        method: "GET"
      }
    ]);
  });
});

describe("draftEventFromExtraction", () => {
  const extraction: ExtractedSource = {
    id: "source-1",
    source_url: "https://example.com/news",
    status: "success",
    extractor: "crawl4ai",
    title: "模型发布",
    text: longChineseText(),
    sources: [{ title: "发布公告", url: "https://example.com/news" }]
  };

  it("calls an OpenAI-compatible API and saves a schema-valid Chinese draft", async () => {
    const rootDir = await makeWorkspaceRoot();
    const requests: Array<{ url: string; init: { headers?: Record<string, string>; body?: string } }> = [];
    const fetcher: DraftFetch = async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(validChineseEvent())
              }
            }
          ]
        }),
        text: async () => ""
      };
    };

    const result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher,
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const draft = await inspectCurationRecord("drafts", result.id, { rootDir });

    expect(result.status).toBe("success");
    expect(requests[0]?.url).toBe("https://api.example.test/v1/chat/completions");
    expect(requests[0]?.init.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(requests[0]?.init.body ?? "{}")).toMatchObject({ model: "draft-model" });
    expect(draft.data).toMatchObject({
      state: "generated",
      event: validChineseEvent()
    });
  });

  it("allows provider brand names without Chinese characters", async () => {
    const rootDir = await makeWorkspaceRoot();
    const event = {
      ...validChineseEvent(),
      providers: ["OpenAI", "NVIDIA", "Meta"]
    };

    const result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({
        choices: [{ message: { content: JSON.stringify(event) } }]
      }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const draft = await inspectCurationRecord("drafts", result.id, { rootDir });

    expect(result.status).toBe("success");
    expect(draft.data).toMatchObject({
      event: {
        providers: ["OpenAI", "NVIDIA", "Meta"]
      }
    });
  });

  it("saves refusals as invalid draft records", async () => {
    const rootDir = await makeWorkspaceRoot();
    const result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({
        choices: [{ message: { refusal: "cannot comply", content: "" } }]
      }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const invalid = await inspectCurationRecord("invalid", result.id, { rootDir });

    expect(result.status).toBe("failure");
    expect(invalid.data).toMatchObject({
      state: "invalid",
      failure_type: "api_refusal",
      validation_errors: [expect.stringContaining("refusal")]
    });
  });

  it("saves malformed JSON model output with validation errors", async () => {
    const rootDir = await makeWorkspaceRoot();
    const result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({
        choices: [{ message: { content: "{not-json" } }]
      }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const invalid = await inspectCurationRecord("invalid", result.id, { rootDir });

    expect(result.status).toBe("failure");
    expect(invalid.data).toMatchObject({
      failure_type: "malformed_json",
      original_output: "{not-json"
    });
  });

  it("rejects generated English source titles as schema-invalid draft output", async () => {
    const rootDir = await makeWorkspaceRoot();
    const result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...validChineseEvent(),
                sources: [
                  {
                    title: "Release note",
                    url: "https://example.com/news",
                    source_type: "company"
                  }
                ]
              })
            }
          }
        ]
      }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const invalid = await inspectCurationRecord("invalid", result.id, { rootDir });

    expect(result.status).toBe("failure");
    expect(invalid.data).toMatchObject({
      failure_type: "schema_invalid",
      validation_errors: [expect.stringContaining("sources.0.title")]
    });
  });

  it("rejects generated English causal link explanations as schema-invalid draft output", async () => {
    const rootDir = await makeWorkspaceRoot();
    const event = validChineseEvent();
    const result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...event,
                causal_links: [
                  {
                    source_event_id: event.id,
                    target_concept: "中文推理能力",
                    relationship_type: "enabled",
                    explanation: "This release improved model reasoning.",
                    confidence: "observed",
                    sources: event.sources
                  }
                ]
              })
            }
          }
        ]
      }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const invalid = await inspectCurationRecord("invalid", result.id, { rootDir });

    expect(result.status).toBe("failure");
    expect(invalid.data).toMatchObject({
      failure_type: "schema_invalid",
      validation_errors: [expect.stringContaining("causal_links.0.explanation")]
    });
  });

  it("records timeout and rate-limit API failures without real network calls", async () => {
    const rootDir = await makeWorkspaceRoot();
    const timeoutResult = await draftEventFromExtraction(extraction, {
      rootDir,
      timeoutMs: 1,
      fetcher: async () => new Promise(() => undefined),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });
    const rateLimitResult = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({ error: { message: "slow down" } }, { ok: false, status: 429 }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });

    const timeoutInvalid = await inspectCurationRecord("invalid", timeoutResult.id, { rootDir });
    const rateLimitInvalid = await inspectCurationRecord("invalid", rateLimitResult.id, { rootDir });

    expect(timeoutInvalid.data).toMatchObject({ failure_type: "api_timeout" });
    expect(rateLimitInvalid.data).toMatchObject({ failure_type: "api_rate_limit" });
  });

  it("records missing OpenAI configuration and HTTP 500 failures", async () => {
    const rootDir = await makeWorkspaceRoot();
    const missingEnvResult = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({}),
      env: {}
    });
    const http500Result = await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({ error: { message: "server error" } }, { ok: false, status: 500 }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });

    const missingEnvInvalid = await inspectCurationRecord("invalid", missingEnvResult.id, { rootDir });
    const http500Invalid = await inspectCurationRecord("invalid", http500Result.id, { rootDir });

    expect(missingEnvInvalid.data).toMatchObject({
      failure_type: "api_failure",
      validation_errors: [
        "OPENAI_BASE_URL is required",
        "OPENAI_API_KEY is required",
        "OPENAI_MODEL is required"
      ]
    });
    expect(http500Invalid.data).toMatchObject({
      failure_type: "api_failure",
      validation_errors: [expect.stringContaining("HTTP 500")]
    });
  });

  it("clears draft timeout timers after the API responds", async () => {
    vi.useFakeTimers();
    const rootDir = await makeWorkspaceRoot();

    await draftEventFromExtraction(extraction, {
      rootDir,
      fetcher: jsonFetch({
        choices: [{ message: { content: JSON.stringify(validChineseEvent()) } }]
      }),
      env: {
        OPENAI_BASE_URL: "https://api.example.test/v1",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "draft-model"
      }
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("CurationQueue", () => {
  it("bounds extraction concurrency and serializes AI drafting", async () => {
    const queue = new CurationQueue({ extractionConcurrency: 2, draftConcurrency: 1 });
    let runningExtractions = 0;
    let runningDrafts = 0;
    let maxExtractions = 0;
    let maxDrafts = 0;

    const extractionTasks = Array.from({ length: 5 }, (_, index) =>
      queue.addExtraction(async () => {
        runningExtractions += 1;
        maxExtractions = Math.max(maxExtractions, runningExtractions);
        await new Promise((resolve) => setTimeout(resolve, 5));
        runningExtractions -= 1;
        return index;
      })
    );
    const draftTasks = Array.from({ length: 4 }, (_, index) =>
      queue.addDraft(async () => {
        runningDrafts += 1;
        maxDrafts = Math.max(maxDrafts, runningDrafts);
        await new Promise((resolve) => setTimeout(resolve, 5));
        runningDrafts -= 1;
        return index;
      })
    );

    await expect(Promise.all(extractionTasks)).resolves.toEqual([0, 1, 2, 3, 4]);
    await expect(Promise.all(draftTasks)).resolves.toEqual([0, 1, 2, 3]);
    expect(maxExtractions).toBe(2);
    expect(maxDrafts).toBe(1);
  });

  it("rejects synchronous task throws and continues queued work", async () => {
    const queue = new CurationQueue({ extractionConcurrency: 1, draftConcurrency: 1 });
    const calls: string[] = [];

    const failed = queue.addExtraction(() => {
      calls.push("failed");
      throw new Error("sync failure");
    });
    const next = queue.addExtraction(async () => {
      calls.push("next");
      return "continued";
    });

    await expect(failed).rejects.toThrow("sync failure");
    await expect(next).resolves.toBe("continued");
    expect(calls).toEqual(["failed", "next"]);
  });
});
