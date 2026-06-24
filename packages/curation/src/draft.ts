import { createHash } from "node:crypto";

import { eventSchema, type Event } from "@mind-wiki/core/schema";
import { z } from "zod";

import type { ExtractedSource } from "./extractors";
import { appendRunLog, type RunLogOptions } from "./run-log";
import {
  inspectCurationRecord,
  writeDraftRecord,
  writeJsonRecord,
  type StoreOptions
} from "./store";

export type DraftFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type DraftFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<DraftFetchResponse>;

export type DraftEnvironment = {
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type DraftEventOptions = StoreOptions & {
  fetcher?: DraftFetch;
  env?: DraftEnvironment;
  timeoutMs?: number;
};

export type DraftPipelineResult = {
  id: string;
  status: "success" | "failure";
  path?: string;
  errors?: string[];
};

type InvalidDraftType =
  | "api_failure"
  | "api_rate_limit"
  | "api_refusal"
  | "api_timeout"
  | "malformed_json"
  | "schema_invalid";

type DraftConfig =
  | { ok: true; baseUrl: string; apiKey: string; model: string }
  | { ok: false; errors: string[] };

const chatCompletionSchema = z
  .object({
    choices: z.array(
      z.object({
        finish_reason: z.string().optional(),
        message: z
          .object({
            content: z.string().nullable().optional(),
            refusal: z.string().nullable().optional()
          })
          .passthrough()
      }).passthrough()
    )
  })
  .passthrough();

export async function draftEventFromExtraction(
  extraction: ExtractedSource,
  options: DraftEventOptions = {}
): Promise<DraftPipelineResult> {
  if (extraction.status !== "success") {
    return saveInvalidDraft(extraction, "api_failure", ["Cannot draft from failed extraction"], options);
  }

  const config = readDraftConfig(options.env);
  if (!config.ok) {
    return saveInvalidDraft(extraction, "api_failure", config.errors, options);
  }

  const requestBody = {
    model: config.model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "你是 Mind Wiki 的中文事件卡片编辑。",
          "必须只输出 JSON，不要输出 Markdown。",
          "所有面向读者的字段必须使用中文。",
          "JSON 必须符合事件 schema：id, title, date, type, summary, why_it_matters, trajectories, sources, confidence, watchlist。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          source_url: extraction.source_url,
          title: extraction.title,
          text: extraction.text,
          sources: extraction.sources
        })
      }
    ]
  };

  let response: DraftFetchResponse;
  try {
    response = await fetchWithTimeout(
      options.fetcher ?? defaultDraftFetch,
      `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      },
      options.timeoutMs ?? 60_000
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return saveInvalidDraft(
      extraction,
      message === "Draft API request timed out" ? "api_timeout" : "api_failure",
      [message],
      options
    );
  }

  if (!response.ok) {
    const body = await safeResponseText(response);
    return saveInvalidDraft(
      extraction,
      response.status === 429 ? "api_rate_limit" : "api_failure",
      [`Draft API request failed with HTTP ${response.status}${body ? `: ${body}` : ""}`],
      options
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return saveInvalidDraft(extraction, "malformed_json", [errorMessage(error)], options);
  }

  const completion = chatCompletionSchema.safeParse(payload);
  if (!completion.success) {
    return saveInvalidDraft(
      extraction,
      "schema_invalid",
      completion.error.issues.map((issue) => issue.message),
      options,
      payload
    );
  }

  const choice = completion.data.choices[0];
  const refusal = choice?.message.refusal?.trim();
  if (refusal || choice?.finish_reason === "content_filter") {
    return saveInvalidDraft(
      extraction,
      "api_refusal",
      [`Draft API returned refusal${refusal ? `: ${refusal}` : ""}`],
      options,
      payload
    );
  }

  const originalOutput = choice?.message.content?.trim() ?? "";
  let parsedDraft: unknown;
  try {
    parsedDraft = JSON.parse(originalOutput);
  } catch (error) {
    return saveInvalidDraft(
      extraction,
      "malformed_json",
      [errorMessage(error)],
      options,
      originalOutput
    );
  }

  const event = eventSchema.safeParse(parsedDraft);
  const chineseErrors = event.success ? chineseValidationErrors(event.data) : [];
  if (!event.success || chineseErrors.length > 0) {
    const validationErrors = event.success
      ? chineseErrors
      : event.error.issues.map((issue) => `${issue.path.join(".") || "event"}: ${issue.message}`);
    return saveInvalidDraft(
      extraction,
      "schema_invalid",
      validationErrors,
      options,
      originalOutput
    );
  }

  return saveGeneratedDraft(extraction, event.data, originalOutput, options);
}

async function saveGeneratedDraft(
  extraction: ExtractedSource,
  event: Event,
  originalOutput: string,
  options: StoreOptions
): Promise<DraftPipelineResult> {
  const id = safeRecordId(event.id);
  await appendDuplicateEventWarning(id, event.id, options);
  const record = await writeDraftRecord(
    id,
    {
      state: "generated",
      validation_errors: [],
      event,
      source_url: extraction.source_url,
      extraction_id: extraction.id,
      original_output: originalOutput,
      generated_at: (options.now?.() ?? new Date()).toISOString()
    },
    options
  );
  return {
    id,
    status: "success",
    path: record.relativePath
  };
}

async function saveInvalidDraft(
  extraction: ExtractedSource,
  failureType: InvalidDraftType,
  validationErrors: string[],
  options: StoreOptions,
  originalOutput?: unknown
): Promise<DraftPipelineResult> {
  const id = invalidDraftId(extraction.id, failureType, validationErrors, originalOutput);
  const record = await writeJsonRecord(
    "invalid",
    id,
    {
      state: "invalid",
      failure_type: failureType,
      validation_errors: validationErrors.length > 0 ? validationErrors : [`Draft failed: ${failureType}`],
      source_url: extraction.source_url,
      extraction_id: extraction.id,
      ...(originalOutput !== undefined ? { original_output: originalOutput } : {}),
      failed_at: (options.now?.() ?? new Date()).toISOString()
    },
    { ...options, logEvent: "validation" }
  );
  await appendRunLog(
    {
      eventType: "drafting",
      status: "failure",
      message: `Failed to draft event for ${extraction.source_url}`,
      refs: {
        invalidDraftId: id,
        invalidPath: record.relativePath,
        failureType
      }
    },
    options
  );
  return {
    id,
    status: "failure",
    path: record.relativePath,
    errors: validationErrors
  };
}

async function appendDuplicateEventWarning(id: string, eventId: string, options: RunLogOptions) {
  try {
    await inspectCurationRecord("drafts", id, options);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  await appendRunLog(
    {
      eventType: "duplicate_warning",
      status: "warning",
      message: `Duplicate draft event ${eventId}`,
      refs: { draftId: id, eventId }
    },
    options
  );
}

async function fetchWithTimeout(
  fetcher: DraftFetch,
  url: string,
  init: Omit<Parameters<DraftFetch>[1], "signal">,
  timeoutMs: number
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetcher(url, { ...init, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Draft API request timed out"));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function defaultDraftFetch(url: string, init: Parameters<DraftFetch>[1]) {
  return fetch(url, init) as Promise<DraftFetchResponse>;
}

function readDraftConfig(env: DraftEnvironment = process.env): DraftConfig {
  const baseUrl = env.OPENAI_BASE_URL?.trim();
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim();
  const errors = [
    ...(baseUrl ? [] : ["OPENAI_BASE_URL is required"]),
    ...(apiKey ? [] : ["OPENAI_API_KEY is required"]),
    ...(model ? [] : ["OPENAI_MODEL is required"])
  ];

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, baseUrl: baseUrl!, apiKey: apiKey!, model: model! };
}

function chineseValidationErrors(event: Event) {
  const fields: Array<{ path: string; value: string }> = [
    { path: "title", value: event.title },
    { path: "summary", value: event.summary },
    { path: "why_it_matters", value: event.why_it_matters }
  ];

  event.sources.forEach((source, sourceIndex) => {
    fields.push({ path: `sources.${sourceIndex}.title`, value: source.title });
  });

  event.causal_links?.forEach((link, linkIndex) => {
    fields.push({ path: `causal_links.${linkIndex}.explanation`, value: link.explanation });
    if (link.target_concept) {
      fields.push({ path: `causal_links.${linkIndex}.target_concept`, value: link.target_concept });
    }
    link.sources.forEach((source, sourceIndex) => {
      fields.push({
        path: `causal_links.${linkIndex}.sources.${sourceIndex}.title`,
        value: source.title
      });
    });
  });

  // Provider values are often brand names like OpenAI, NVIDIA, or Meta, so they are intentionally exempt.

  return fields
    .filter((field) => !containsCjk(field.value))
    .map((field) => `${field.path}: Draft output must be Chinese`);
}

function invalidDraftId(
  extractionId: string,
  failureType: InvalidDraftType,
  validationErrors: string[],
  originalOutput: unknown
) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ failureType, validationErrors, originalOutput }))
    .digest("hex")
    .slice(0, 10);
  return `${safeRecordId(extractionId)}-${failureType}-${hash}`;
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function safeRecordId(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized && normalized !== "." && normalized !== "..") {
    return normalized;
  }
  return `draft-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

async function safeResponseText(response: DraftFetchResponse) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
