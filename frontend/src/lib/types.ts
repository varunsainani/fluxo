// Shared API contract types — mirror backend SPEC. Keep in sync.

export type Role = "USER" | "ADMIN";
export type ExecStatus = "RUNNING" | "SUCCESS" | "ERROR";
export type TriggerKind = "MANUAL" | "WEBHOOK" | "SCHEDULE";

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

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
}

export interface FlowNode {
  id: string;
  type: NodeKind;
  position: { x: number; y: number };
  data: {
    name: string;
    config: Record<string, unknown>;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Graph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ExecSummary {
  id: string;
  workflowId: string;
  status: ExecStatus;
  trigger: TriggerKind;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: TriggerKind | null;
  updatedAt: string;
  lastExecution: ExecSummary | null;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  graph: Graph;
  webhookToken: string;
  cron: string | null;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NodeRun {
  id: string;
  nodeId: string;
  nodeKind: NodeKind | string;
  nodeName: string;
  order: number;
  status: ExecStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number | null;
}

export interface Execution extends ExecSummary {
  input: unknown;
  error: string | null;
  nodeRuns: NodeRun[];
}

export interface DatastoreListItem {
  id: string;
  name: string;
  rowCount: number;
  createdAt: string;
}

export interface DatastoreDetail {
  id: string;
  name: string;
  columns: string[];
  rows: { id: string; data: Record<string, unknown>; createdAt: string }[];
  total: number;
}

export interface Notification {
  id: string;
  channel: string;
  title: string;
  body: string;
  meta: unknown;
  read: boolean;
  createdAt: string;
}

export interface HeaderPair {
  key: string;
  value: string;
}

export interface Connection {
  id: string;
  name: string;
  baseUrl: string;
  headers: HeaderPair[];
  createdAt: string;
}

export interface AdminOverview {
  stats: {
    users: number;
    workflows: number;
    activeWorkflows: number;
    executions: number;
    successRate: number;
  };
  recentExecutions: (ExecSummary & { user: { name: string; email: string }; workflowName: string })[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  workflowCount: number;
  executionCount: number;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
