import dns from "dns";
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

  // SSRF guard: reject requests that resolve to a loopback/private/internal address.
  await assertPublicHost(url);

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

/**
 * Block requests whose target resolves to a loopback, private, link-local,
 * unique-local or unspecified address. Resolves the hostname via DNS (so a
 * public name pointing at 127.0.0.1 is still caught); IP literals are checked
 * directly. Throws a clean node error on any blocked address.
 */
async function assertPublicHost(url: string): Promise<void> {
  const hostname = new URL(url).hostname;
  // URL.hostname wraps IPv6 literals in brackets; strip them for parsing.
  const host = hostname.replace(/^\[/, "").replace(/\]$/, "");

  let addresses: string[];
  if (isIpLiteral(host)) {
    addresses = [host];
  } else {
    const resolved = await dns.promises.lookup(host, { all: true });
    addresses = resolved.map((r) => r.address);
  }

  for (const addr of addresses) {
    if (isBlockedAddress(addr)) {
      throw new Error("Blocked request to a private or internal address");
    }
  }
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/** True if `addr` (IPv4 or IPv6) is loopback/private/link-local/unique-local/unspecified. */
function isBlockedAddress(addr: string): boolean {
  const ip = addr.toLowerCase();

  // IPv4 (also handles IPv4-mapped IPv6 like ::ffff:127.0.0.1).
  const v4 = ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    return isBlockedIPv4(v4);
  }

  // IPv6 common cases.
  if (ip === "::" || ip === "::1") return true; // unspecified / loopback
  if (ip.startsWith("fe80:")) return true; // link-local fe80::/10
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // unique-local fc00::/7
  return false;
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    // Not a clean IPv4: treat as blocked to fail safe.
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 (unspecified)
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  return false;
}
