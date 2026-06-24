import { expect, test } from "@playwright/test";

test.describe("local curation workbench", () => {
  test("renders required local-only curation states and quality report", async ({ page }) => {
    await page.goto("/");

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
    await page.goto("/");

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
    await page.goto("/");

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
    await page.goto("/");

    await page.getByRole("button", { name: "审阅草稿" }).click();
    await expect(page.getByRole("dialog", { name: "草稿审阅" })).toBeVisible();
    await expect(page.getByLabel("审阅意见")).toBeVisible();

    await page.getByLabel("审阅意见").fill("证据链完整，可以进入本地批准池。");
    await page.getByRole("button", { name: "批准草稿" }).click();
    await expect(page.getByRole("status")).toContainText("已批准草稿：OpenAI 发布本地推理优化");
    await expect(page.getByTestId("draft-status")).toContainText("已批准草稿");

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
    await page.goto("/");

    await expect(page.getByTestId("weekly-brief-builder")).toContainText("提议 thesis");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Headline");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Watchlist");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Evidence mapping");
    await expect(page.getByTestId("weekly-brief-builder")).toContainText("Closing synthesis");
  });
});
