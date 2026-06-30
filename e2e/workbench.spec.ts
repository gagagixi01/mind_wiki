import { expect, test } from "@playwright/test";

const sourcePackRecords = [
  {
    id: "provider-labs",
    data: {
      id: "provider-labs",
      name: "Provider Labs",
      enabled: true,
      rss_feeds: ["https://openai.com/news/rss.xml"],
      web_search_queries: ["site:anthropic.com/news Claude model release OR research"],
      source_type: "provider_blog",
      trajectory_hints: ["provider_releases"],
      cadence: "manual",
      notes: "Official provider sources."
    }
  },
  {
    id: "infra-commercial",
    data: {
      id: "infra-commercial",
      name: "Infra Commercial",
      enabled: true,
      rss_feeds: ["https://blogs.nvidia.com/feed/"],
      web_search_queries: ["site:nvidianews.nvidia.com AI GPU datacenter supply"],
      source_type: "infra",
      trajectory_hints: ["commercial_forces"],
      cadence: "manual",
      notes: "Infrastructure and commercial signals."
    }
  },
  {
    id: "china-ai-watch",
    data: {
      id: "china-ai-watch",
      name: "China AI Watch",
      enabled: true,
      rss_feeds: ["https://www.qbitai.com/feed"],
      web_search_queries: [],
      source_type: "news",
      trajectory_hints: ["commercial_forces"],
      cadence: "manual",
      notes: "China AI market and lab signals."
    }
  },
  {
    id: "research-feeds",
    data: {
      id: "research-feeds",
      name: "Research Feeds",
      enabled: true,
      rss_feeds: ["https://export.arxiv.org/rss/cs.AI"],
      web_search_queries: [],
      source_type: "paper",
      trajectory_hints: ["llm_architecture"],
      cadence: "manual",
      notes: "Broader research feed."
    }
  }
];

test.describe("local curation workbench", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/source-packs", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(sourcePackRecords)
      });
    });
    await page.route("**/api/pipeline/runs/*/discovery-summary", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runId: "run-summary",
          status: { exitCode: 0, skillName: "ai-weekly-discovery" },
          recordsWritten: 0,
          sourcePacks: [],
          rss: [],
          webSearch: {
            configuredProvider: null,
            attempted: 0,
            skippedQueries: 0,
            webSearchSkipped: false
          }
        })
      });
    });
  });

  test("shows pipeline status bar and discovery action in the first viewport", async ({ page }) => {
    let requestedDiscoveryRecordsUrl: URL | undefined;
    await page.route("**/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stale: false,
          visibleStage: "idle",
          latestCompletedRun: {
            id: "run-old-guidance",
            stage: "failed",
            error: {
              code: "model_api_failure",
              message_zh: "模型 API 调用失败。",
              suggested_next_action: "检查 OpenAI API 认证、网络连通性和模型配置后重试。"
            }
          },
          counts: { candidates: 0, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 0 }
        })
      });
    });
    await page.route("**/api/discovery-records**", async (route) => {
      requestedDiscoveryRecordsUrl = new URL(route.request().url());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([])
      });
    });

    await page.goto("/workbench");

    await expect(page.getByRole("button", { name: "Run discovery" })).toBeVisible();
    await expect(page.getByText("待运行")).toBeVisible();
    await expect(page.getByRole("heading", { name: "本地发现流程" })).toBeVisible();
    await expect(page.getByLabel("Pipeline failure")).toContainText("检查本地 Codex CLI 认证、网络连通性和模型配置后重试。");
    await expect(page.getByLabel("Pipeline failure")).not.toContainText("检查 OpenAI API 认证、网络连通性和模型配置后重试。");
    expect(requestedDiscoveryRecordsUrl?.searchParams.get("run_id")).toBe("run-old-guidance");
  });

  test("disables duplicate discovery while an active run is present", async ({ page }) => {
    await page.route("**/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          activeRun: { id: "run-1", stage: "discovering", started_at: "2026-06-25T00:00:00.000Z" },
          stale: true,
          visibleStage: "discovering",
          counts: { candidates: 3, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 2 }
        })
      });
    });
    await page.route("**/api/discovery-records**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([])
      });
    });

    await page.goto("/workbench");

    await expect(page.getByRole("button", { name: "运行中" })).toBeDisabled();
    await expect(page.getByText("正在通过 RSS 和 web search 查找候选来源。")).toBeVisible();
    await expect(page.getByLabel("Active discovery run")).toContainText("run-1");
    await expect(page.getByLabel("Active discovery run")).toContainText("Elapsed");
    await expect(page.getByLabel("Active discovery run")).toContainText("Still waiting");
    await expect(page.getByLabel("Active discovery run")).toContainText("Codex CLI auth/config");
  });

  test("starts a high-signal quick discovery run with selected source pack ids", async ({ page }) => {
    let discoveryPayload: { sourcePackIds?: string[] } | undefined;
    await page.route("**/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stale: false,
          visibleStage: "idle",
          counts: { candidates: 0, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 4 }
        })
      });
    });
    await page.route("**/api/discovery-records**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([])
      });
    });
    await page.route("**/api/pipeline/discovery/run", async (route) => {
      discoveryPayload = route.request().postDataJSON() as { sourcePackIds?: string[] };
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          run: {
            id: "run-quick",
            type: "discovery",
            status: "running",
            stage: "discovering",
            started_at: "2026-06-30T00:00:00.000Z"
          }
        })
      });
    });

    await page.goto("/workbench");

    await expect(page.getByText("High-signal quick run")).toBeVisible();
    await page.getByRole("button", { name: "Run discovery" }).click();

    await expect.poll(() => discoveryPayload).toEqual({
      sourcePackIds: ["provider-labs", "infra-commercial", "china-ai-watch"]
    });
    await expect(page.getByRole("status")).toContainText("Discovery started: run-quick");
  });

  test("shows discovered candidates from the discovery records api", async ({ page }) => {
    const requestedDiscoveryRecordsUrls: URL[] = [];
    await page.route("**/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stale: false,
          visibleStage: "discovered",
          counts: { candidates: 1, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 3 }
        })
      });
    });
    await page.route("**/api/discovery-records**", async (route) => {
      requestedDiscoveryRecordsUrls.push(new URL(route.request().url()));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "run-1-provider-openai-chip",
            value_score: 92,
            value_reasons: ["high-signal source pack", "observed confidence", "inference signal"],
            data: {
              id: "run-1-provider-openai-chip",
              run_id: "run-1",
              source_pack_id: "provider-labs",
              discovered_url: "https://openai.com/news/chip",
              normalized_url: "https://openai.com/news/chip",
              canonical_url: "https://openai.com/news/chip",
              title: "OpenAI and Broadcom unveil inference chip",
              discovery_method: "rss",
              reason_found: "Matched provider RSS feed.",
              source_type: "provider_blog",
              trajectory_classification: ["provider_releases"],
              duplicate_status: "new",
              confidence: "observed",
              status: "discovered",
              errors: [],
              created_at: "2026-06-25T09:14:21.885Z",
              updated_at: "2026-06-25T09:14:21.885Z"
            }
          }
        ])
      });
    });

    await page.goto("/workbench");

    await expect.poll(() =>
      requestedDiscoveryRecordsUrls.some((requestUrl) =>
        requestUrl.searchParams.get("sort") === "value" &&
        requestUrl.searchParams.get("status") === "discovered" &&
        requestUrl.searchParams.get("duplicate_status") === "new"
      )
    ).toBe(true);
    await expect(page.getByTestId("discovery-record-run-1-provider-openai-chip")).toContainText(
      "OpenAI and Broadcom unveil inference chip"
    );
    await expect(page.getByTestId("discovery-record-run-1-provider-openai-chip")).toContainText("provider-labs");
    await expect(page.getByTestId("discovery-record-run-1-provider-openai-chip")).toContainText("RSS");
    await expect(page.getByTestId("discovery-record-run-1-provider-openai-chip")).toContainText("Value 92");
    await expect(page.getByTestId("discovery-record-run-1-provider-openai-chip")).toContainText(
      "high-signal source pack"
    );
    await expect(page.getByTestId("discovery-record-run-1-provider-openai-chip")).toContainText(
      "https://openai.com/news/chip"
    );
  });

  test("shows failed discovery records with visible failure context", async ({ page }) => {
    const requestedStatuses: Array<string | null> = [];
    await page.route("**/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stale: false,
          visibleStage: "discovered",
          counts: { candidates: 1, drafts: 0, failures: 1, readyForReview: 0, sourcePacks: 3 }
        })
      });
    });
    await page.route("**/api/discovery-records**", async (route) => {
      const requestUrl = new URL(route.request().url());
      requestedStatuses.push(requestUrl.searchParams.get("status"));
      const isFailuresTab = requestUrl.searchParams.get("status") === "failed";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          isFailuresTab
            ? [
                {
                  id: "run-1-provider-web-search-unavailable",
                  value_score: 5,
                  value_reasons: ["failed record", "search provider unavailable"],
                  data: {
                    id: "run-1-provider-web-search-unavailable",
                    run_id: "run-1",
                    source_pack_id: "provider-labs",
                    discovered_url: "https://search.local/unavailable",
                    normalized_url: "https://search.local/unavailable",
                    canonical_url: "https://search.local/unavailable",
                    title: "web-search-unavailable",
                    discovery_method: "web_search",
                    reason_found: "Configured web search query failed.",
                    source_type: "provider_blog",
                    trajectory_classification: ["provider_releases"],
                    duplicate_status: "ignored",
                    confidence: "likely",
                    status: "failed",
                    errors: ["search_provider_unavailable"],
                    created_at: "2026-06-25T09:14:21.885Z",
                    updated_at: "2026-06-25T09:14:21.885Z"
                  }
                }
              ]
            : []
        )
      });
    });

    await page.goto("/workbench");
    await expect(page.getByText("暂无候选")).toBeVisible();
    await expect(page.getByTestId("discovery-record-run-1-provider-web-search-unavailable")).toHaveCount(0);

    await page.getByRole("tab", { name: "Failures" }).click();

    await expect.poll(() => requestedStatuses).toContain("failed");
    await expect(page.getByTestId("discovery-record-run-1-provider-web-search-unavailable")).toContainText(
      "web-search-unavailable"
    );
    await expect(page.getByTestId("discovery-record-run-1-provider-web-search-unavailable")).toContainText(
      "search_provider_unavailable"
    );
    await expect(page.getByTestId("discovery-record-run-1-provider-web-search-unavailable")).toContainText(
      "Web search"
    );
  });

  test("shows completed discovery run summary with web-search skipped status", async ({ page }) => {
    await page.route("**/api/pipeline/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stale: false,
          visibleStage: "discovered",
          latestCompletedRun: { id: "run-summary", stage: "discovered", ended_at: "2026-06-30T00:01:00.000Z" },
          counts: { candidates: 2, drafts: 0, failures: 0, readyForReview: 0, sourcePacks: 3 }
        })
      });
    });
    await page.route("**/api/discovery-records**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([])
      });
    });
    await page.route("**/api/pipeline/runs/run-summary/discovery-summary", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runId: "run-summary",
          status: { exitCode: 0, skillName: "ai-weekly-discovery" },
          recordsWritten: 2,
          sourcePacks: [{ sourcePackId: "provider-labs", rssWritten: 2 }],
          rss: [{ sourcePackId: "provider-labs", status: "ok", candidatesWritten: 2 }],
          webSearch: {
            configuredProvider: null,
            attempted: 0,
            skippedQueries: 3,
            webSearchSkipped: true
          }
        })
      });
    });

    await page.goto("/workbench");

    await expect(page.getByTestId("discovery-run-summary")).toContainText("2");
    await expect(page.getByTestId("discovery-run-summary")).toContainText("records written");
    await expect(page.getByTestId("discovery-run-summary")).toContainText("Web search skipped");
    await expect(page.getByTestId("discovery-run-summary")).toContainText("provider-labs");
  });

  test("renders required local-only curation states and quality report", async ({ page }) => {
    await page.goto("/workbench");

    await expect(page.getByText("本地工作台 · 不进入静态发布")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Local Curation Workbench" })).toBeVisible();
    await expect(page.getByRole("form", { name: "本地来源摄入" })).toBeVisible();
    await expect(page.getByLabel("来源 URL")).toBeVisible();
    await expect(page.getByLabel("来源类型")).toBeVisible();
    await expect(page.getByLabel("摄入备注")).toBeVisible();

    await expect(page.getByTestId("empty-queue")).toContainText("空队列");
    await expect(page.getByTestId("empty-drafts")).toContainText("无草稿空状态示例");
    await expect(page.getByTestId("empty-drafts")).toContainText("不从公共站点或模型 API 补数据");
    await expect(page.getByRole("progressbar", { name: "抽取进度" })).toHaveAttribute("aria-valuenow", "64");
    await expect(page.getByTestId("progress-extraction")).toHaveAttribute("aria-valuenow", "64");
    await expect(page.getByTestId("skeleton-loader")).toBeVisible();

    await expect(page.getByRole("cell", { name: "抽取中" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "备用抽取器" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "抽取失败" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "AI 输出无效" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "重复来源" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "已批准草稿" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "已拒绝草稿" })).toBeVisible();

    await expect(page.getByTestId("duplicate-warning")).toContainText("已检测到重复来源");
    await expect(page.getByTestId("invalid-output")).toContainText("schema 校验失败");
    await expect(page.getByText("已进入周报候选池，仍只存在本地工作台")).toBeVisible();
    await expect(page.getByText("来源无法确认，保留为本地拒绝记录")).toBeVisible();
    await expect(page.getByTestId("quality-report")).toContainText("证据覆盖率");
    await expect(page.getByTestId("quality-report")).toContainText("来源可信度");
  });

  test("adds a source to the local queue without browser API calls", async ({ page }) => {
    await page.goto("/workbench");

    const blockedRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const isLocal =
        url.protocol === "data:" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "::1";
      const isKnownModelEndpoint =
        url.hostname.includes("openai") ||
        url.hostname.includes("anthropic") ||
        url.hostname.includes("yairouter") ||
        url.pathname.includes("/v1/responses") ||
        url.pathname.includes("/v1/chat/completions");

      if (!isLocal || isKnownModelEndpoint) {
        blockedRequests.push(request.url());
      }
    });

    await page.getByLabel("来源 URL").fill("https://example.local/research/local-routing");
    await page.getByLabel("来源类型").selectOption("paper");
    await page.getByLabel("摄入备注").fill("用于验证本地来源摄入，只进入 React 状态。");
    await page.getByRole("button", { name: "加入本地队列" }).click();

    await expect(page.getByRole("status")).toContainText(
      "已加入本地队列：https://example.local/research/local-routing"
    );
    await expect(page.getByTestId("local-source-count")).toContainText("1 local source");
    await expect(page.getByRole("cell", { name: "https://example.local/research/local-routing" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "本地新增来源" })).toBeVisible();
    await expect(page.getByLabel("来源 URL")).toHaveValue("");
    await expect(page.getByTestId("empty-queue")).toBeHidden();
    expect(blockedRequests).toEqual([]);
  });

  test("review sheet supports keyboard focus, tab containment, escape close, and focus restoration", async ({ page }) => {
    await page.goto("/workbench");

    const reviewButton = page.getByRole("button", { name: "审阅草稿" });
    await reviewButton.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "草稿审阅" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("审阅意见")).toBeFocused();

    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(reviewButton).toBeFocused();
  });

  test("reviews, approves, rejects, retries, and edits causal links locally", async ({ page }) => {
    await page.goto("/workbench");

    await page.getByRole("button", { name: "审阅草稿" }).click();
    await expect(page.getByRole("dialog", { name: "草稿审阅" })).toBeVisible();
    await expect(page.getByLabel("审阅意见")).toBeVisible();

    await page.getByLabel("审阅意见").fill("证据链完整，可以进入本地批准池。");
    await page.getByRole("button", { name: "批准草稿" }).click();
    await expect(page.getByRole("status")).toContainText("已批准草稿：OpenAI 发布本地推理优化");
    await expect(page.getByTestId("draft-status")).toContainText("已批准草稿");

    await page.getByRole("button", { name: "审阅草稿" }).click();
    await expect(page.getByRole("dialog", { name: "草稿审阅" })).toBeVisible();
    await page.getByRole("button", { name: "驳回草稿" }).click();
    await expect(page.getByRole("status")).toContainText("已驳回草稿：OpenAI 发布本地推理优化");
    await expect(page.getByTestId("draft-status")).toContainText("已拒绝草稿");

    await page.getByRole("button", { name: "重试抽取" }).click();
    await expect(page.getByRole("status")).toContainText("已排队重试：Vendor blog extraction timeout");

    await page.getByLabel("关系类型").selectOption("enables");
    await page.getByLabel("置信度").selectOption("0.82");
    await page.getByLabel("因果说明").fill("本地推理优化降低部署摩擦，使企业评估更快进入试点。");
    await page.getByRole("button", { name: "保存因果链接" }).click();
    await expect(page.getByRole("status")).toContainText("已保存本地因果链接");
    await expect(page.getByTestId("causal-preview")).toContainText("enables");
    await expect(page.getByTestId("causal-preview")).toContainText("0.82");
  });

  test("builds a weekly brief proposal from approved events", async ({ page }) => {
    await page.goto("/workbench");

    await expect(page.getByTestId("weekly-brief-builder")).toContainText("提议 thesis");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Headline");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Watchlist");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Evidence mapping");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Closing synthesis");
  });

  test("edits, tests, and saves up to three OpenAI-compatible workbench profiles", async ({ page }) => {
    const savedBodies: Array<{
      activeProfileId: string;
      profiles: Array<{ id: string; label: string; baseUrl: string; apiKey: string; modelId: string }>;
    }> = [];
    const testedBodies: Array<{
      profile: { id: string; label: string; baseUrl: string; apiKey: string; modelId: string };
    }> = [];
    const providerRequests: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api/workbench/provider-settings")) {
        providerRequests.push(`${request.method()} ${request.url()}`);
      }
    });

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
    await page.route("**/api/discovery-records**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([])
      });
    });
    await page.route("**/api/workbench/provider-settings", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:3000",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type",
            vary: "Origin"
          }
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:3000",
          vary: "Origin"
        },
        body: JSON.stringify({
          activeProfileId: "profile-1",
          profiles: [
            {
              id: "profile-1",
              label: "Primary",
              baseUrl: "https://api.example.test/v1",
              modelId: "gpt-4.1-mini",
              hasApiKey: true,
              maskedApiKey: "sk-l...cret",
              updatedAt: "2026-06-29T00:00:00.000Z"
            },
            {
              id: "profile-2",
              label: "",
              baseUrl: "",
              modelId: "",
              hasApiKey: false,
              maskedApiKey: "",
              updatedAt: undefined
            },
            {
              id: "profile-3",
              label: "",
              baseUrl: "",
              modelId: "",
              hasApiKey: false,
              maskedApiKey: "",
              updatedAt: undefined
            }
          ]
        })
      });
    });

    await page.route("**/api/workbench/provider-settings/save", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:3000",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type",
            vary: "Origin"
          }
        });
        return;
      }

      const payload = route.request().postDataJSON() as {
        activeProfileId: string;
        profiles: Array<{ id: string; label: string; baseUrl: string; apiKey: string; modelId: string }>;
      };
      savedBodies.push(payload);
      await route.fulfill({
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:3000",
          vary: "Origin"
        },
        body: JSON.stringify({
          activeProfileId: payload.activeProfileId,
          profiles: payload.profiles.map((profile) => ({
            id: profile.id,
            label: profile.label,
            baseUrl: profile.baseUrl,
            modelId: profile.modelId,
            hasApiKey: true,
            maskedApiKey: "sk-t...cret",
            updatedAt: "2026-06-29T01:00:00.000Z"
          }))
        })
      });
    });

    await page.route("**/api/workbench/provider-settings/test", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:3000",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type",
            vary: "Origin"
          }
        });
        return;
      }

      const payload = route.request().postDataJSON() as {
        profile: { id: string; label: string; baseUrl: string; apiKey: string; modelId: string };
      };
      testedBodies.push(payload);
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (payload.profile.modelId.includes("bad")) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:3000",
            vary: "Origin"
          },
          body: JSON.stringify({
            ok: false,
            status: 401,
            message: "Authentication failed. Check the API key."
          })
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:3000",
          vary: "Origin"
        },
        body: JSON.stringify({
          ok: true,
          status: 200,
          message: `Connection succeeded for ${payload.profile.modelId}.`
        })
      });
    });

    await page.goto("/workbench");

    await page.getByRole("button", { name: "API settings" }).click();
    await expect(page.getByRole("dialog", { name: "OpenAI-compatible API settings" })).toBeVisible();
    await expect(page.getByText("当前设置只影响工作台自己的直连 OpenAI-compatible API 调用和连接测试，不会改动 Codex CLI。")).toBeVisible();
    await expect(page.getByText("sk-l...cret")).toBeVisible();
    await expect(page.getByText("Run discovery uses your local Codex CLI config separately from these workbench API settings.")).toBeVisible();

    await page.getByRole("button", { name: "Profile 2" }).click();
    await page.getByLabel("Profile label").fill("Sandbox");
    await page.getByLabel("Base URL").fill("https://router.example.test/v1");
    await page.getByLabel("API key").fill("sk-test-secret");
    await page.getByLabel("Model ID").fill("gpt-4.1");

    await page.getByRole("button", { name: "Set active" }).click();
    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByTestId("provider-test-result")).toContainText("Testing connection...");
    await expect.poll(() => providerRequests).toContainEqual(
      expect.stringContaining("POST http://127.0.0.1:8001/api/workbench/provider-settings/test")
    );
    await expect.poll(() => testedBodies.length).toBe(1);
    await expect(page.getByRole("status")).toContainText("Connection succeeded for gpt-4.1.");
    await expect(page.getByTestId("provider-test-result")).toContainText("Connection succeeded");
    await expect(page.getByTestId("provider-test-result")).toContainText("Status 200");
    await expect(page.getByTestId("provider-test-result")).toContainText("Connection succeeded for gpt-4.1.");
    await expect(page.getByTestId("provider-test-result")).toContainText("Last tested");
    await expect(page.getByTestId("provider-test-result")).not.toContainText("sk-test-secret");

    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status")).toContainText("Saved workbench API settings.");

    expect(testedBodies).toEqual([
      {
        profile: {
          id: "profile-2",
          label: "Sandbox",
          baseUrl: "https://router.example.test/v1",
          apiKey: "sk-test-secret",
          modelId: "gpt-4.1"
        }
      }
    ]);
    expect(savedBodies).toEqual([
      {
        activeProfileId: "profile-2",
        profiles: [
          {
            id: "profile-1",
            label: "Primary",
            baseUrl: "https://api.example.test/v1",
            apiKey: "",
            modelId: "gpt-4.1-mini"
          },
          {
            id: "profile-2",
            label: "Sandbox",
            baseUrl: "https://router.example.test/v1",
            apiKey: "sk-test-secret",
            modelId: "gpt-4.1"
          }
        ]
      }
    ]);

    await page.getByLabel("Model ID").fill("gpt-bad");
    await expect(page.getByTestId("provider-test-result")).toHaveCount(0);

    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByTestId("provider-test-result")).toContainText("Testing connection...");
    await expect.poll(() => testedBodies.length).toBe(2);
    await expect(page.getByTestId("provider-test-result")).toContainText("Connection failed");
    await expect(page.getByTestId("provider-test-result")).toContainText("Status 401");
    await expect(page.getByTestId("provider-test-result")).toContainText("Authentication failed. Check the API key.");
    await expect(page.getByTestId("provider-test-result")).toContainText("Last tested");
    await expect(page.getByTestId("provider-test-result")).not.toContainText("sk-test-secret");
  });
});
