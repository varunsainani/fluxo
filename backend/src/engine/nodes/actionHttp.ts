import type { NodeHandler } from "./types";
import { asString, asNumber, asArray } from "./types";

interface HeaderPair {
  key: string;
  value: string;
}

/**
 * action.http — real fetch (Node 20 global fetch).
 * config { method, url, connectionId?, headers:[{key,value}], bodyMode:"none"|"json", body?, timeoutMs? }.
 * - Relative URL + connectionId -> load Connection, prefix baseUrl, merge connection headers.
 * - Non-2xx -> throw (node ERROR).
 * Output { status, headers, body }  (body parsed JSON if possible else text).
 */
export const actionHttp: NodeHandler = async ({ config, userId, prisma }) => {
  const method = (asString(config.method, "GET") || "GET").toUpperCase();
  let url = asString(config.url).trim();

  const connHeaders: HeaderPair[] = [];
  let baseUrl = "";

  const connectionId = asString(config.connectionId).trim();
  if (connectionId) {
    const conn = await prisma.connection.findFirst({ where: { id: connectionId, userId } });
    if (conn) {
      baseUrl = conn.baseUrl || "";
      const raw = Array.isArray(conn.headers) ? (conn.headers as unknown[]) : [];
      for (const h of raw) {
        if (h && typeof h === "object") {
          const hp = h as Record<string, unknown>;
          const key = asString(hp.key).trim();
          if (key) connHeaders.push({ key, value: asString(hp.value) });
        }
      }
    }
  }

  // Prefix baseUrl if the url is relative (not absolute http(s)).
  const isAbsolute = /^https?:\/\//i.test(url);
  if (!isAbsolute && baseUrl) {
    const b = baseUrl.replace(/\/+$/, "");
    const u = url.replace(/^\/+/, "");
    url = u ? `${b}/${u}` : b;
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`Invalid HTTP url: "${url}"`);
  }

  // Merge headers: connection headers first, then node headers (node overrides).
  const headers: Record<string, string> = {};
  for (const h of connHeaders) headers[h.key] = h.value;
  for (const h of asArray<unknown>(config.headers)) {
    if (h && typeof h === "object") {
      const hp = h as Record<string, unknown>;
      const key = asString(hp.key).trim();
      if (key) headers[key] = asString(hp.value);
    }
  }

  // Body
  const bodyMode = asString(config.bodyMode, "none");
  let body: string | undefined;
  if (bodyMode === "json" && method !== "GET" && method !== "HEAD") {
    const rawBody = asString(config.body).trim();
    if (rawBody) {
      body = rawBody;
      if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const timeoutMs = Math.max(1, asNumber(config.timeoutMs, 10000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("abort")) {
      throw new Error(`HTTP request timed out after ${timeoutMs}ms (${method} ${url})`);
    }
    throw new Error(`HTTP request failed: ${msg} (${method} ${url})`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let parsedBody: unknown = text;
  const contentType = res.headers.get("content-type") || "";
  if (text && (contentType.includes("application/json") || looksLikeJson(text))) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  const headersOut: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headersOut[key] = value;
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${url}`);
  }

  return {
    output: {
      status: res.status,
      headers: headersOut,
      body: parsedBody,
    },
  };
};

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}
