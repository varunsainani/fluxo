// UI metadata for every NodeKind. Drives the palette, the custom node handles,
// and the config-panel form. This is the single source of editor-side knowledge
// about a node's shape; the runtime config shapes themselves follow SPEC §6.

import type { NodeKind } from "@/lib/types";
import { isTrigger } from "@/lib/node-meta";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "expression"
  | "keyValueList"
  | "conditionList"
  | "headerList";

export interface SelectOption {
  /** Stored config value. */
  value: string;
  /** i18n key under `editor.opt.*` for the human label. */
  labelKey: string;
}

export interface FieldDef {
  /** Key inside `data.config`. */
  key: string;
  type: FieldType;
  /** i18n key under `editor.field.*` for the label. */
  labelKey: string;
  /** Optional i18n key under `editor.hint.*` shown beneath the field. */
  hintKey?: string;
  /** For `select`. */
  options?: SelectOption[];
  /** For `text` / `textarea` / `expression` — i18n key for the placeholder. */
  placeholderKey?: string;
  /** Field only visible when another field equals one of these values. */
  showWhen?: { key: string; equals: string[] };
  /** Sub-labels for list editors (column/header name + value), i18n keys. */
  itemLabels?: { nameKey?: string; valueKey?: string };
}

export interface HandleDef {
  /** `null` for the single default source handle. */
  id: string | null;
  /** i18n key under `editor.handle.*` for the visible label (if any). */
  labelKey?: string;
}

export interface NodeCatalogEntry {
  kind: NodeKind;
  category: "trigger" | "action";
  /** CSS color token used for the accent chip / rail tint. */
  accent: string;
  /** Default `data.config` for a freshly dropped node. */
  defaultConfig: Record<string, unknown>;
  /** Ordered config fields rendered in the panel. */
  fields: FieldDef[];
  /** Source handles on the right side (outputs). Triggers + actions have one,
   *  except `action.if` which has two (`true` / `false`). */
  sourceHandles: HandleDef[];
  /** Whether the node accepts an incoming edge on the left (triggers do not). */
  hasTarget: boolean;
}

const METHOD_OPTIONS: SelectOption[] = [
  { value: "GET", labelKey: "GET" },
  { value: "POST", labelKey: "POST" },
  { value: "PUT", labelKey: "PUT" },
  { value: "PATCH", labelKey: "PATCH" },
  { value: "DELETE", labelKey: "DELETE" },
];

const BODY_MODE_OPTIONS: SelectOption[] = [
  { value: "none", labelKey: "bodyNone" },
  { value: "json", labelKey: "bodyJson" },
];

const CHANNEL_OPTIONS: SelectOption[] = [
  { value: "inbox", labelKey: "chInbox" },
  { value: "slack", labelKey: "chSlack" },
  { value: "whatsapp", labelKey: "chWhatsapp" },
  { value: "email", labelKey: "chEmail" },
];

export const NODE_CATALOG: Record<NodeKind, NodeCatalogEntry> = {
  "trigger.manual": {
    kind: "trigger.manual",
    category: "trigger",
    accent: "var(--primary)",
    defaultConfig: { sample: "" },
    hasTarget: false,
    sourceHandles: [{ id: null }],
    fields: [
      {
        key: "sample",
        type: "expression",
        labelKey: "sample",
        hintKey: "sampleHint",
        placeholderKey: "sampleJson",
      },
    ],
  },

  "trigger.webhook": {
    kind: "trigger.webhook",
    category: "trigger",
    accent: "var(--primary)",
    defaultConfig: { sample: "" },
    hasTarget: false,
    sourceHandles: [{ id: null }],
    // The webhook URL block is rendered specially by the config panel.
    fields: [
      {
        key: "sample",
        type: "expression",
        labelKey: "sample",
        hintKey: "sampleHint",
        placeholderKey: "sampleJson",
      },
    ],
  },

  "trigger.schedule": {
    kind: "trigger.schedule",
    category: "trigger",
    accent: "var(--primary)",
    defaultConfig: { cron: "0 8 * * *", timezone: "UTC", sample: "" },
    hasTarget: false,
    sourceHandles: [{ id: null }],
    // The cron field + presets are rendered specially by the config panel.
    fields: [
      { key: "cron", type: "text", labelKey: "cron", hintKey: "cronHint", placeholderKey: "cronExpr" },
      { key: "timezone", type: "text", labelKey: "timezone", placeholderKey: "tz" },
      {
        key: "sample",
        type: "expression",
        labelKey: "sample",
        hintKey: "sampleHint",
        placeholderKey: "sampleJson",
      },
    ],
  },

  "action.http": {
    kind: "action.http",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: {
      method: "GET",
      url: "",
      headers: [],
      bodyMode: "none",
      body: "",
      timeoutMs: 10000,
    },
    hasTarget: true,
    sourceHandles: [{ id: null }],
    fields: [
      { key: "method", type: "select", labelKey: "method", options: METHOD_OPTIONS },
      { key: "url", type: "expression", labelKey: "url", placeholderKey: "url", hintKey: "exprHint" },
      { key: "headers", type: "headerList", labelKey: "headers" },
      { key: "bodyMode", type: "select", labelKey: "bodyMode", options: BODY_MODE_OPTIONS },
      {
        key: "body",
        type: "expression",
        labelKey: "body",
        placeholderKey: "jsonBody",
        hintKey: "exprHint",
        showWhen: { key: "bodyMode", equals: ["json"] },
      },
      { key: "timeoutMs", type: "number", labelKey: "timeoutMs" },
    ],
  },

  "action.setFields": {
    kind: "action.setFields",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: { fields: [] },
    hasTarget: true,
    sourceHandles: [{ id: null }],
    fields: [
      {
        key: "fields",
        type: "keyValueList",
        labelKey: "fields",
        hintKey: "exprHint",
        itemLabels: { nameKey: "fieldName", valueKey: "fieldValue" },
      },
    ],
  },

  "action.if": {
    kind: "action.if",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: {
      combinator: "and",
      conditions: [{ left: "", operator: "eq", right: "" }],
    },
    hasTarget: true,
    sourceHandles: [
      { id: "true", labelKey: "true" },
      { id: "false", labelKey: "false" },
    ],
    fields: [{ key: "conditions", type: "conditionList", labelKey: "conditions", hintKey: "exprHint" }],
  },

  "action.appendRow": {
    kind: "action.appendRow",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: { datastore: "", columns: [] },
    hasTarget: true,
    sourceHandles: [{ id: null }],
    fields: [
      { key: "datastore", type: "text", labelKey: "datastore", placeholderKey: "datastoreName" },
      {
        key: "columns",
        type: "keyValueList",
        labelKey: "columns",
        hintKey: "exprHint",
        itemLabels: { nameKey: "columnName", valueKey: "columnValue" },
      },
    ],
  },

  "action.notify": {
    kind: "action.notify",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: { channel: "inbox", title: "", body: "" },
    hasTarget: true,
    sourceHandles: [{ id: null }],
    fields: [
      { key: "channel", type: "select", labelKey: "channel", options: CHANNEL_OPTIONS },
      { key: "title", type: "expression", labelKey: "notifyTitle", placeholderKey: "notifyTitle", hintKey: "exprHint" },
      { key: "body", type: "expression", labelKey: "notifyBody", placeholderKey: "notifyBody", hintKey: "exprHint" },
    ],
  },

  "action.delay": {
    kind: "action.delay",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: { seconds: 1 },
    hasTarget: true,
    sourceHandles: [{ id: null }],
    fields: [{ key: "seconds", type: "number", labelKey: "seconds", hintKey: "delayHint" }],
  },

  "action.code": {
    kind: "action.code",
    category: "action",
    accent: "var(--accent)",
    defaultConfig: { template: "" },
    hasTarget: true,
    sourceHandles: [{ id: null }],
    fields: [
      { key: "template", type: "expression", labelKey: "template", placeholderKey: "codeTemplate", hintKey: "codeHint" },
    ],
  },
};

export const TRIGGER_KINDS: NodeKind[] = (Object.keys(NODE_CATALOG) as NodeKind[]).filter(
  (k) => NODE_CATALOG[k].category === "trigger",
);
export const ACTION_KINDS: NodeKind[] = (Object.keys(NODE_CATALOG) as NodeKind[]).filter(
  (k) => NODE_CATALOG[k].category === "action",
);

export function catalogFor(kind: NodeKind | string): NodeCatalogEntry | undefined {
  return NODE_CATALOG[kind as NodeKind];
}

/** Deep-clone a kind's default config so new nodes don't share references. */
export function defaultConfigFor(kind: NodeKind): Record<string, unknown> {
  const entry = NODE_CATALOG[kind];
  return entry ? structuredClone(entry.defaultConfig) : {};
}

export { isTrigger };
