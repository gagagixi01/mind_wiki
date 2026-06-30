import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { resolveCurationRoot, type StoreOptions } from "./store";

export const workbenchProviderProfileIds = ["profile-1", "profile-2", "profile-3"] as const;

export type WorkbenchProviderProfileId = (typeof workbenchProviderProfileIds)[number];

export type WorkbenchProviderProfile = {
  id: WorkbenchProviderProfileId;
  label: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  updatedAt: string;
};

export type WorkbenchProviderSettings = {
  activeProfileId: WorkbenchProviderProfileId;
  profiles: WorkbenchProviderProfile[];
};

export type WorkbenchProviderProfileInput = {
  id: WorkbenchProviderProfileId;
  label?: string;
  baseUrl?: string;
  apiKey?: string;
  modelId?: string;
};

export type WorkbenchProviderSettingsInput = {
  activeProfileId: WorkbenchProviderProfileId;
  profiles: WorkbenchProviderProfileInput[];
};

export type WorkbenchProviderProfileSummary = {
  id: WorkbenchProviderProfileId;
  label: string;
  baseUrl: string;
  modelId: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  updatedAt: string | null;
};

export type WorkbenchProviderSettingsSummary = {
  activeProfileId: WorkbenchProviderProfileId;
  profiles: WorkbenchProviderProfileSummary[];
};

export type DraftEnvironmentLike = {
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type WorkbenchProviderTestInput = {
  profileId?: WorkbenchProviderProfileId;
  profile?: WorkbenchProviderProfileInput;
};

type WorkbenchProviderTestResult =
  | { ok: true; status: number; message: string }
  | { ok: false; status: number; message: string };

type ProviderFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type ProviderFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<ProviderFetchResponse>;

const workbenchProviderProfileIdSchema = z.enum(workbenchProviderProfileIds);

const workbenchProviderProfileSchema = z
  .object({
    id: workbenchProviderProfileIdSchema,
    label: z.string().min(1),
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    modelId: z.string().min(1),
    updatedAt: z.string().datetime()
  })
  .strict();

const workbenchProviderSettingsSchema = z
  .object({
    activeProfileId: workbenchProviderProfileIdSchema,
    profiles: z.array(workbenchProviderProfileSchema).max(3)
  })
  .strict()
  .superRefine((value, context) => {
    const uniqueIds = new Set(value.profiles.map((profile) => profile.id));
    if (uniqueIds.size !== value.profiles.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Profile ids must be unique",
        path: ["profiles"]
      });
    }

    if (value.profiles.length > 0 && !value.profiles.some((profile) => profile.id === value.activeProfileId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "activeProfileId must point to a saved profile",
        path: ["activeProfileId"]
      });
    }
  });

const chatCompletionSchema = z
  .object({
    choices: z.array(z.object({}).passthrough()).min(1)
  })
  .passthrough();

const defaultSettings: WorkbenchProviderSettings = {
  activeProfileId: "profile-1",
  profiles: []
};

function settingsPath(rootDir = process.cwd()) {
  return join(resolveCurationRoot(rootDir), "workbench-provider-settings.json");
}

function normalizeBaseUrl(value = "") {
  return value.trim().replace(/\/+$/, "");
}

function maskApiKey(apiKey: string) {
  if (!apiKey) {
    return "";
  }
  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}...${apiKey.slice(-2)}`;
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function emptySummary(id: WorkbenchProviderProfileId): WorkbenchProviderProfileSummary {
  return {
    id,
    label: "",
    baseUrl: "",
    modelId: "",
    hasApiKey: false,
    maskedApiKey: "",
    updatedAt: null
  };
}

function profileLabel(input: { id: WorkbenchProviderProfileId; label?: string; modelId?: string }) {
  const trimmedLabel = input.label?.trim() ?? "";
  if (trimmedLabel) {
    return trimmedLabel;
  }

  const trimmedModelId = input.modelId?.trim() ?? "";
  if (trimmedModelId) {
    return trimmedModelId;
  }

  const slotNumber = input.id.split("-").at(-1) ?? "1";
  return `Profile ${slotNumber}`;
}

function isEmptyProfileInput(profile: WorkbenchProviderProfileInput) {
  return !profile.label?.trim() && !profile.baseUrl?.trim() && !profile.apiKey?.trim() && !profile.modelId?.trim();
}

async function defaultProviderFetch(url: string, init: Parameters<ProviderFetch>[1]) {
  return fetch(url, init) as Promise<ProviderFetchResponse>;
}

async function fetchWithTimeout<TResponse extends ProviderFetchResponse>(
  fetcher: ProviderFetch,
  url: string,
  init: Parameters<ProviderFetch>[1],
  timeoutMs: number
): Promise<TResponse> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fetcher(url, {
        ...init,
        signal: controller.signal
      }) as Promise<TResponse>,
      new Promise<TResponse>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Provider settings test timed out"));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function safeResponseText(response: ProviderFetchResponse) {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}

function validateProfileId(id: string): WorkbenchProviderProfileId {
  return workbenchProviderProfileIdSchema.parse(id);
}

export async function readWorkbenchProviderSettings(options: StoreOptions = {}): Promise<WorkbenchProviderSettings> {
  const filePath = settingsPath(options.rootDir);

  try {
    const raw = await readFile(filePath, "utf8");
    return workbenchProviderSettingsSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return defaultSettings;
    }
    throw error;
  }
}

export async function readWorkbenchProviderSettingsSummary(
  options: StoreOptions = {}
): Promise<WorkbenchProviderSettingsSummary> {
  const settings = await readWorkbenchProviderSettings(options);
  const summaryById = new Map(
    settings.profiles.map((profile) => [
      profile.id,
      {
        id: profile.id,
        label: profile.label,
        baseUrl: profile.baseUrl,
        modelId: profile.modelId,
        hasApiKey: Boolean(profile.apiKey),
        maskedApiKey: maskApiKey(profile.apiKey),
        updatedAt: profile.updatedAt
      } satisfies WorkbenchProviderProfileSummary
    ])
  );

  return {
    activeProfileId: settings.activeProfileId,
    profiles: workbenchProviderProfileIds.map((id) => summaryById.get(id) ?? emptySummary(id))
  };
}

export async function saveWorkbenchProviderSettings(
  input: WorkbenchProviderSettingsInput,
  options: StoreOptions = {}
): Promise<WorkbenchProviderSettings> {
  const existing = await readWorkbenchProviderSettings(options);
  const existingProfiles = new Map(existing.profiles.map((profile) => [profile.id, profile]));

  if (input.profiles.length > 3) {
    throw new Error("At most 3 provider profiles may be saved.");
  }

  const seenIds = new Set<WorkbenchProviderProfileId>();
  const profiles: WorkbenchProviderProfile[] = [];
  for (const profile of input.profiles) {
    const id = validateProfileId(profile.id);
    if (seenIds.has(id)) {
      throw new Error(`Duplicate provider profile id: ${id}`);
    }
    seenIds.add(id);

    if (isEmptyProfileInput(profile)) {
      continue;
    }

    const baseUrl = normalizeBaseUrl(profile.baseUrl);
    const modelId = profile.modelId?.trim() ?? "";
    const nextApiKey = profile.apiKey?.trim() ?? "";
    const previousProfile = existingProfiles.get(id);
    const apiKey = nextApiKey || previousProfile?.apiKey || "";

    if (!baseUrl) {
      throw new Error(`Profile ${id} requires baseUrl.`);
    }
    if (!modelId) {
      throw new Error(`Profile ${id} requires modelId.`);
    }
    if (!apiKey) {
      throw new Error(`Profile ${id} requires apiKey.`);
    }

    profiles.push(
      workbenchProviderProfileSchema.parse({
        id,
        label: profileLabel({ id, label: profile.label, modelId }),
        baseUrl,
        apiKey,
        modelId,
        updatedAt: (options.now?.() ?? new Date()).toISOString()
      })
    );
  }

  if (profiles.length === 0) {
    throw new Error("At least one provider profile is required.");
  }

  const activeProfileId = validateProfileId(input.activeProfileId);
  if (!profiles.some((profile) => profile.id === activeProfileId)) {
    throw new Error("activeProfileId must point to a saved profile.");
  }

  const settings = workbenchProviderSettingsSchema.parse({
    activeProfileId,
    profiles
  });

  const curationRoot = resolveCurationRoot(options.rootDir);
  await mkdir(curationRoot, { recursive: true });
  await writeFile(settingsPath(options.rootDir), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export async function resolveActiveWorkbenchProviderEnvironment(
  options: StoreOptions = {}
): Promise<DraftEnvironmentLike | undefined> {
  const settings = await readWorkbenchProviderSettings(options);
  const activeProfile = settings.profiles.find((profile) => profile.id === settings.activeProfileId);
  if (!activeProfile) {
    return undefined;
  }

  return {
    OPENAI_BASE_URL: activeProfile.baseUrl,
    OPENAI_API_KEY: activeProfile.apiKey,
    OPENAI_MODEL: activeProfile.modelId
  };
}

export async function testWorkbenchProviderProfile(
  input: WorkbenchProviderTestInput,
  options: StoreOptions & { fetcher?: ProviderFetch; timeoutMs?: number } = {}
): Promise<WorkbenchProviderTestResult> {
  const settings = await readWorkbenchProviderSettings(options);
  const byId = new Map(settings.profiles.map((profile) => [profile.id, profile]));

  const resolvedProfile =
    input.profileId
      ? byId.get(validateProfileId(input.profileId))
      : input.profile
        ? (() => {
            const id = validateProfileId(input.profile.id);
            const existing = byId.get(id);
            const baseUrl = normalizeBaseUrl(input.profile.baseUrl);
            const modelId = input.profile.modelId?.trim() ?? "";
            const nextApiKey = input.profile.apiKey?.trim() ?? "";
            return {
              id,
              label: profileLabel({ id, label: input.profile.label, modelId }),
              baseUrl,
              apiKey: nextApiKey || existing?.apiKey || "",
              modelId,
              updatedAt: existing?.updatedAt ?? (options.now?.() ?? new Date()).toISOString()
            } satisfies WorkbenchProviderProfile;
          })()
        : undefined;

  if (!resolvedProfile) {
    return { ok: false, status: 400, message: "No provider profile was supplied for testing." };
  }

  if (!resolvedProfile.baseUrl) {
    return { ok: false, status: 400, message: "Base URL is required." };
  }
  if (!resolvedProfile.apiKey) {
    return { ok: false, status: 400, message: "API key is required." };
  }
  if (!resolvedProfile.modelId) {
    return { ok: false, status: 400, message: "Model ID is required." };
  }

  let response: ProviderFetchResponse;
  try {
    response = await fetchWithTimeout(
      options.fetcher ?? defaultProviderFetch,
      `${resolvedProfile.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolvedProfile.apiKey}`
        },
        body: JSON.stringify({
          model: resolvedProfile.modelId,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0
        })
      },
      options.timeoutMs ?? 10_000
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 502,
      message: message === "Provider settings test timed out" ? "Connection test timed out." : `Connection failed: ${message}`
    };
  }

  if (!response.ok) {
    const body = await safeResponseText(response);
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, message: "Authentication failed. Check the API key." };
    }
    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        message: "The provider base URL or chat-completions path could not be reached."
      };
    }
    return {
      ok: false,
      status: response.status,
      message: `Connection test failed with HTTP ${response.status}${body ? `: ${body}` : ""}`
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, status: 502, message: "The provider returned malformed JSON." };
  }

  const parsed = chatCompletionSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "The provider response is not compatible with OpenAI chat completions."
    };
  }

  return {
    ok: true,
    status: response.status,
    message: `Connection succeeded for ${resolvedProfile.modelId}.`
  };
}
