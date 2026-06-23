import { mkdtemp, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { cleanAppleDoubleFiles, findAppleDoubleFiles } from "./clean-appledouble.mjs";

describe("AppleDouble cleanup", () => {
  it("removes AppleDouble files outside .git and leaves .git internals untouched", async () => {
    const root = await mkdtemp(join(tmpdir(), "mind-wiki-appledouble-"));
    const nested = join(root, "content");
    const gitDir = join(root, ".git", "objects");
    const removable = join(nested, "._source.mdx");
    const ignored = join(gitDir, "._pack");

    await mkdir(nested, { recursive: true });
    await mkdir(gitDir, { recursive: true });
    await writeFile(removable, "metadata");
    await writeFile(ignored, "git metadata");

    await expect(findAppleDoubleFiles(root)).resolves.toEqual([removable]);
    await expect(cleanAppleDoubleFiles(root)).resolves.toEqual([removable]);
    await expect(stat(ignored)).resolves.toBeTruthy();
    await expect(stat(removable)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
