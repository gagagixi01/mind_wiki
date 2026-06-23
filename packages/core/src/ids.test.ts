import { describe, expect, it } from "vitest";

import { normalizeEventTitle, normalizeSourceUrl, slugifyEventTitle } from "./ids";

describe("content identity helpers", () => {
  it("normalizes source URLs for duplicate detection", () => {
    expect(normalizeSourceUrl("https://Example.com/research/?utm_source=newsletter#section")).toBe(
      "https://example.com/research"
    );
  });

  it("normalizes event titles conservatively", () => {
    expect(normalizeEventTitle("Transformer update!")).toBe("transformer update");
  });

  it("creates stable slugs from event titles", () => {
    expect(slugifyEventTitle("Transformer update!")).toBe("transformer-update");
  });
});
