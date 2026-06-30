import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readWorkbenchProviderSettingsSummary,
  resolveActiveWorkbenchProviderEnvironment,
  saveWorkbenchProviderSettings,
  testWorkbenchProviderProfile
} from "./provider-settings";

async function makeWorkspaceRoot() {
  const root = await mkdtemp(join(tmpdir(), "mind-wiki-provider-settings-"));
  await mkdir(join(root, "content", "approved", "events"), { recursive: true });
  return root;
}

describe("workbench provider settings", () => {
  it("returns masked summaries across three fixed profile slots", async () => {
    const rootDir = await makeWorkspaceRoot();

    await saveWorkbenchProviderSettings(
      {
        activeProfileId: "profile-1",
        profiles: [
          {
            id: "profile-1",
            label: "Primary",
            baseUrl: "https://api.example.test/v1/",
            apiKey: "sk-live-secret",
            modelId: "gpt-4.1-mini"
          }
        ]
      },
      {
        rootDir,
        now: () => new Date("2026-06-29T00:00:00.000Z")
      }
    );

    const summary = await readWorkbenchProviderSettingsSummary({ rootDir });

    expect(summary.activeProfileId).toBe("profile-1");
    expect(summary.profiles).toEqual([
      {
        id: "profile-1",
        label: "Primary",
        baseUrl: "https://api.example.test/v1",
        modelId: "gpt-4.1-mini",
        hasApiKey: true,
        maskedApiKey: "sk-l...cret",
        updatedAt: "2026-06-29T00:00:00.000Z"
      },
      {
        id: "profile-2",
        label: "",
        baseUrl: "",
        modelId: "",
        hasApiKey: false,
        maskedApiKey: "",
        updatedAt: null
      },
      {
        id: "profile-3",
        label: "",
        baseUrl: "",
        modelId: "",
        hasApiKey: false,
        maskedApiKey: "",
        updatedAt: null
      }
    ]);
  });

  it("preserves the stored key when a saved profile is updated with a blank apiKey", async () => {
    const rootDir = await makeWorkspaceRoot();

    await saveWorkbenchProviderSettings(
      {
        activeProfileId: "profile-1",
        profiles: [
          {
            id: "profile-1",
            label: "Primary",
            baseUrl: "https://api.example.test/v1",
            apiKey: "sk-live-secret",
            modelId: "gpt-4.1-mini"
          }
        ]
      },
      {
        rootDir,
        now: () => new Date("2026-06-29T00:00:00.000Z")
      }
    );

    await saveWorkbenchProviderSettings(
      {
        activeProfileId: "profile-1",
        profiles: [
          {
            id: "profile-1",
            label: "Updated",
            baseUrl: "https://api.example.test/v1",
            apiKey: "",
            modelId: "gpt-4.1"
          }
        ]
      },
      {
        rootDir,
        now: () => new Date("2026-06-29T01:00:00.000Z")
      }
    );

    const environment = await resolveActiveWorkbenchProviderEnvironment({ rootDir });

    expect(environment).toEqual({
      OPENAI_BASE_URL: "https://api.example.test/v1",
      OPENAI_API_KEY: "sk-live-secret",
      OPENAI_MODEL: "gpt-4.1"
    });
  });

  it("tests a draft profile using the saved key when the form leaves apiKey blank", async () => {
    const rootDir = await makeWorkspaceRoot();

    await saveWorkbenchProviderSettings(
      {
        activeProfileId: "profile-2",
        profiles: [
          {
            id: "profile-2",
            label: "Sandbox",
            baseUrl: "https://api.example.test/v1",
            apiKey: "sk-live-secret",
            modelId: "gpt-4.1-mini"
          }
        ]
      },
      { rootDir }
    );

    const requests: Array<{ url: string; authorization: string | undefined; model: string }> = [];
    const result = await testWorkbenchProviderProfile(
      {
        profile: {
          id: "profile-2",
          label: "Sandbox",
          baseUrl: "https://router.example.test/v1",
          apiKey: "",
          modelId: "gpt-4.1"
        }
      },
      {
        rootDir,
        fetcher: async (url, init) => {
          requests.push({
            url,
            authorization: init.headers.Authorization,
            model: JSON.parse(init.body).model as string
          });
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{}] }),
            text: async () => ""
          };
        }
      }
    );

    expect(result).toEqual({
      ok: true,
      status: 200,
      message: "Connection succeeded for gpt-4.1."
    });
    expect(requests).toEqual([
      {
        url: "https://router.example.test/v1/chat/completions",
        authorization: "Bearer sk-live-secret",
        model: "gpt-4.1"
      }
    ]);
  });
});
