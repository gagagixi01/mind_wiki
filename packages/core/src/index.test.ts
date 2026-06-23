import { describe, expect, it } from "vitest";

import { APP_NAME, confidenceTones, workspaceScopes } from "./index";

describe("@mind-wiki/core shell", () => {
  it("exposes shared app identity and visual vocabulary", () => {
    expect(APP_NAME).toBe("Mind Wiki AI Progress");
    expect(workspaceScopes).toEqual(["public-site", "local-workbench"]);
    expect(confidenceTones.high).toBe("ok");
    expect(confidenceTones.low).toBe("risk");
  });
});
