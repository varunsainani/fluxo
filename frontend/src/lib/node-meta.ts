import {
  MousePointerClick,
  Webhook,
  Clock,
  Globe,
  Pencil,
  GitBranch,
  Database,
  Bell,
  Timer,
  Code2,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind, TriggerKind } from "./types";

export const NODE_ICONS: Record<NodeKind, LucideIcon> = {
  "trigger.manual": MousePointerClick,
  "trigger.webhook": Webhook,
  "trigger.schedule": Clock,
  "action.http": Globe,
  "action.setFields": Pencil,
  "action.if": GitBranch,
  "action.appendRow": Database,
  "action.notify": Bell,
  "action.delay": Timer,
  "action.code": Code2,
};

export function nodeIcon(kind: NodeKind | string): LucideIcon {
  return NODE_ICONS[kind as NodeKind] ?? Circle;
}

export function isTrigger(kind: NodeKind | string): boolean {
  return typeof kind === "string" && kind.startsWith("trigger.");
}

export const ALL_NODE_KINDS: NodeKind[] = [
  "trigger.manual",
  "trigger.webhook",
  "trigger.schedule",
  "action.http",
  "action.setFields",
  "action.if",
  "action.appendRow",
  "action.notify",
  "action.delay",
  "action.code",
];

export const TRIGGER_ICONS: Record<TriggerKind, LucideIcon> = {
  MANUAL: MousePointerClick,
  WEBHOOK: Webhook,
  SCHEDULE: Clock,
};

export function triggerIcon(t: TriggerKind | null): LucideIcon {
  return t ? TRIGGER_ICONS[t] : Circle;
}
