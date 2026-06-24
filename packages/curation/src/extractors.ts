import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { promisify } from "node:util";

import { appendRunLog, type RunLogOptions } from "./run-log";
import { buildExtractionQualityReport } from "./quality";
import {
  inspectCurationRecord,
  writeJsonRecord,
  writeQualityReport,
  type StoreOptions
} from "./store";

const execFileAsync = promisify(execFile);

export type ExtractorName = "crawl4ai" | "trafilatura" | "none";

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CommandExecutor = (
  command: string,
  args: string[],
  options?: { timeoutMs?: number; input?: string }
) => Promise<CommandResult>;

export type HostResolver = (hostname: string) => Promise<string[]>;

export type RedirectChecker = (
  sourceUrl: string,
  options: { maxRedirects: number; resolver: HostResolver; transport: BoundRequestTransport; timeoutMs?: number }
) => Promise<string[]>;

export type ControlledFetchResult = {
  finalUrl: string;
  contentType: string;
  body: string;
};

export type ContentFetcher = (
  sourceUrl: string,
  options: {
    maxRedirects: number;
    resolver: HostResolver;
    transport: BoundRequestTransport;
    timeoutMs?: number;
  }
) => Promise<ControlledFetchResult>;

export type BoundRequest = {
  url: string;
  method: "HEAD" | "GET";
  pinnedAddress: string;
  timeoutMs?: number;
};

export type BoundResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type BoundRequestTransport = (request: BoundRequest) => Promise<BoundResponse>;

export type ExtractedSource = {
  id: string;
  source_url: string;
  status: "success" | "failure";
  extractor: ExtractorName;
  title?: string;
  text?: string;
  markdown?: string;
  html?: string;
  sources?: Array<{ title?: string; url?: string }>;
  errors?: string[];
  failure?: string;
};

export type ExtractUrlOptions = StoreOptions & {
  executor?: CommandExecutor;
  resolver?: HostResolver;
  redirectChecker?: RedirectChecker;
  contentFetcher?: ContentFetcher;
  requestTransport?: BoundRequestTransport;
  maxRedirects?: number;
  timeoutMs?: number;
};

type AdapterSuccess = Omit<ExtractedSource, "id" | "source_url" | "status" | "extractor"> & {
  extractor: Exclude<ExtractorName, "none">;
};

type AdapterFailure = {
  extractor: Exclude<ExtractorName, "none">;
  error: string;
};

export function isPublicHttpUrl(value: string) {
  try {
    validatePublicHttpUrl(value);
    return true;
  } catch {
    return false;
  }
}

export function validatePublicHttpUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("URL credentials are not allowed");
  }
  if (!url.hostname) {
    throw new Error("URL host is required");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error(`URL host is not public: ${url.hostname}`);
  }
  return url.toString();
}

export async function extractUrl(
  sourceUrl: string,
  options: ExtractUrlOptions = {}
): Promise<ExtractedSource> {
  const normalizedUrl = validatePublicHttpUrl(sourceUrl);
  const id = sourceId(normalizedUrl);
  const executor = options.executor ?? defaultCommandExecutor;
  const failures: AdapterFailure[] = [];
  let fetchedContent: ControlledFetchResult;
  try {
    await preflightExtractionUrl(normalizedUrl, options);
    fetchedContent = await controlledFetchContent(normalizedUrl, options);
  } catch (error) {
    const message = errorMessage(error);
    const failed: ExtractedSource = {
      id,
      source_url: normalizedUrl,
      status: "failure",
      extractor: "none",
      errors: [message],
      failure: message
    };
    await persistExtraction(failed, options);
    return failed;
  }

  await appendDuplicateSourceWarning(id, normalizedUrl, options);

  for (const adapter of [runCrawl4AI, runTrafilatura]) {
    const result = await adapter(fetchedContent, normalizedUrl, executor, options.timeoutMs);
    if ("error" in result) {
      failures.push(result);
      continue;
    }

    const extracted: ExtractedSource = {
      id,
      source_url: normalizedUrl,
      status: "success",
      extractor: result.extractor,
      ...(result.title ? { title: result.title } : {}),
      ...(result.text ? { text: result.text } : {}),
      ...(result.markdown ? { markdown: result.markdown } : {}),
      ...(result.html ? { html: result.html } : {}),
      ...(result.sources ? { sources: result.sources } : {})
    };
    await persistExtraction(extracted, options);
    return extracted;
  }

  const failure = failures.map((item) => `${item.extractor}: ${item.error}`).join("; ");
  const failed: ExtractedSource = {
    id,
    source_url: normalizedUrl,
    status: "failure",
    extractor: "none",
    errors: failures.map((item) => item.error),
    failure: failure || "No extractor produced usable output"
  };
  await persistExtraction(failed, options);
  return failed;
}

async function controlledFetchContent(sourceUrl: string, options: ExtractUrlOptions) {
  const resolver = options.resolver ?? defaultHostResolver;
  const transport = options.requestTransport ?? defaultBoundRequestTransport;
  const maxRedirects = options.maxRedirects ?? 5;
  return (options.contentFetcher ?? defaultContentFetcher)(sourceUrl, {
    maxRedirects,
    resolver,
    transport,
    timeoutMs: options.timeoutMs
  });
}

async function preflightExtractionUrl(sourceUrl: string, options: ExtractUrlOptions) {
  const resolver = options.resolver ?? defaultHostResolver;
  const transport = options.requestTransport ?? defaultBoundRequestTransport;
  const maxRedirects = options.maxRedirects ?? 5;
  await validateResolvedUrl(sourceUrl, resolver, "Source URL");

  const redirectTargets = await (options.redirectChecker ?? defaultRedirectChecker)(sourceUrl, {
    maxRedirects,
    resolver,
    transport,
    timeoutMs: options.timeoutMs
  });
  for (const target of redirectTargets) {
    try {
      const normalizedTarget = validatePublicHttpUrl(target);
      await validateResolvedUrl(normalizedTarget, resolver, "Redirect target");
    } catch (error) {
      throw new Error(`Redirect target is not public: ${target}: ${errorMessage(error)}`);
    }
  }
}

async function validateResolvedUrl(sourceUrl: string, resolver: HostResolver, label: string) {
  await resolvePinnedAddress(sourceUrl, resolver, label);
}

async function resolvePinnedAddress(sourceUrl: string, resolver: HostResolver, label: string) {
  const url = new URL(sourceUrl);
  const host = normalizedHostForChecks(url.hostname);
  if (isIpLiteral(host)) {
    return host;
  }

  const addresses = await resolver(host);
  if (addresses.length === 0) {
    throw new Error(`${label} ${host} did not resolve`);
  }
  const unsafeAddress = addresses.find((address) => isBlockedHost(address));
  if (unsafeAddress) {
    throw new Error(`${label} ${host} resolved to non-public address ${unsafeAddress}`);
  }
  const pinnedAddress = addresses[0];
  if (!pinnedAddress) {
    throw new Error(`${label} ${host} did not resolve`);
  }
  return pinnedAddress;
}

async function runCrawl4AI(
  content: ControlledFetchResult,
  sourceUrl: string,
  executor: CommandExecutor,
  timeoutMs?: number
): Promise<AdapterSuccess | AdapterFailure> {
  // Conservative content-processing shape: feed already-fetched content over stdin so the tool does not refetch.
  return runJsonAdapter("crawl4ai", ["--input", "-", "--output", "json"], "crawl4ai", sourceUrl, content, executor, timeoutMs);
}

async function runTrafilatura(
  content: ControlledFetchResult,
  sourceUrl: string,
  executor: CommandExecutor,
  timeoutMs?: number
): Promise<AdapterSuccess | AdapterFailure> {
  return runJsonAdapter("trafilatura", ["--json", "--input", "-"], "trafilatura", sourceUrl, content, executor, timeoutMs);
}

async function runJsonAdapter(
  command: string,
  args: string[],
  extractor: Exclude<ExtractorName, "none">,
  sourceUrl: string,
  content: ControlledFetchResult,
  executor: CommandExecutor,
  timeoutMs?: number
): Promise<AdapterSuccess | AdapterFailure> {
  try {
    const result = await executor(command, args, { timeoutMs, input: content.body });
    if (result.exitCode !== 0) {
      return {
        extractor,
        error: result.stderr.trim() || `${command} exited with code ${result.exitCode}`
      };
    }
    return parseExtractorOutput(extractor, sourceUrl, result.stdout);
  } catch (error) {
    return {
      extractor,
      error: errorMessage(error)
    };
  }
}

function parseExtractorOutput(
  extractor: Exclude<ExtractorName, "none">,
  sourceUrl: string,
  stdout: string
): AdapterSuccess | AdapterFailure {
  const raw = stdout.trim();
  if (!raw) {
    return { extractor, error: "Extractor returned empty output" };
  }

  let payload: unknown = raw;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { text: raw };
  }

  const record = objectRecord(payload);
  const text = stringField(record, "text") ?? stringField(record, "content") ?? stringField(record, "markdown");
  if (!text?.trim()) {
    return { extractor, error: "Extractor output did not include article text" };
  }

  return {
    extractor,
    ...(stringField(record, "title") ? { title: stringField(record, "title") } : {}),
    text,
    ...(stringField(record, "markdown") ? { markdown: stringField(record, "markdown") } : {}),
    ...(stringField(record, "html") ? { html: stringField(record, "html") } : {}),
    sources: normalizeSources(record.sources, sourceUrl)
  };
}

async function persistExtraction(extraction: ExtractedSource, options: RunLogOptions) {
  await writeJsonRecord("raw", extraction.id, extraction, options);
  const report = buildExtractionQualityReport({
    source_url: extraction.source_url,
    extractor: extraction.extractor,
    status: extraction.status,
    title: extraction.title,
    text: extraction.text,
    sources: extraction.sources,
    errors: extraction.errors,
    failure: extraction.failure
  });
  await writeQualityReport(extraction.id, report, options);
  await appendRunLog(
    {
      eventType: "extraction",
      status: extraction.status === "failure" || !report.reviewable ? "failure" : "success",
      message: extraction.status === "failure"
        ? `Failed to extract ${extraction.source_url}`
        : `Extracted ${extraction.source_url} with ${extraction.extractor}`,
      refs: {
        sourceId: extraction.id,
        sourceUrl: extraction.source_url,
        extractor: extraction.extractor,
        reviewable: report.reviewable
      }
    },
    options
  );
}

async function appendDuplicateSourceWarning(id: string, sourceUrl: string, options: RunLogOptions) {
  try {
    await inspectCurationRecord("raw", id, options);
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
      message: `Duplicate source extraction for ${sourceUrl}`,
      refs: { sourceId: id, sourceUrl }
    },
    options
  );
}

export function sourceId(sourceUrl: string) {
  const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);
  return `source-${hash}`;
}

async function defaultCommandExecutor(
  command: string,
  args: string[],
  options: { timeoutMs?: number; input?: string } = {}
): Promise<CommandResult> {
  if (options.input !== undefined) {
    return spawnCommand(command, args, options);
  }
  try {
    const result = await execFileAsync(command, args, {
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: 10 * 1024 * 1024
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    };
  } catch (error) {
    if (isExecFileError(error)) {
      return {
        stdout: String(error.stdout ?? ""),
        stderr: String(error.stderr ?? error.message),
        exitCode: typeof error.code === "number" ? error.code : 1
      };
    }
    throw error;
  }
}

async function spawnCommand(
  command: string,
  args: string[],
  options: { timeoutMs?: number; input?: string }
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out`));
    }, options.timeoutMs ?? 30_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });
    child.stdin.end(options.input);
  });
}

async function defaultHostResolver(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function defaultBoundRequestTransport(request: BoundRequest): Promise<BoundResponse> {
  const url = new URL(request.url);
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const hostHeader = url.port ? `${url.hostname}:${url.port}` : url.hostname;

  return new Promise((resolve, reject) => {
    const clientRequest = transport({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: request.method,
      headers: {
        Host: hostHeader,
        "User-Agent": "mind-wiki-curation/0.1"
      },
      servername: url.protocol === "https:" ? url.hostname : undefined,
      timeout: request.timeoutMs ?? 30_000,
      lookup: (_hostname, _options, callback) => {
        callback(null, request.pinnedAddress, request.pinnedAddress.includes(":") ? 6 : 4);
      }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          headers: normalizeHeaders(response.headers),
          body
        });
      });
    });

    clientRequest.on("timeout", () => {
      clientRequest.destroy(new Error(`Request timed out for ${request.url}`));
    });
    clientRequest.on("error", reject);
    clientRequest.end();
  });
}

async function defaultRedirectChecker(
  sourceUrl: string,
  options: { maxRedirects: number; resolver: HostResolver; transport: BoundRequestTransport; timeoutMs?: number }
) {
  const redirects: string[] = [];
  let currentUrl = sourceUrl;

  for (let index = 0; index < options.maxRedirects; index += 1) {
    const normalizedCurrentUrl = validatePublicHttpUrl(currentUrl);
    const pinnedAddress = await resolvePinnedAddress(normalizedCurrentUrl, options.resolver, "Redirect URL");
    const response = await options.transport({
      url: normalizedCurrentUrl,
      method: "HEAD",
      pinnedAddress,
      timeoutMs: options.timeoutMs
    });
    if (response.status < 300 || response.status >= 400) {
      return redirects;
    }

    const location = response.headers.location;
    if (!location) {
      return redirects;
    }

    const nextUrl = new URL(location, currentUrl).toString();
    await validateRedirectTarget(nextUrl, options.resolver);
    currentUrl = nextUrl;
    redirects.push(nextUrl);
  }

  throw new Error(`Redirect chain exceeded ${options.maxRedirects} redirects`);
}

async function defaultContentFetcher(
  sourceUrl: string,
  options: {
    maxRedirects: number;
    resolver: HostResolver;
    transport: BoundRequestTransport;
    timeoutMs?: number;
  }
): Promise<ControlledFetchResult> {
  let currentUrl = sourceUrl;

  for (let index = 0; index <= options.maxRedirects; index += 1) {
    const normalizedCurrentUrl = validatePublicHttpUrl(currentUrl);
    const pinnedAddress = await resolvePinnedAddress(normalizedCurrentUrl, options.resolver, "Fetch URL");
    const response = await options.transport({
      url: normalizedCurrentUrl,
      method: "GET",
      pinnedAddress,
      timeoutMs: options.timeoutMs
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location) {
        throw new Error(`Redirect response missing Location header for ${currentUrl}`);
      }
      const nextUrl = new URL(location, normalizedCurrentUrl).toString();
      await validateRedirectTarget(nextUrl, options.resolver);
      currentUrl = nextUrl;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Controlled fetch failed with HTTP ${response.status} for ${currentUrl}`);
    }

    return {
      finalUrl: normalizedCurrentUrl,
      contentType: response.headers["content-type"] ?? "",
      body: response.body
    };
  }

  throw new Error(`Controlled fetch exceeded ${options.maxRedirects} redirects`);
}

async function validateRedirectTarget(targetUrl: string, resolver: HostResolver) {
  try {
    const normalizedTarget = validatePublicHttpUrl(targetUrl);
    await validateResolvedUrl(normalizedTarget, resolver, "Redirect target");
  } catch (error) {
    throw new Error(`Redirect target is not public: ${targetUrl}: ${errorMessage(error)}`);
  }
}

function normalizeHeaders(headers: Record<string, string | string[] | number | undefined>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(", ");
    } else if (value !== undefined) {
      normalized[key.toLowerCase()] = String(value);
    }
  }
  return normalized;
}

function normalizeSources(value: unknown, fallbackUrl: string) {
  if (!Array.isArray(value)) {
    return [{ url: fallbackUrl }];
  }

  const sources = value
    .map((source) => objectRecord(source))
    .map((source) => ({
      ...(stringField(source, "title") ? { title: stringField(source, "title") } : {}),
      ...(stringField(source, "url") ? { url: stringField(source, "url") } : {})
    }))
    .filter((source) => source.url);

  return sources.length > 0 ? sources : [{ url: fallbackUrl }];
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isBlockedHost(hostname: string) {
  const host = normalizedHostForChecks(hostname);
  if (host === "localhost" || host.endsWith(".localhost")) {
    return true;
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return true;
  }
  return false;
}

function isIpLiteral(host: string) {
  return isIpv4Literal(host) || host.includes(":");
}

function normalizedHostForChecks(hostname: string) {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.+$/, "");
}

function isIpv4Literal(host: string) {
  const parts = host.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      const octet = Number(part);
      return Number.isInteger(octet) && octet >= 0 && octet <= 255 && String(octet) === part;
    })
  );
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const first = octets[0]!;
  const second = octets[1]!;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second !== undefined && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && second !== undefined && second >= 18 && second <= 19) ||
    (first === 198 && second === 51 && octets[2] === 100) ||
    (first === 203 && second === 0 && octets[2] === 113) ||
    first >= 224
  );
}

function isPrivateIpv6(host: string) {
  if (!host.includes(":")) {
    return false;
  }
  if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }
  const mappedIpv4 = ipv4MappedIpv6Address(host);
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4);
  }
  const first = host.split(":")[0] ?? "";
  const firstGroup = Number.parseInt(first, 16);
  if (!Number.isFinite(firstGroup)) {
    return false;
  }
  return (
    (firstGroup & 0xfe00) === 0xfc00 ||
    (firstGroup & 0xffc0) === 0xfe80 ||
    (firstGroup & 0xff00) === 0xff00 ||
    host.startsWith("2001:db8:")
  );
}

function ipv4MappedIpv6Address(host: string) {
  const marker = ":ffff:";
  const markerIndex = host.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const suffix = host.slice(markerIndex + marker.length);
  if (suffix.includes(".")) {
    return suffix;
  }

  const groups = suffix.split(":");
  if (groups.length !== 2) {
    return null;
  }
  const [highGroup, lowGroup] = groups.map((group) => Number.parseInt(group, 16));
  if (
    highGroup === undefined ||
    lowGroup === undefined ||
    !Number.isInteger(highGroup) ||
    !Number.isInteger(lowGroup) ||
    highGroup < 0 ||
    highGroup > 0xffff ||
    lowGroup < 0 ||
    lowGroup > 0xffff
  ) {
    return null;
  }

  return [
    highGroup >> 8,
    highGroup & 0xff,
    lowGroup >> 8,
    lowGroup & 0xff
  ].join(".");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

type ExecFileError = Error & { stdout?: unknown; stderr?: unknown; code?: unknown };

function isExecFileError(error: unknown): error is ExecFileError {
  return error instanceof Error && ("stdout" in error || "stderr" in error || "code" in error);
}
