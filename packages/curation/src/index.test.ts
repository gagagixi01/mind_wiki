import { describe, expect, it } from "vitest";

import { CURATION_STATE_DIR, isLocalOnlyPath } from "./index";

describe("@mind-wiki/curation shell", () => {
  it("marks local curation paths as non-public workspace state", () => {
    expect(CURATION_STATE_DIR).toBe(".curation");
    expect(isLocalOnlyPath(".curation")).toBe(true);
    expect(isLocalOnlyPath(".curation/runs/latest.json")).toBe(true);
    expect(isLocalOnlyPath("apps/site/content/approved/example.mdx")).toBe(false);
  });
});
