"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Plus, Trash2, X } from "lucide-react";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { nodeIcon } from "@/lib/node-meta";
import { cn } from "@/lib/cn";
import type { NodeKind, Workflow } from "@/lib/types";
import { catalogFor, type FieldDef } from "./node-catalog";
import type { FluxoNodeData, RFNode } from "./serialize";

const OPERATORS = [
  "eq",
  "neq",
  "contains",
  "notContains",
  "gt",
  "gte",
  "lt",
  "lte",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
] as const;

const UNARY_OPS = new Set(["isEmpty", "isNotEmpty", "isTrue"]);

const CRON_PRESETS: { value: string; labelKey: string }[] = [
  { value: "* * * * *", labelKey: "everyMinute" },
  { value: "0 * * * *", labelKey: "hourly" },
  { value: "0 8 * * *", labelKey: "dailyAt8" },
  { value: "0 9 * * 1", labelKey: "weekdayMornings" },
  { value: "0 0 1 * *", labelKey: "monthly" },
];

interface KV {
  name?: string;
  key?: string;
  value?: string;
}

export function ConfigPanel({
  node,
  workflow,
  onChangeName,
  onChangeConfig,
  onDelete,
  onClose,
}: {
  node: RFNode | null;
  workflow: Workflow;
  onChangeName: (name: string) => void;
  onChangeConfig: (config: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("editor");
  const tNodes = useTranslations("nodes");
  const tKinds = useTranslations("nodeKinds");

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">{tNodes("noSelection")}</p>
      </div>
    );
  }

  const data = node.data as FluxoNodeData;
  const entry = catalogFor(data.kind);
  const Icon = nodeIcon(data.kind);
  const config = data.config ?? {};

  const setField = (key: string, value: unknown) => {
    onChangeConfig({ ...config, [key]: value });
  };

  const visibleFields = (entry?.fields ?? []).filter((f) => {
    if (!f.showWhen) return true;
    return f.showWhen.equals.includes(String(config[f.showWhen.key] ?? ""));
  });

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] p-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{
            color: entry?.accent ?? "var(--primary)",
            borderColor: `color-mix(in srgb, ${entry?.accent ?? "var(--primary)"} 35%, transparent)`,
            background: `color-mix(in srgb, ${entry?.accent ?? "var(--primary)"} 12%, transparent)`,
          }}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs font-semibold text-fg">{tKinds(data.kind)}</div>
          <div className="truncate font-mono text-[10.5px] text-faint">{node.id}</div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("closePanel")}
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-[var(--surface-hover)] hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
        {/* node name */}
        <div>
          <Label htmlFor="node-name">{tNodes("name")}</Label>
          <Input
            id="node-name"
            mono
            value={data.name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder={tKinds(data.kind)}
          />
        </div>

        {/* webhook URL special block */}
        {data.kind === "trigger.webhook" && <WebhookUrl token={workflow.webhookToken} />}

        {/* schedule cron special block */}
        {data.kind === "trigger.schedule" && (
          <CronField
            value={String(config.cron ?? "")}
            timezone={String(config.timezone ?? "UTC")}
            onCron={(v) => setField("cron", v)}
            onTz={(v) => setField("timezone", v)}
          />
        )}

        {visibleFields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={config[field.key]}
            kind={data.kind}
            combinator={String(config.combinator ?? "and")}
            onCombinator={(v) => setField("combinator", v)}
            onChange={(v) => setField(field.key, v)}
          />
        ))}
      </div>

      {/* footer */}
      <div className="border-t border-[var(--border)] p-3">
        <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
          <Trash2 size={14} />
          {t("deleteNode")}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- field renderer ----------------------------- */

function FieldRenderer({
  field,
  value,
  kind,
  combinator,
  onCombinator,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  kind: NodeKind;
  combinator: string;
  onCombinator: (v: string) => void;
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations("editor");

  // The cron / timezone of the schedule node are rendered by CronField above.
  if (kind === "trigger.schedule" && (field.key === "cron" || field.key === "timezone")) {
    return null;
  }

  const label = t(`field.${field.labelKey}`);
  const hint = field.hintKey ? t(`hint.${field.hintKey}`) : undefined;
  const placeholder = field.placeholderKey ? t(`ph.${field.placeholderKey}`) : undefined;
  const id = `f-${field.key}`;

  switch (field.type) {
    case "text":
      return (
        <Field label={label} hint={hint} htmlFor={id}>
          <Input
            id={id}
            mono
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        </Field>
      );

    case "number":
      return (
        <Field label={label} hint={hint} htmlFor={id}>
          <Input
            id={id}
            mono
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder={placeholder}
          />
        </Field>
      );

    case "select":
      return (
        <Field label={label} hint={hint} htmlFor={id}>
          <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {t(`opt.${o.labelKey}`)}
              </option>
            ))}
          </Select>
        </Field>
      );

    case "textarea":
      return (
        <Field label={label} hint={hint} htmlFor={id}>
          <Textarea
            id={id}
            mono
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        </Field>
      );

    case "expression":
      return (
        <ExpressionField
          id={id}
          label={label}
          hint={hint}
          placeholder={placeholder}
          value={String(value ?? "")}
          multiline={field.key === "body" || field.key === "template" || field.key === "sample"}
          onChange={onChange}
        />
      );

    case "headerList":
      return (
        <KeyValueEditor
          label={label}
          hint={hint}
          rows={Array.isArray(value) ? (value as KV[]) : []}
          mode="key"
          nameLabel={t("field.headerName")}
          valueLabel={t("field.headerValue")}
          addLabel={t("addHeader")}
          onChange={onChange}
        />
      );

    case "keyValueList":
      return (
        <KeyValueEditor
          label={label}
          hint={hint}
          rows={Array.isArray(value) ? (value as KV[]) : []}
          mode="name"
          nameLabel={field.itemLabels?.nameKey ? t(`field.${field.itemLabels.nameKey}`) : t("field.fieldName")}
          valueLabel={field.itemLabels?.valueKey ? t(`field.${field.itemLabels.valueKey}`) : t("field.fieldValue")}
          addLabel={t("addRow")}
          onChange={onChange}
        />
      );

    case "conditionList":
      return (
        <ConditionEditor
          label={label}
          hint={hint}
          rawValue={value}
          combinator={combinator}
          onCombinator={onCombinator}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}

/* --------------------------- expression-aware text ------------------------- */

function ExpressionField({
  id,
  label,
  hint,
  placeholder,
  value,
  multiline,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  multiline?: boolean;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("editor");
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0" htmlFor={id}>
          {label}
        </Label>
        <Badge variant="brand" className="!text-[9.5px]">
          {"{{ }}"}
        </Badge>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          mono
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
      ) : (
        <Input
          id={id}
          mono
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
      )}
      <p className="mt-1 text-[11px] leading-snug text-faint">{hint ?? t("hint.exprHint")}</p>
    </div>
  );
}

/* ------------------------------ key/value list ----------------------------- */

function KeyValueEditor({
  label,
  hint,
  rows,
  mode,
  nameLabel,
  valueLabel,
  addLabel,
  onChange,
}: {
  label: string;
  hint?: string;
  rows: KV[];
  /** "key" -> {key,value} (headers); "name" -> {name,value} (set fields / columns). */
  mode: "key" | "name";
  nameLabel: string;
  valueLabel: string;
  addLabel: string;
  onChange: (rows: KV[]) => void;
}) {
  const nameKey = mode === "key" ? "key" : "name";

  const update = (i: number, patch: KV) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, mode === "key" ? { key: "", value: "" } : { name: "", value: "" }]);

  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2.5 text-center text-[11px] text-faint">
            {hint}
          </p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              mono
              className="h-8 flex-1 text-xs"
              value={String((row as Record<string, unknown>)[nameKey] ?? "")}
              onChange={(e) => update(i, { [nameKey]: e.target.value } as KV)}
              placeholder={nameLabel}
              spellCheck={false}
            />
            <span className="font-mono text-xs text-faint">=</span>
            <Input
              mono
              className="h-8 flex-1 text-xs"
              value={String(row.value ?? "")}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder={valueLabel}
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 rounded p-1 text-faint transition-colors hover:text-[color:var(--err)]"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <Button variant="subtle" size="sm" className="mt-2 w-full" onClick={add}>
        <Plus size={13} />
        {addLabel}
      </Button>
    </div>
  );
}

/* ------------------------------- conditions -------------------------------- */

interface Condition {
  left?: string;
  operator?: string;
  right?: string;
}

function ConditionEditor({
  label,
  hint,
  rawValue,
  combinator,
  onCombinator,
  onChange,
}: {
  label: string;
  hint?: string;
  rawValue: unknown;
  combinator: string;
  onCombinator: (v: string) => void;
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations("editor");

  // For action.if: `config.conditions` is the field value (this `rawValue`);
  // `config.combinator` is edited via the and/or toggle below.
  const conditions: Condition[] = Array.isArray(rawValue) ? (rawValue as Condition[]) : [];

  const update = (i: number, patch: Condition) =>
    onChange(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(conditions.filter((_, idx) => idx !== i));
  const add = () => onChange([...conditions, { left: "", operator: "eq", right: "" }]);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0">{label}</Label>
        {conditions.length > 1 && (
          <div className="inline-flex overflow-hidden rounded border border-[var(--border)]">
            {(["and", "or"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCombinator(c)}
                className={cn(
                  "px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
                  combinator === c
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "text-faint hover:text-fg",
                )}
              >
                {t(`combinator.${c}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {conditions.map((c, i) => {
          const unary = UNARY_OPS.has(c.operator ?? "");
          return (
            <div
              key={i}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-soft)] p-2"
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
                  {t("condition")} {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-0.5 text-faint transition-colors hover:text-[color:var(--err)]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Input
                mono
                className="h-8 text-xs"
                value={String(c.left ?? "")}
                onChange={(e) => update(i, { left: e.target.value })}
                placeholder={t("ph.condLeft")}
                spellCheck={false}
              />
              <Select
                className="mt-1.5 h-8 text-xs"
                value={c.operator ?? "eq"}
                onChange={(e) => update(i, { operator: e.target.value })}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {t(`op.${op}`)}
                  </option>
                ))}
              </Select>
              {!unary && (
                <Input
                  mono
                  className="mt-1.5 h-8 text-xs"
                  value={String(c.right ?? "")}
                  onChange={(e) => update(i, { right: e.target.value })}
                  placeholder={t("ph.condRight")}
                  spellCheck={false}
                />
              )}
            </div>
          );
        })}
        {conditions.length === 0 && (
          <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2.5 text-center text-[11px] text-faint">
            {hint}
          </p>
        )}
      </div>
      <Button variant="subtle" size="sm" className="mt-2 w-full" onClick={add}>
        <Plus size={13} />
        {t("addCondition")}
      </Button>
    </div>
  );
}

/* ----------------------------- webhook URL block --------------------------- */

function WebhookUrl({ token }: { token: string }) {
  const t = useTranslations("editor");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/api/hooks/${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div>
      <Label>{t("webhookUrl")}</Label>
      <div className="flex items-stretch gap-1.5">
        <div className="flex min-w-0 flex-1 items-center rounded-md border border-[var(--border)] bg-[var(--bg-soft)] px-2.5">
          <span className="truncate font-mono text-[11px] text-fg" title={url}>
            {url}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={copy} aria-label={t("copyWebhook")} className="h-9 w-9">
          {copied ? <Check size={14} className="text-[color:var(--ok)]" /> : <Copy size={14} />}
        </Button>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-faint">{t("webhookHint")}</p>
    </div>
  );
}

/* -------------------------------- cron field ------------------------------- */

function CronField({
  value,
  timezone,
  onCron,
  onTz,
}: {
  value: string;
  timezone: string;
  onCron: (v: string) => void;
  onTz: (v: string) => void;
}) {
  const t = useTranslations("editor");
  return (
    <div className="space-y-2.5">
      <div>
        <Label htmlFor="cron">{t("field.cron")}</Label>
        <Input
          id="cron"
          mono
          value={value}
          onChange={(e) => onCron(e.target.value)}
          placeholder={t("ph.cronExpr")}
          spellCheck={false}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onCron(p.value)}
              className={cn(
                "rounded border px-2 py-1 font-mono text-[10.5px] transition-colors",
                value === p.value
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] text-muted hover:border-[var(--primary)]/50 hover:text-fg",
              )}
            >
              {t(`cron.${p.labelKey}`)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-faint">{t("hint.cronHint")}</p>
      </div>
      <div>
        <Label htmlFor="tz">{t("field.timezone")}</Label>
        <Input
          id="tz"
          mono
          value={timezone}
          onChange={(e) => onTz(e.target.value)}
          placeholder={t("ph.tz")}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
