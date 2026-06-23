import { expect, test } from "@playwright/test";

test.describe("public site shell", () => {
  test("renders the Chinese research shell and desktop sidebar can collapse and expand", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "AI 进展周报索引" })).toBeVisible();
    await expect(page.getByText("公开站点 · 仅批准内容")).toBeVisible();
    await expect(page.getByRole("button", { name: "轨迹" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(page.getByRole("button", { name: "轨迹" })).toBeHidden();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(page.getByRole("button", { name: "轨迹" })).toBeVisible();
  });

  test("opens sidebar navigation from the trigger on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "AI 进展周报索引" })).toBeVisible();
    await expect(page.getByRole("button", { name: "轨迹" })).toBeHidden();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(page.getByRole("dialog", { name: "研究导航" })).toBeVisible();
    await expect(page.getByRole("button", { name: "轨迹" })).toBeVisible();
  });
});
