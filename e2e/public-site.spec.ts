import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

async function chooseSelect(page: import("@playwright/test").Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function pathSegments(path: string) {
  return path.split(sep).filter(Boolean);
}

test.describe("static public AI progress site", () => {
  test("homepage shows the latest Chinese weekly brief", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("最新周报 · 2026-06-23")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "本周 AI 发生了什么，它在长期趋势中意味着什么？"
      })
    ).toBeVisible();
    await expect(page.getByText("本周的主线是“能力如何变成系统”")).toBeVisible();
    await expect(page.getByRole("link", { name: "打开周报详情" })).toHaveAttribute(
      "href",
      "/weeks/2026-06-23"
    );
  });

  test("desktop question router navigates public research views", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "本周 AI 发生了什么，它在长期趋势中意味着什么？"
      })
    ).toBeVisible();
    await expect(page.getByText("问题")).toBeVisible();
    await expect(page.getByRole("link", { name: "本周发生了什么" })).toBeVisible();
    await expect(page.getByRole("link", { name: "本周发生了什么" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "因果链如何连接" }).click();
    await expect(page).toHaveURL(/\/causal-chains$/);
    await expect(page.getByRole("heading", { name: "因果链" })).toBeVisible();
  });

  test("mobile navigation preserves the question-router groups without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "因果链如何连接" })).toBeHidden();
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();

    const dialog = page.getByRole("dialog", { name: "研究导航" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("问题")).toBeVisible();
    await expect(dialog.getByText("轨迹")).toBeVisible();
    await expect(dialog.getByText("视图")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "因果链如何连接" })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("trajectory filters combine across trajectory, provider, type, confidence, and watchlist", async ({ page }) => {
    await page.goto("/trajectories");

    await page.getByRole("button", { name: "商业与基础设施" }).click();
    await chooseSelect(page, "按提供方筛选", "NVIDIA");
    await chooseSelect(page, "按事件类型筛选", "商业");
    await chooseSelect(page, "按信心筛选", "已观察");
    await page.getByLabel("只看观察清单").click();

    await expect(
      page.getByRole("button", { name: /查看事件：NVIDIA 财报显示生成式 AI 需求转化为数据中心收入/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /查看事件：NVIDIA H100\/Hopper 面向 Transformer 训练和推理/ })
    ).toBeHidden();
    await expect(page.getByText("商业与基础设施", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("NVIDIA", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("商业", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("已观察", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("只看观察清单", { exact: true }).last()).toBeVisible();
  });

  test("shadcn Empty states render for sources and no matching filters", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.getByText("没有缺失来源")).toBeVisible();
    await expect(page.getByText("当前批准事件都至少带有一个公开来源")).toBeVisible();

    await page.goto("/");
    await chooseSelect(page, "按提供方筛选", "Stability AI");

    await expect(page.getByText("没有匹配筛选的事件")).toBeVisible();
    await expect(page.getByText("换一个轨迹、提供方、事件类型或信心条件，再回到证据列表。")).toBeVisible();

    await page.goto("/trajectories");
    await page.getByRole("button", { name: "LLM 架构" }).click();
    await chooseSelect(page, "按提供方筛选", "Stability AI");

    await expect(page.getByText("这条轨迹暂时很稀疏")).toBeVisible();
    await expect(page.getByText("当前批准内容还没有覆盖这个筛选组合")).toBeVisible();
  });

  test("event sheet opens from a card and closes with Escape while preserving context", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: /查看事件：GPT-4 发布并展示大规模多模态模型路线/ })
      .click();

    await expect(
      page.getByRole("dialog", { name: "GPT-4 发布并展示大规模多模态模型路线" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "GPT-4 发布并展示大规模多模态模型路线" })
    ).toBeHidden();
    await expect(page.getByRole("heading", { name: /本周 AI 发生了什么/ })).toBeVisible();
  });

  test("confidence appears as readable text, not color alone", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("信心：已观察", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("来源 2", { exact: true }).first()).toBeVisible();
  });

  test("causal-chain view renders confidence labels and source counts", async ({ page }) => {
    await page.goto("/causal-chains");

    await expect(page.getByRole("heading", { name: "因果链" })).toBeVisible();
    await expect(page.getByText("来源事件").first()).toBeVisible();
    await expect(page.getByText("目标").first()).toBeVisible();
    await expect(page.getByText("信心：可能").first()).toBeVisible();
    await expect(page.getByText("来源 2", { exact: true }).first()).toBeVisible();
  });

  test("confidence labels expose text instead of color-only state", async ({ page }) => {
    await page.goto("/causal-chains");

    const labels = await page.getByText(/^信心：/).allInnerTexts();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toEqual(expect.arrayContaining([expect.stringMatching(/^信心：(已观察|可能|推测)$/)]));
  });

  test("weekly detail route renders the approved weekly brief body", async ({ page }) => {
    await page.goto("/weeks/2026-06-23");

    await expect(page.getByRole("heading", { name: "周报详情" })).toBeVisible();
    await expect(
      page.getByText("这是一篇种子历史综合周报，用 2026-06-23 这一周作为站点初始化入口")
    ).toBeVisible();
    await expect(page.getByText("本周的主线是“能力如何变成系统”")).toBeVisible();
  });

  test("trajectory detail clear filters keeps the route trajectory scope", async ({ page }) => {
    await page.goto("/trajectories/multimodal_architecture");

    await expect(page.getByRole("heading", { name: "多模态" })).toBeVisible();
    await expect(page.getByRole("button", { name: /查看事件：CLIP 将文本和图像放进同一个语义空间/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /查看事件：Mamba 用选择性状态空间挑战注意力成本/ })).toBeHidden();

    await page.getByRole("button", { name: "清除筛选" }).click();

    await expect(page.getByRole("button", { name: "多模态" })).toHaveAttribute("data-state", "on");
    await expect(page.getByRole("button", { name: /查看事件：CLIP 将文本和图像放进同一个语义空间/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /查看事件：Mamba 用选择性状态空间挑战注意力成本/ })).toBeHidden();
  });

  test("static export excludes local files, workbench strings, and secret markers", async () => {
    const outDir = join(process.cwd(), "apps/site/out");
    expect(existsSync(outDir)).toBe(true);

    const files = listFiles(outDir);
    const relativeFiles = files.map((file) => relative(outDir, file));
    const leakedLocalSegments = new Set([".curation", "drafts", "raw", "run-logs", "invalid", "rejected", "quality-reports"]);

    expect(
      relativeFiles.some((file) => pathSegments(file).some((segment) => leakedLocalSegments.has(segment)))
    ).toBe(false);
    expect(relativeFiles.some((file) => pathSegments(file).some((segment) => segment.startsWith("._")))).toBe(false);

    const combinedText = files
      .filter((file) => /\.(html|js|json|txt|css)$/.test(file))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(combinedText).not.toContain("Local Curation Workbench");
    expect(combinedText).not.toContain("本地工作台 · 不进入静态发布");
    expect(combinedText).not.toContain("OPENAI_API_KEY");
    expect(combinedText).not.toContain("CURATION_STATE_DIR");
    expect(combinedText).not.toContain(".curation");
  });
});
