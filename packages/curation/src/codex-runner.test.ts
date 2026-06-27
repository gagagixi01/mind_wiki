import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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

    await expect(
      runCodexSkill({
        runId: "run-1",
        skillName: "shell-anything",
        rootDir,
        input: {},
        timeoutMs: 1000,
        execaImpl: vi.fn()
      })
    ).rejects.toThrow(/not whitelisted/);
  });

  it("writes input and output refs for allowed skills", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

    await runCodexSkill({
      runId: "run-1",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: { week_start: "2026-06-22" },
      timeoutMs: 1000,
      execaImpl
    });

    await expect(readFile(join(rootDir, ".curation", "pipeline-runs", "run-1", "input.json"), "utf8"))
      .resolves.toContain("week_start");
    await expect(readFile(join(rootDir, ".curation", "agent-outputs", "run-1", "stdout.txt"), "utf8"))
      .resolves.toBe("ok");
    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.any(Array),
      expect.objectContaining({ cwd: rootDir })
    );
  });

  it("invokes codex through the non-interactive exec surface", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

    await runCodexSkill({
      runId: "run-exec",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl
    });

    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["exec"]),
      expect.any(Object)
    );
  });

  it("passes isolated-state flags and an explicit root directory to codex exec", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

    await runCodexSkill({
      runId: "run-flags",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl
    });

    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["exec", "--ephemeral", "--ignore-user-config", "-C", rootDir]),
      expect.any(Object)
    );
  });

  it("runs codex with writable run-scoped HOME and CODEX_HOME", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

    await runCodexSkill({
      runId: "run-home",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl
    });

    const codexHome = join(rootDir, ".curation", "codex-home", "run-home");
    const userHome = join(rootDir, ".curation", "codex-user-home", "run-home");
    expect((await stat(codexHome)).isDirectory()).toBe(true);
    expect((await stat(userHome)).isDirectory()).toBe(true);
    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          CODEX_HOME: codexHome,
          HOME: userHome
        })
      })
    );
  });

  it("closes stdin for the codex exec subprocess", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

    await runCodexSkill({
      runId: "run-stdin",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl
    });

    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.any(Array),
      expect.objectContaining({ stdin: "ignore" })
    );
  });

  it("tells discovery skills to persist candidate records in the discovery-records store", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

    await runCodexSkill({
      runId: "run-discovery-store",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl
    });

    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining([
        expect.stringContaining(`Write DiscoveryRecord JSON files to ${join(rootDir, ".curation", "discovery-records")}`)
      ]),
      expect.any(Object)
    );
  });

  it("keeps diagnostics under the run-specific agent output directory", async () => {
    const rootDir = await makeRoot();
    const execaImpl = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });
    const outputDir = join(rootDir, ".curation", "agent-outputs", "run-diagnostics");

    await runCodexSkill({
      runId: "run-diagnostics",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl
    });

    expect(execaImpl).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining([
        expect.stringContaining(`Write diagnostics under ${outputDir}`)
      ]),
      expect.any(Object)
    );
  });

  it("redacts allowed environment secrets from persisted output", async () => {
    const rootDir = await makeRoot();
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-secret";

    try {
      await runCodexSkill({
        runId: "run-redact",
        skillName: "ai-weekly-discovery",
        rootDir,
        input: {},
        timeoutMs: 1000,
        execaImpl: vi.fn().mockResolvedValue({
          stdout: "stdout sk-test-secret",
          stderr: "stderr sk-test-secret",
          exitCode: 0
        })
      });

      await expect(readFile(join(rootDir, ".curation", "agent-outputs", "run-redact", "stdout.txt"), "utf8"))
        .resolves.toBe("stdout [REDACTED:OPENAI_API_KEY]");
      await expect(readFile(join(rootDir, ".curation", "agent-outputs", "run-redact", "stderr.txt"), "utf8"))
        .resolves.toBe("stderr [REDACTED:OPENAI_API_KEY]");
      await expect(readFile(join(rootDir, ".curation", "agent-outputs", "run-redact", "status.json"), "utf8"))
        .resolves.not.toContain("sk-test-secret");
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
  });

  it("returns skill_missing when the local skill file is absent", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "mind-wiki-runner-"));

    const result = await runCodexSkill({
      runId: "run-missing-skill",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl: vi.fn()
    });

    expect(result.failure?.code).toBe("skill_missing");
    expect(result.exitCode).toBe(1);
  });

  it("returns codex_cli_unavailable when the codex executable is missing", async () => {
    const rootDir = await makeRoot();
    const enoent = Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" });

    const result = await runCodexSkill({
      runId: "run-enoent",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl: vi.fn().mockRejectedValue(enoent)
    });

    expect(result.failure?.code).toBe("codex_cli_unavailable");
    expect(result.failure?.message_zh).toBe("Codex CLI 不可用。");
  });

  it("returns command_timeout when codex execution times out", async () => {
    const rootDir = await makeRoot();
    const timeout = Object.assign(new Error("timed out"), { timedOut: true });

    const result = await runCodexSkill({
      runId: "run-timeout",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl: vi.fn().mockRejectedValue(timeout)
    });

    expect(result.failure?.code).toBe("command_timeout");
    expect(result.failure?.message_zh).toBe("本地 Codex 运行超时。");
  });

  it("returns a named failure for nonzero codex exits", async () => {
    const rootDir = await makeRoot();

    const result = await runCodexSkill({
      runId: "run-nonzero",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl: vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "schema invalid",
        exitCode: 2
      })
    });

    expect(result.exitCode).toBe(2);
    expect(result.failure?.code).toBe("malformed_ai_output");
    expect(result.failure?.message_zh).toBe("Codex CLI 输出未通过本地校验。");
    expect(result.failure?.diagnostic_ref).toBe(".curation/agent-outputs/run-nonzero/status.json");
  });

  it("returns model_api_failure when codex cannot authenticate with the model API", async () => {
    const rootDir = await makeRoot();

    const result = await runCodexSkill({
      runId: "run-model-api",
      skillName: "ai-weekly-discovery",
      rootDir,
      input: {},
      timeoutMs: 1000,
      execaImpl: vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses",
        exitCode: 1
      })
    });

    expect(result.exitCode).toBe(1);
    expect(result.failure?.code).toBe("model_api_failure");
    expect(result.failure?.message_zh).toBe("模型 API 调用失败。");
  });
});
