const TRACKING_PARAMS = new Set(["fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "ref"]);

export function normalizeSourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    for (const param of [...url.searchParams.keys()]) {
      if (param.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }

    const normalized = url.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    const withoutHash = trimmed.split("#")[0] ?? trimmed;
    return withoutHash.endsWith("/") ? withoutHash.slice(0, -1) : withoutHash;
  }
}

export function normalizeEventTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyEventTitle(title: string): string {
  return normalizeEventTitle(title).replace(/\s+/g, "-");
}
