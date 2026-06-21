import type { PrismaClient } from "@prisma/client";
import type { ExprContext } from "../expr";

/** Arguments passed to every node handler. `config` is already expression-resolved (resolveDeep). */
export interface NodeHandlerArgs {
  ctx: ExprContext;
  config: Record<string, unknown>;
  input: unknown;
  userId: string;
  prisma: PrismaClient;
}

export interface NodeHandlerResult {
  output: unknown;
  branch?: "true" | "false";
}

export type NodeHandler = (args: NodeHandlerArgs) => Promise<NodeHandlerResult>;

/** Helpers for safe config access. */
export function asString(v: unknown, fallback = ""): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "string") return v;
  return String(v);
}

export function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
