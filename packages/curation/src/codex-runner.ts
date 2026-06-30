import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { execa } from "execa";

import {
  allowedPipelineSkillNames,
  type AllowedPipelineSkillName,
  type FailureCode,
  type PipelineFailure
} from "@mind-wiki/core/schema";

export type CodexRunnerOptions = {
  runId: string;
  skillName: string;
  rootDir: string;
  input: unknown;
  timeoutMs: number;
  execaImpl?: typeof execa;
};

export type CodexRunnerResult = {
  exitCode: number;
  outputRefs: string[];
  failure?: PipelineFailure;
};

const forwardedEnv = [
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "SEARXNG_BASE_URL",
  "CRAWL4AI_COMMAND",
  "TRAFILATURA_COMMAND"
] as const;

function assertAllowedSkill(skillName: string): asserts skillName is AllowedPipelineSkillName {
  if (!allowedPipelineSkillNames.includes(skillName as AllowedPipelineSkillName)) {
    throw new Error(`${skillName} is not whitelisted`);
  }
}

function runnerEnv() {
  return Object.fromEntries(
    forwardedEnv.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : []))
  );
}

function outputRefs(runId: string) {
  return [
    `.curation/agent-outputs/${runId}/stdout.txt`,
    `.curation/agent-outputs/${runId}/stderr.txt`,
    `.curation/agent-outputs/${runId}/status.json`
  ];
}

export function redactSecrets(text: string, env: Record<string, string | undefined>) {
  return forwardedEnv.reduce((redacted, key) => {
    const value = env[key];
    if (!value) {
      return redacted;
    }
    return redacted.split(value).join(`[REDACTED:${key}]`);
  }, text);
}

function failureFor(code: FailureCode, runId: string): PipelineFailure {
  return {
    code,
    message_zh: failureMessageZh(code),
    suggested_next_action: failureSuggestedAction(code),
    diagnostic_ref: `.curation/agent-outputs/${runId}/status.json`
  };
}

function failureMessageZh(code: FailureCode) {
  switch (code) {
    case "codex_cli_unavailable":
      return "Codex CLI 不可用。";
    case "skill_missing":
      return "本地 Codex 技能缺失。";
    case "command_timeout":
      return "本地 Codex 运行超时。";
    case "model_api_failure":
      return "模型 API 调用失败。";
    case "malformed_ai_output":
      return "Codex CLI 输出未通过本地校验。";
    default:
      return "Codex CLI 运行失败。";
  }
}

function failureSuggestedAction(code: FailureCode) {
  switch (code) {
    case "codex_cli_unavailable":
      return "确认 Codex CLI 已安装并可在当前环境运行。";
    case "skill_missing":
      return "确认 repo-local 技能文件存在后重试。";
    case "command_timeout":
      return "检查本地网络、搜索和抽取服务后重试。";
    case "model_api_failure":
      return "检查本地 Codex CLI 认证、网络连通性和模型配置后重试。";
    case "malformed_ai_output":
      return "查看本地输出和状态文件后重试。";
    default:
      return "查看本地诊断日志后重试。";
  }
}

function isNodeError(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && "timedOut" in error && error.timedOut === true;
}

function isModelApiFailure(text: string) {
  return [
    "api.openai.com/v1/responses",
    "401 Unauthorized",
    "Missing bearer or basic authentication",
    "OPENAI_API_KEY",
    "model api"
  ].some((signal) => text.toLowerCase().includes(signal.toLowerCase()));
}

function failureCodeForProcessOutput(stdout: string, stderr: string): FailureCode {
  return isModelApiFailure(`${stdout}\n${stderr}`) ? "model_api_failure" : "malformed_ai_output";
}

function outputText(value: unknown) {
  if (Array.isArray(value)) {
    return value.join("\n");
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  return value === undefined ? "" : String(value);
}

async function persistRunnerOutput(options: {
  outputDir: string;
  runId: string;
  skillName: string;
  inputPath: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  failure?: PipelineFailure;
  env: Record<string, string | undefined>;
}): Promise<CodexRunnerResult> {
  const refs = outputRefs(options.runId);
  await writeFile(
    join(options.outputDir, "stdout.txt"),
    redactSecrets(options.stdout ?? "", options.env),
    "utf8"
  );
  await writeFile(
    join(options.outputDir, "stderr.txt"),
    redactSecrets(options.stderr ?? "", options.env),
    "utf8"
  );
  await writeFile(
    join(options.outputDir, "status.json"),
    redactSecrets(
      `${JSON.stringify(
        {
          exitCode: options.exitCode,
          skillName: options.skillName,
          inputPath: options.inputPath,
          outputDir: options.outputDir,
          ...(options.failure ? { failure: options.failure } : {})
        },
        null,
        2
      )}\n`,
      options.env
    ),
    "utf8"
  );

  return {
    exitCode: options.exitCode,
    outputRefs: refs,
    ...(options.failure ? { failure: options.failure } : {})
  };
}

export async function runCodexSkill(options: CodexRunnerOptions): Promise<CodexRunnerResult> {
  assertAllowedSkill(options.skillName);

  const inputDir = join(options.rootDir, ".curation", "pipeline-runs", options.runId);
  const outputDir = join(options.rootDir, ".curation", "agent-outputs", options.runId);
  const discoveryRecordsDir = join(options.rootDir, ".curation", "discovery-records");
  await Promise.all([
    mkdir(inputDir, { recursive: true }),
    mkdir(outputDir, { recursive: true })
  ]);

  const inputPath = join(inputDir, "input.json");
  await writeFile(inputPath, `${JSON.stringify(options.input, null, 2)}\n`, "utf8");
  const env = runnerEnv();

  try {
    await readFile(join(options.rootDir, ".agents", "skills", options.skillName, "SKILL.md"), "utf8");
  } catch {
    return persistRunnerOutput({
      outputDir,
      runId: options.runId,
      skillName: options.skillName,
      inputPath,
      exitCode: 1,
      failure: failureFor("skill_missing", options.runId),
      env
    });
  }

  let result: Awaited<ReturnType<typeof execa>>;
  try {
    const prompt =
      options.skillName === "ai-weekly-discovery"
        ? `Use ${options.skillName}. Read ${inputPath}. Write DiscoveryRecord JSON files to ${discoveryRecordsDir}. Write diagnostics under ${outputDir}. Do not write content/approved.`
        : `Use ${options.skillName}. Read ${inputPath}. Write outputs under ${outputDir}. Do not write content/approved.`;
    result = await (options.execaImpl ?? execa)(
      "codex",
      [
        "exec",
        "--ephemeral",
        "-C",
        options.rootDir,
        prompt
      ],
      {
        cwd: options.rootDir,
        env,
        stdin: "ignore",
        timeout: options.timeoutMs,
        reject: false
      }
    );
  } catch (error) {
    const stdout = error instanceof Error && "stdout" in error ? String(error.stdout ?? "") : "";
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr ?? error.message) : String(error);
    const failure = failureFor(
      isTimeoutError(error)
        ? "command_timeout"
        : isNodeError(error, "ENOENT")
          ? "codex_cli_unavailable"
          : failureCodeForProcessOutput(stdout, stderr),
      options.runId
    );
    return persistRunnerOutput({
      outputDir,
      runId: options.runId,
      skillName: options.skillName,
      inputPath,
      exitCode: 1,
      stdout,
      stderr,
      failure,
      env
    });
  }

  const exitCode = result.exitCode ?? 1;
  const stdout = outputText(result.stdout);
  const stderr = outputText(result.stderr);
  return persistRunnerOutput({
    outputDir,
    runId: options.runId,
    skillName: options.skillName,
    inputPath,
    exitCode,
    stdout,
    stderr,
    ...(exitCode === 0 ? {} : { failure: failureFor(failureCodeForProcessOutput(stdout, stderr), options.runId) }),
    env
  });
}
