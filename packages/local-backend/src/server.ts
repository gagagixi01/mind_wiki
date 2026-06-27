import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { handleApiRequest } from "./routes";

const host = "127.0.0.1";
const port = Number(process.env.MIND_WIKI_BACKEND_PORT ?? 8001);

export function resolveRootDir(cwd = process.cwd(), configuredRoot = process.env.MIND_WIKI_ROOT_DIR) {
  if (configuredRoot) {
    return resolve(configuredRoot);
  }

  const candidates = [cwd, resolve(cwd, "..", "..")];
  return candidates.find((candidate) => existsSync(resolve(candidate, "pnpm-workspace.yaml"))) ?? cwd;
}

const rootDir = resolveRootDir();

const server = createServer(async (nodeRequest, nodeResponse) => {
  const chunks: Buffer[] = [];
  for await (const chunk of nodeRequest) {
    chunks.push(Buffer.from(chunk));
  }

  const request = new Request(`http://${host}:${port}${nodeRequest.url ?? "/"}`, {
    method: nodeRequest.method,
    headers: nodeRequest.headers as HeadersInit,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined
  });
  const response = await handleApiRequest(request, { rootDir });
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => nodeResponse.setHeader(key, value));
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, host, () => {
  console.log(`mind_wiki local backend listening on http://${host}:${port}`);
});
