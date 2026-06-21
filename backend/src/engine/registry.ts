import type { NodeHandler } from "./nodes/types";
import { triggerManual } from "./nodes/triggerManual";
import { triggerWebhook } from "./nodes/triggerWebhook";
import { triggerSchedule } from "./nodes/triggerSchedule";
import { actionHttp } from "./nodes/actionHttp";
import { actionSetFields } from "./nodes/actionSetFields";
import { actionIf } from "./nodes/actionIf";
import { actionAppendRow } from "./nodes/actionAppendRow";
import { actionNotify } from "./nodes/actionNotify";
import { actionDelay } from "./nodes/actionDelay";
import { actionCode } from "./nodes/actionCode";

export type NodeKind =
  | "trigger.manual"
  | "trigger.webhook"
  | "trigger.schedule"
  | "action.http"
  | "action.setFields"
  | "action.if"
  | "action.appendRow"
  | "action.notify"
  | "action.delay"
  | "action.code";

export const registry: Record<NodeKind, NodeHandler> = {
  "trigger.manual": triggerManual,
  "trigger.webhook": triggerWebhook,
  "trigger.schedule": triggerSchedule,
  "action.http": actionHttp,
  "action.setFields": actionSetFields,
  "action.if": actionIf,
  "action.appendRow": actionAppendRow,
  "action.notify": actionNotify,
  "action.delay": actionDelay,
  "action.code": actionCode,
};

export function getHandler(kind: string): NodeHandler | undefined {
  return registry[kind as NodeKind];
}

export const TRIGGER_KINDS = new Set([
  "trigger.manual",
  "trigger.webhook",
  "trigger.schedule",
]);
