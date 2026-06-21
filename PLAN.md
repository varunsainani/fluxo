# Fluxo — Plan

**Fluxo** is a visual workflow automation tool: build automations by dragging
nodes onto a canvas, connecting a trigger to a chain of actions, and the
workflow **actually runs** on the backend with real, inspectable executions.
Think a focused, self-contained n8n: same mental model (triggers -> actions,
`{{ $json.field }}` expressions, run history), built end to end as a portfolio
piece.

This is **Option B** of the brief: instead of operating off-the-shelf n8n, I
build the kind of tool clients buy off the shelf. No video and no third-party
OAuth (Gmail/Slack consent screens need your live accounts) — every "integration"
is real but self-contained so the demo works for anyone instantly.

---

## Why this is genuinely full-stack (not a diagram toy)

The core is a **real execution engine**. When a workflow runs:

- the node graph is executed in dependency order (topological),
- each node receives JSON from upstream nodes, does real work, and passes JSON on,
- n8n-style expressions resolve against prior output: `{{ $json.email }}`,
  `{{ $node["Webhook"].json.name }}`, plus a few safe helpers,
- every step is persisted with its input, output, status, error and duration,
- you inspect any past run node-by-node in a run viewer.

Triggers are real:
- **Manual** — a Run button.
- **Webhook** — each workflow gets a unique URL; an external `POST` fires a real run.
- **Schedule** — a cron expression; due workflows run via a Vercel Cron tick.

## Distinct design (different from every other project)

Hard requirement: Fluxo must not look like Reservo/Localia/Keyring/Vantage.
Identity = **developer-tool / node-canvas**:

- Dark-first, near-black canvas with a blueprint **dot/grid** background.
- Accent palette unique to this project: **indigo/violet + lime signal-green**
  for "running/success" pulses (I'll verify it diverges from Keyring's palette
  during build).
- **Monospace** for node titles, IDs, expressions and logs; clean sans for prose.
- **Animated, glowing edges** between nodes; nodes show live status (idle /
  running / ok / error) with a colored rail.
- Marketing landing leans technical: a hero with a live mini node-graph that
  animates a run, terminal-style copy. No generic SaaS hero.

## Tech stack (house stack)

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind, **React Flow**, next-intl, next-themes |
| Backend  | Node.js, Express, TypeScript, Prisma, **Luxon** (cron/tz), `cron-parser` |
| Database | PostgreSQL (Neon)                                                |
| Hosting  | Vercel (frontend + backend serverless) + Vercel Cron + Neon      |

Single public URL: the frontend proxies `/api/*` to the backend.

## Data model (Prisma)

- **User** — id, email, passwordHash, name, role (`user` | `admin`), locale.
- **RefreshToken** — rotation for JWT auth.
- **Workflow** — id, userId, name, description, active, `graph` JSON
  (`{ nodes, edges }`), `webhookToken`, cron fields (expression + next/last run),
  timestamps.
- **Execution** — id, workflowId, status (`success`|`error`|`running`),
  trigger (`manual`|`webhook`|`schedule`), input JSON, startedAt, finishedAt.
- **NodeRun** — id, executionId, nodeId, nodeType, order, status, input JSON,
  output JSON, error, durationMs. (This is the run inspector's data.)
- **Datastore** + **DatastoreRow** — internal "Google Sheets": named tables of
  JSON rows that workflows append to and you browse as a data grid.
- **Notification** — internal "Slack/WhatsApp": channel, title, body, meta, read.
  Workflows post here; you see them in an inbox.
- **Connection** — named, reusable HTTP credentials (base URL + headers) the
  HTTP node can use. Real, self-contained, no OAuth.

## Node catalog (v1)

**Triggers:** Manual · Webhook · Schedule (cron).
**Actions:**
- **HTTP Request** — real `fetch` (method/url/headers/body, timeout, captures response).
- **Set Fields** — build/transform a JSON object from expressions.
- **IF / Filter** — branch or stop based on a condition.
- **Append Row** — write to a Datastore table (the "Sheets" action).
- **Notify** — post to the Notifications inbox (the "Slack/WhatsApp" action).
- **Delay** — short wait (capped for serverless).
- **Code/Transform** — a *safe* expression mapper (no arbitrary `eval`; a small
  interpolator + whitelisted helpers only).

These map 1:1 onto the brief's three demo workflows below.

## Seeded demo workflows (so the demo looks alive instantly)

1. **New Lead Capture** — *Webhook* -> *Set Fields* (normalize) -> *IF* (has email)
   -> *Append Row* to "Leads" -> *Notify* "New lead: {{name}}".
   Mirrors Gmail -> parse -> Google Sheets -> notify.
2. **Daily Digest** — *Schedule* (daily) -> *HTTP Request* (fetch a public API /
   lead count) -> *Set Fields* (compose summary) -> *Notify*.
   Mirrors the scheduled good-morning/digest pattern.
3. **Webhook -> API -> Alert** — *Webhook* -> *HTTP Request* (public API) ->
   *IF* (threshold) -> *Notify*.
   Mirrors webhook-triggered automation that takes an action.

Each ships with a few real past executions seeded so run history is populated.

## Pages (frontend)

- **Landing** (public, technical hero with animated node-graph, demo CTA).
- **Login** — one-click demo accounts (user + admin), real session.
- **Workflows** — list/cards: name, active toggle, last run + status.
- **Editor** — the React Flow canvas: drag nodes from a palette, connect, click a
  node to configure it in a side panel, save graph, activate, **Run now**, copy
  the webhook URL.
- **Executions** — run history + a node-by-node inspector (input/output/error).
- **Datastores** — browse the "Sheets" tables as data grids.
- **Notifications** — the inbox of sent notifications.
- **Connections** — manage reusable HTTP credentials.
- **Settings** — profile, language, theme.
- **Admin** — overview across all users (workflows, runs, simple stats).

No dead buttons: every control does something real or a believable lightweight action.

## Cross-cutting (house non-negotiables)

- **i18n EN/ES/PT**, full parity, frontend UI **and** backend messages
  (`X-Locale` header + `Accept-Language` fallback), auto-detect + visible toggle,
  locale-aware number/date formatting.
- **Light/dark** + responsive.
- **Auth**: JWT access + refresh rotation, role-based (user/admin), one-click demo.
- Rich seed data; reseed prod after tests.

## Build sequence (on "start")

1. Scaffold repo (`backend/` + `frontend/`, git root at root), Prisma schema, env.
2. Fan out scoped subagents: (a) backend auth + workflow CRUD + data model,
   (b) the execution engine + node implementations + webhook/cron routes,
   (c) frontend canvas/editor + React Flow node UIs, (d) frontend app pages +
   i18n + design system.
3. Reconcile the API contract, integration-test the engine in-process.
4. Deploy all-Vercel + Neon, wire Vercel Cron, fix the production alias, verify
   the full loop live (build a workflow, run it, hit the webhook, see the run).
5. Multi-perspective audit (security/authz, i18n parity, functional/no-dead-buttons,
   adversarial engine + expression-safety bug-find), fix, re-verify live.
6. Screenshots + Workana listing copy.

## Out of scope (by your instruction)

- No demo video (you'll record a Loom on top of the finished tool if you want).
- No real third-party OAuth (Gmail/Slack/Sheets). The Datastore + Notifications +
  HTTP nodes deliver the same patterns self-contained, so the live demo works for
  anyone with no setup.

## What I need from you to start

1. An **empty GitHub repo**: `git@github.com:varunsainani/fluxo.git` (or confirm a
   different name).
2. A **fresh Neon database URL** (pooled connection string) for Fluxo's own DB.
3. The **Vercel token** (the previous one may have expired — please re-paste at
   "start").

Say **start** and I'll build it.
