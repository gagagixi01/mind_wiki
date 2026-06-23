import { readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APPLEDOUBLE_PREFIX = "._";

async function walkForAppleDoubleFiles(root, results) {
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(root, entry.name);

    if (entry.name === ".git" && entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith(APPLEDOUBLE_PREFIX)) {
      results.push(absolutePath);
      continue;
    }

    if (entry.isDirectory()) {
      await walkForAppleDoubleFiles(absolutePath, results);
    }
  }
}

export async function findAppleDoubleFiles(root = process.cwd()) {
  const results = [];
  await walkForAppleDoubleFiles(resolve(root), results);
  return results.sort();
}

export async function cleanAppleDoubleFiles(root = process.cwd()) {
  const files = await findAppleDoubleFiles(root);
  await Promise.all(files.map((file) => rm(file, { force: true, recursive: true })));
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const removed = await cleanAppleDoubleFiles(process.cwd());
  if (removed.length === 0) {
    console.log("No AppleDouble files found outside .git.");
  } else {
    console.log(`Removed ${removed.length} AppleDouble file(s) outside .git.`);
    for (const file of removed.slice(0, 25)) {
      console.log(file);
    }
    if (removed.length > 25) {
      console.log(`...and ${removed.length - 25} more.`);
    }
  }
}
