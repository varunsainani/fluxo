/**
 * Fluxo SAFE expression resolver (SPEC §8).
 *
 * Public API:
 *   resolveExpr(template: string, ctx: ExprContext): unknown
 *   resolveDeep(value: unknown, ctx: ExprContext): unknown
 *
 * Strings are scanned for `{{ ... }}` tokens.
 *   - If the WHOLE string is exactly one token -> the typed (non-string) value is returned.
 *   - If tokens are embedded inside other text -> each token is stringified and substituted.
 *
 * Inside a token we support a path expression + pipe helpers ONLY. There is no JS
 * evaluation whatsoever: no eval / new Function / vm / template-literal injection.
 * The token is parsed by a hand-written tokenizer + path walker.
 *
 * Roots:
 *   $json      -> current node input
 *   $node      -> { [nodeName]: { json: <output> } }
 *   $now       -> ISO timestamp string of run start
 *   $workflow  -> { id, name }
 *   $vars      -> reserved (empty object)
 *
 * Paths: dotted (`$json.foo.bar`), bracketed (`$json["a b"]`, `$node['My Node'].json`),
 * and numeric index (`$json.items.0`, `$json.items[0]`).
 *
 * Pipe helpers (left-to-right):  upper | lower | trim | json | number | default:"x"
 */

export interface ExprContext {
  $json: unknown;
  $node: Record<string, { json: unknown }>;
  $now: string;
  $workflow: { id: string; name: string };
  $vars: Record<string, unknown>;
}

const TOKEN_RE = /\{\{([\s\S]*?)\}\}/g;

/** Resolve a template string. Whole-token -> typed value; embedded -> stringified substitution. */
export function resolveExpr(template: string, ctx: ExprContext): unknown {
  if (typeof template !== "string") return template;

  // Detect the "whole string is exactly one token" case.
  const whole = wholeToken(template);
  if (whole !== null) {
    return evalToken(whole, ctx);
  }

  // Embedded: replace each token with its stringified value.
  return template.replace(TOKEN_RE, (_m, inner: string) => {
    const value = evalToken(inner, ctx);
    return stringifyForText(value);
  });
}

/** If `s` is exactly one `{{ ... }}` token (with optional surrounding whitespace), return its inner text. */
function wholeToken(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) return null;
  const inner = trimmed.slice(2, -2);
  // Ensure there is no second token embedded (e.g. "{{a}}{{b}}").
  if (inner.includes("{{") || inner.includes("}}")) return null;
  return inner;
}

/** Recursively resolve expressions in any JSON-like structure. */
export function resolveDeep(value: unknown, ctx: ExprContext): unknown {
  if (typeof value === "string") return resolveExpr(value, ctx);
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveDeep(v, ctx);
    }
    return out;
  }
  return value;
}

/** Stringify a resolved token value for embedding into text. undefined/null -> "". */
function stringifyForText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Token evaluation: <path> ( | helper[:arg] )*
// ---------------------------------------------------------------------------

interface Pipe {
  name: string;
  arg?: string; // raw string literal (already unquoted) for default:"x"
}

function evalToken(inner: string, ctx: ExprContext): unknown {
  const src = inner.trim();
  if (src === "") return undefined;

  const { pathExpr, pipes } = splitPipes(src);
  let value = evalPath(pathExpr.trim(), ctx);

  for (const pipe of pipes) {
    value = applyPipe(value, pipe);
  }
  return value;
}

/**
 * Split a token into the leading path expression and a list of pipe helpers.
 * Pipes are separated by `|`, but `|` inside quoted strings (helper args) is ignored.
 */
function splitPipes(src: string): { pathExpr: string; pipes: Pipe[] } {
  const segments: string[] = [];
  let buf = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "|") {
      segments.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  segments.push(buf);

  const pathExpr = segments.shift() ?? "";
  const pipes = segments
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .map(parsePipe);

  return { pathExpr, pipes };
}

function parsePipe(seg: string): Pipe {
  const colon = seg.indexOf(":");
  if (colon === -1) return { name: seg.trim().toLowerCase() };
  const name = seg.slice(0, colon).trim().toLowerCase();
  const rawArg = seg.slice(colon + 1).trim();
  return { name, arg: unquote(rawArg) };
}

function unquote(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

function applyPipe(value: unknown, pipe: Pipe): unknown {
  switch (pipe.name) {
    case "upper":
      return value === undefined || value === null ? value : String(value).toUpperCase();
    case "lower":
      return value === undefined || value === null ? value : String(value).toLowerCase();
    case "trim":
      return value === undefined || value === null ? value : String(value).trim();
    case "json":
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    case "number": {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      return Number.isNaN(n) ? undefined : n;
    }
    case "default": {
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.length === 0);
      return isEmpty ? pipe.arg ?? "" : value;
    }
    default:
      // Unknown helper: pass value through unchanged (safe, no throw).
      return value;
  }
}

// ---------------------------------------------------------------------------
// Path walking: <root> ( .key | [index] | ["key"] )*
// ---------------------------------------------------------------------------

type Segment = { kind: "key"; key: string } | { kind: "index"; index: number };

function evalPath(pathExpr: string, ctx: ExprContext): unknown {
  if (pathExpr === "") return undefined;

  const { root, segments } = parsePath(pathExpr);
  if (root === null) return undefined;

  let current: unknown = resolveRoot(root, ctx);

  for (const seg of segments) {
    if (current === undefined || current === null) return undefined;
    if (seg.kind === "index") {
      if (Array.isArray(current)) {
        current = current[seg.index];
      } else if (typeof current === "object") {
        current = (current as Record<string, unknown>)[String(seg.index)];
      } else {
        return undefined;
      }
    } else {
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[seg.key];
      } else {
        return undefined;
      }
    }
  }
  return current;
}

function resolveRoot(root: string, ctx: ExprContext): unknown {
  switch (root) {
    case "$json":
      return ctx.$json;
    case "$node":
      return ctx.$node;
    case "$now":
      return ctx.$now;
    case "$workflow":
      return ctx.$workflow;
    case "$vars":
      return ctx.$vars;
    default:
      return undefined;
  }
}

/**
 * Parse a path expression into a root identifier + segments.
 * Hand-written character scanner. Supports:
 *   $root
 *   .identifier         (identifier may be alphanumeric/underscore/$)
 *   .123                (numeric -> index)
 *   ["double quoted"]   (also single-quoted)
 *   [123]               (numeric index)
 */
function parsePath(expr: string): { root: string | null; segments: Segment[] } {
  let i = 0;
  const n = expr.length;
  const segments: Segment[] = [];

  // Root must be a bare identifier (e.g. $json, $node, $now...).
  const rootMatch = readIdentifier(expr, i);
  if (rootMatch === null) return { root: null, segments };
  const root = rootMatch.text;
  i = rootMatch.next;

  while (i < n) {
    const ch = expr[i];
    if (ch === ".") {
      i++;
      const id = readIdentifier(expr, i);
      if (id === null) {
        // Could be a numeric segment like `.0`
        const num = readNumber(expr, i);
        if (num === null) return { root: null, segments };
        segments.push({ kind: "index", index: num.value });
        i = num.next;
      } else {
        // Numeric-looking identifier? readIdentifier won't start with a digit, so safe.
        segments.push({ kind: "key", key: id.text });
        i = id.next;
      }
    } else if (ch === "[") {
      i++;
      // skip whitespace
      while (i < n && /\s/.test(expr[i])) i++;
      const q = expr[i];
      if (q === '"' || q === "'") {
        const str = readQuoted(expr, i, q);
        if (str === null) return { root: null, segments };
        segments.push({ kind: "key", key: str.text });
        i = str.next;
      } else {
        const num = readNumber(expr, i);
        if (num === null) return { root: null, segments };
        segments.push({ kind: "index", index: num.value });
        i = num.next;
      }
      // skip whitespace then closing ]
      while (i < n && /\s/.test(expr[i])) i++;
      if (expr[i] !== "]") return { root: null, segments };
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      // Unexpected character -> invalid path -> undefined.
      return { root: null, segments };
    }
  }

  return { root, segments };
}

function readIdentifier(s: string, start: number): { text: string; next: number } | null {
  let i = start;
  // First char: letter, underscore, or $
  if (i >= s.length) return null;
  const first = s[i];
  if (!/[A-Za-z_$]/.test(first)) return null;
  i++;
  while (i < s.length && /[A-Za-z0-9_$]/.test(s[i])) i++;
  return { text: s.slice(start, i), next: i };
}

function readNumber(s: string, start: number): { value: number; next: number } | null {
  let i = start;
  while (i < s.length && /[0-9]/.test(s[i])) i++;
  if (i === start) return null;
  return { value: Number(s.slice(start, i)), next: i };
}

function readQuoted(s: string, start: number, quote: string): { text: string; next: number } | null {
  // s[start] === quote
  let i = start + 1;
  let out = "";
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      out += s[i + 1];
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { text: out, next: i + 1 };
    }
    out += ch;
    i++;
  }
  return null; // unterminated
}
