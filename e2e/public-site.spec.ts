import { expect, test } from "@playwright/test";

test.describe("static public AI progress site", () => {
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
});
