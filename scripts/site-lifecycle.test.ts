import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptsDir = join(process.cwd(), "scripts");

describe("site lifecycle scripts", () => {
  it.each(["start.sh", "stop.sh", "restart.sh"])("%s is executable", async (script) => {
    const scriptPath = join(scriptsDir, script);
    const scriptStat = await stat(scriptPath);

    expect(scriptStat.isFile()).toBe(true);
    await expect(access(scriptPath, constants.X_OK)).resolves.toBeUndefined();
  });

  it("starts the public website through the workspace command", async () => {
    const source = await readFile(join(scriptsDir, "start.sh"), "utf8");

    expect(source).toContain("pnpm dev:site");
    expect(source).toContain("site.pid");
    expect(source).toContain("site.log");
    expect(source).toContain("nohup");
  });

  it("stops the recorded website process", async () => {
    const source = await readFile(join(scriptsDir, "stop.sh"), "utf8");

    expect(source).toContain("site.pid");
    expect(source).toContain("kill -TERM");
    expect(source).toContain("pgrep -P");
  });

  it("restarts by stopping before starting", async () => {
    const source = await readFile(join(scriptsDir, "restart.sh"), "utf8");

    expect(source.indexOf("stop.sh")).toBeLessThan(source.indexOf("start.sh"));
  });
});
