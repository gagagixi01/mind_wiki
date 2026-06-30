import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptsDir = join(process.cwd(), "scripts");

describe("local lifecycle scripts", () => {
  it.each(["start.sh", "stop.sh", "restart.sh"])("%s is executable", async (script) => {
    const scriptPath = join(scriptsDir, script);
    const scriptStat = await stat(scriptPath);

    expect(scriptStat.isFile()).toBe(true);
    await expect(access(scriptPath, constants.X_OK)).resolves.toBeUndefined();
  });

  it("starts the site and local backend through workspace commands", async () => {
    const source = await readFile(join(scriptsDir, "start.sh"), "utf8");

    expect(source).toContain("pnpm dev:site");
    expect(source).toContain("pnpm dev:backend");
    expect(source).toContain("site.pid");
    expect(source).toContain("site.log");
    expect(source).toContain("backend.pid");
    expect(source).toContain("backend.log");
    expect(source).toContain("MIND_WIKI_BACKEND_PID_FILE");
    expect(source).toContain("MIND_WIKI_BACKEND_LOG_FILE");
    expect(source).toContain("nohup");
  });

  it("stops the recorded site and backend processes", async () => {
    const source = await readFile(join(scriptsDir, "stop.sh"), "utf8");

    expect(source).toContain("site.pid");
    expect(source).toContain("backend.pid");
    expect(source).toContain("MIND_WIKI_BACKEND_PID_FILE");
    expect(source).toContain("kill -TERM");
    expect(source).toContain("pgrep -P");
    expect(source.indexOf("site.pid")).toBeLessThan(source.indexOf("backend.pid"));
  });

  it("restarts by stopping before starting", async () => {
    const source = await readFile(join(scriptsDir, "restart.sh"), "utf8");

    expect(source.indexOf("stop.sh")).toBeLessThan(source.indexOf("start.sh"));
  });
});
