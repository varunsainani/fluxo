# Fluxo

A visual workflow automation tool, in the spirit of n8n, built end to end. You
build automations by dragging nodes onto a canvas and wiring a **trigger** to a
chain of **actions**, and the workflow **actually runs** on the backend with
real, inspectable executions. Not a diagram toy: there is a real graph
execution engine behind it.

**Live demo:** https://fluxo-lac.vercel.app — on the login page use a one-click
demo button (user or admin); no signup needed.

## What makes it real

The core is a **DAG execution engine**. When a workflow runs, the node graph is
executed in dependency order, each node receives JSON from upstream nodes, does
real work, and passes JSON on. Every step is persisted with its input, output,
status, error and duration, so you can inspect any past run node by node.

- ⚡ **Real triggers** — **Manual** (a Run button), **Webhook** (each workflow
  gets a unique URL; an external `POST` fires a real run), and **Schedule** (a
  cron expression, driven by a Vercel Cron tick).
- 🧩 **Ten node types** — HTTP Request (real `fetch`), Set Fields, IF / branch,
  Append Row (to an internal datastore), Notify (to an internal inbox), Delay,
  and Code (a JSON template), plus the three triggers.
- 🔣 **Expressions** — reference upstream output with `{{ $json.field }}` and
  `{{ $node["Name"] }}`. The resolver is a hand-written, **eval-free** parser
  (no `eval` / `Function` / `vm`), so expressions and code templates are safe.
- 🔍 **Run inspector** — every execution shows each node's input/output JSON,
  status and timing, with a live status rail.
- 🗂️ **Datastores & notifications** — the Append Row and Notify nodes write to an
  internal "spreadsheet" and an inbox, so the Gmail to Sheets to Slack pattern
  works fully self-contained, with no third-party OAuth.
- 🛡️ **Hardened** — JWT auth with refresh rotation and role-based access, every
  resource scoped to its owner, the HTTP node blocks private/metadata addresses
  (SSRF guard), and the cron endpoint uses a timing-safe secret check.
- 🌍 **Trilingual (EN / ES / PT)** — UI and API messages localized, resolved via
  an `X-Locale` header with `Accept-Language` fallback, locale-aware formatting.
- 🌗 **Light / dark themes**, mobile-aware, with a distinct developer-tool /
  node-canvas design.

## Seeded demo workflows

1. **New Lead Capture** — Webhook → Set Fields → IF (has email) → Append Row
   (Leads) → Notify.
2. **Daily Digest** — Schedule (cron) → HTTP Request → Set Fields → Notify.
3. **Webhook → API → Alert** — Webhook → HTTP Request → IF (threshold) → Notify.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, React Flow, next-intl |
| Backend  | Node.js, Express, TypeScript, Prisma, Luxon, cron-parser         |
| Database | PostgreSQL (Neon)                                                |
| Hosting  | Vercel (frontend + backend serverless) + Vercel Cron + Neon      |

The frontend proxies `/api/*` to the backend, so the whole product lives behind a
single URL.

## Project structure

```
backend/    Express API, Prisma schema, the execution engine + nodes, webhook + cron
frontend/   Next.js + Tailwind app (React Flow editor, run inspector, dashboards), i18n
```

## Running locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # set DATABASE_URL (Neon), DIRECT_URL, JWT + secrets
npm run prisma:push         # push the schema
npm run seed                # demo accounts, workflows, datastore, runs
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # set API_PROXY_TARGET to the backend URL
npm run dev
```

Open http://localhost:3000.

## The execution engine

The engine (`backend/src/engine`) walks the graph from the trigger, following
edges (an IF node routes via its `true` / `false` handles), runs each node's
handler with the resolved config, and records a `NodeRun` per step. It guards
against cycles, caps the number of steps, and always finalizes an execution even
when a node throws. The same engine powers manual runs, webhooks and the cron
tick, and it runs in-process for the test suite.
