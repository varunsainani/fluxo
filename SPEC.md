# Fluxo — Build Contract (SPEC)

Single source of truth for every build agent. Do not invent shapes; follow this.
Fluxo is a visual workflow automation tool with a **real execution engine**.

## 0. Repo layout

```
fluxo/
  backend/   Express + TS + Prisma + Postgres (Neon), the engine
  frontend/  Next.js (App Router) + TS + Tailwind + React Flow + next-intl
```
Single public URL: frontend rewrites `/api/:path*` (and `/health`) to the backend.
Backend routes are mounted at ROOT (e.g. `/auth/login`), so the browser calls
`/api/auth/login`. The frontend api client uses an EMPTY base (same-origin `/api`).

## 1. Stack / tooling

- Backend: Express, TypeScript, Prisma, Postgres, Luxon (tz/cron math),
  `cron-parser` (next-run), `bcryptjs`, `jsonwebtoken`, `zod`, `cookie-parser`.
- Frontend: Next.js (App Router), React, TypeScript, Tailwind (v4 `@theme`),
  `@xyflow/react` (React Flow), `next-intl`, `next-themes`, `lucide-react`.
- Node 20+. ESM-friendly TS (`module: NodeNext` backend; Next defaults frontend).

## 2. Data model (Prisma — backend/prisma/schema.prisma)

```prisma
enum Role { USER ADMIN }
enum ExecStatus { RUNNING SUCCESS ERROR }
enum TriggerKind { MANUAL WEBHOOK SCHEDULE }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(USER)
  locale       String   @default("en")
  createdAt    DateTime @default(now())
  workflows    Workflow[]
  datastores   Datastore[]
  notifications Notification[]
  connections  Connection[]
  executions   Execution[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
}

model Workflow {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  description  String   @default("")
  active       Boolean  @default(false)
  graph        Json     // { nodes: FlowNode[], edges: FlowEdge[] }  (see §5)
  webhookToken String   @unique
  // schedule cache (derived from the schedule trigger node, if any):
  cron         String?
  timezone     String   @default("UTC")
  nextRunAt    DateTime?
  lastRunAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  executions   Execution[]
  @@index([userId])
  @@index([active, nextRunAt])
}

model Execution {
  id         String     @id @default(cuid())
  workflowId String
  workflow   Workflow   @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  status     ExecStatus @default(RUNNING)
  trigger    TriggerKind
  input      Json
  error      String?
  startedAt  DateTime   @default(now())
  finishedAt DateTime?
  durationMs Int?
  nodeRuns   NodeRun[]
  @@index([workflowId, startedAt])
  @@index([userId])
}

model NodeRun {
  id          String     @id @default(cuid())
  executionId String
  execution   Execution  @relation(fields: [executionId], references: [id], onDelete: Cascade)
  nodeId      String
  nodeKind    String
  nodeName    String
  order       Int
  status      ExecStatus
  input       Json?
  output      Json?
  error       String?
  durationMs  Int?
  @@index([executionId, order])
}

model Datastore {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime @default(now())
  rows      DatastoreRow[]
  @@unique([userId, name])
}

model DatastoreRow {
  id          String   @id @default(cuid())
  datastoreId String
  datastore   Datastore @relation(fields: [datastoreId], references: [id], onDelete: Cascade)
  data        Json
  createdAt   DateTime @default(now())
  @@index([datastoreId, createdAt])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel   String   // inbox | slack | whatsapp | email
  title     String
  body      String
  meta      Json?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

model Connection {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  baseUrl   String   @default("")
  headers   Json     // [{ key, value }]
  createdAt DateTime @default(now())
  @@unique([userId, name])
}
```

## 3. Auth

- JWT access token (15m) in `Authorization: Bearer`. Refresh token (random 40-byte
  hex, sha256-hashed in DB, 30d) in an httpOnly cookie `fluxo_refresh` (sameSite lax,
  secure in prod, path `/`). Rotate on refresh.
- `requireAuth` middleware sets `req.user = { id, role, email }`. `requireAdmin`
  additionally checks role === ADMIN.
- Passwords: bcryptjs (10 rounds). demo password `demo1234`.

Endpoints (JSON, all return localized errors §7):
- `POST /auth/register` `{ email, password, name }` → `{ user, accessToken }` (+cookie)
- `POST /auth/login` `{ email, password }` → `{ user, accessToken }` (+cookie)
- `POST /auth/demo` `{ role: "user" | "admin" }` → logs in the seeded demo account for
  that role → `{ user, accessToken }` (+cookie). Powers one-click demo. No creds exposed.
- `POST /auth/refresh` (reads cookie) → `{ accessToken }` (rotates cookie)
- `POST /auth/logout` → `{ ok: true }` (clears cookie)
- `GET  /auth/me` (auth) → `{ user }`

`user` shape: `{ id, email, name, role, locale }`.

## 4. REST endpoints (all auth unless noted; scoped to req.user)

Workflows
- `GET  /workflows` → `WorkflowListItem[]`
  `{ id, name, description, active, trigger, updatedAt, lastExecution: ExecSummary | null }`
- `POST /workflows` `{ name, description? }` → `Workflow` (seeded with one
  `trigger.manual` node at the origin, empty edges, fresh webhookToken)
- `GET  /workflows/:id` → `Workflow` (full: graph, webhookToken, cron, etc.)
- `PATCH /workflows/:id` `{ name?, description?, graph?, active? }` → `Workflow`.
  On graph/active change, the server re-derives `cron`/`timezone`/`nextRunAt` from the
  schedule trigger node (if present & active) else nulls them.
- `DELETE /workflows/:id` → `{ ok: true }`
- `POST /workflows/:id/run` `{ input? }` → `Execution` (full, runs synchronously,
  trigger MANUAL). If no input, uses the manual trigger's sample or `{}`.

Executions
- `GET /executions?workflowId=&limit=` → `ExecSummary[]`
- `GET /executions/:id` → `Execution` with `nodeRuns: NodeRun[]` ordered by `order`

Datastores
- `GET /datastores` → `{ id, name, rowCount, createdAt }[]`
- `POST /datastores` `{ name }` → datastore
- `GET /datastores/:id?limit=&offset=` → `{ id, name, columns: string[], rows: {id,data,createdAt}[], total }`
  (columns = union of keys across rows)
- `DELETE /datastores/:id` → `{ ok: true }`

Notifications
- `GET /notifications?unread=` → `Notification[]` (newest first)
- `GET /notifications/unread-count` → `{ count }`
- `PATCH /notifications/:id` `{ read }` → notification
- `POST /notifications/read-all` → `{ ok: true }`
- `DELETE /notifications/:id` → `{ ok: true }`

Connections
- `GET /connections` → `Connection[]` (headers values masked except last 4? no — return as-is, it's the user's own)
- `POST /connections` `{ name, baseUrl?, headers? }` → connection
- `PATCH /connections/:id` `{ name?, baseUrl?, headers? }` → connection
- `DELETE /connections/:id` → `{ ok: true }`

Admin (requireAdmin)
- `GET /admin/overview` → `{ stats: { users, workflows, activeWorkflows, executions, successRate }, recentExecutions: (ExecSummary & {user})[], topWorkflows: ... }`
- `GET /admin/users` → `{ id, email, name, role, createdAt, workflowCount, executionCount }[]`
- `GET /admin/workflows` → all workflows across users (with owner email)

Webhook (NO auth, public)
- `POST /hooks/:token` (also accept GET for easy demo) → find workflow by webhookToken;
  if not `active` → 404 `{ error: { code: "WORKFLOW_INACTIVE" } }`; else run it with the
  request body (or query for GET) as trigger input (trigger WEBHOOK). Respond `200`
  `{ executionId, status }` quickly.

Cron (protected)
- `GET /cron/tick` with `Authorization: Bearer <CRON_SECRET>` (or `?secret=`) → find
  active workflows where `cron` not null and `nextRunAt <= now`; run each (trigger
  SCHEDULE, input `{ now }`); recompute `nextRunAt`. → `{ ran: n }`

Meta
- `GET /health` → `{ ok: true }` (no auth)

`ExecSummary` = `{ id, workflowId, status, trigger, startedAt, finishedAt, durationMs }`.

## 5. Graph JSON format (shared frontend ↔ engine)

```ts
type FlowNode = {
  id: string;            // e.g. "n_ab12"
  type: NodeKind;        // React Flow node type AND logical kind (see §6)
  position: { x: number; y: number };
  data: {
    name: string;        // user-facing label, e.g. "Fetch leads"
    config: object;      // kind-specific (see §6)
  };
};
type FlowEdge = {
  id: string;
  source: string;        // node id
  target: string;        // node id
  sourceHandle?: string | null;  // for action.if: "true" | "false"
};
type Graph = { nodes: FlowNode[]; edges: FlowEdge[] };
```

## 6. Node catalog (kinds + config + runtime IO)

NodeKind ∈ `trigger.manual | trigger.webhook | trigger.schedule | action.http |
action.setFields | action.if | action.appendRow | action.notify | action.delay |
action.code`.

Each node receives `input` (JSON = output of its single upstream node; for the trigger,
the trigger payload) and produces `output` (JSON). All string config values may contain
expressions (§8).

- **trigger.manual** — config `{ sample?: string (JSON) }`. Output = parsed sample or `{}`.
- **trigger.webhook** — config `{ sample?: string }`. Output = posted body (manual run uses sample).
- **trigger.schedule** — config `{ cron: string, timezone: string, sample?: string }`.
  Output = `{ now: ISO, ...parsedSample }`. The server caches `cron`/`timezone`/`nextRunAt`.
- **action.http** — config `{ method, url, connectionId?, headers:[{key,value}], bodyMode:"none"|"json", body?:string, timeoutMs?:number(default 10000) }`.
  Resolves expressions, prefixes `connection.baseUrl` if url is relative, merges connection headers,
  performs real `fetch`. Output `{ status, headers, body }` (body parsed JSON if possible else text).
  Non-2xx → node ERROR with the status.
- **action.setFields** — config `{ fields: [{ name, value }] }`. Output = object built from
  resolved fields. (Each value resolved via §8.)
- **action.if** — config `{ combinator: "and"|"or", conditions: [{ left, operator, right }] }`.
  operators: `eq neq contains notContains gt gte lt lte isEmpty isNotEmpty isTrue`.
  Output = the input, unchanged. Routing: edges with `sourceHandle:"true"` are followed when
  the condition passes, `"false"` when it fails. (A node with no matching-handle edges ends that path.)
- **action.appendRow** — config `{ datastore: string (name), columns: [{ name, value }] }`.
  Upserts a Datastore by `(userId,name)`, appends a DatastoreRow `{ data: {name:value...} }`.
  Output = `{ id, data }`.
- **action.notify** — config `{ channel:"inbox"|"slack"|"whatsapp"|"email", title, body }`.
  Creates a Notification. Output = the notification row.
- **action.delay** — config `{ seconds: number }`. Awaits `min(seconds, 5)` (serverless cap).
  Output = input unchanged.
- **action.code** — config `{ template: string }` where template is a JSON document with
  `{{ expr }}` placeholders. Resolve placeholders (§8) then `JSON.parse`. Output = parsed value.
  NO `eval`/`Function`. If parse fails → node ERROR.

## 7. Errors & i18n

- Error response: `{ error: { code: string, message: string, details?: any } }` with proper
  HTTP status. Codes: `VALIDATION UNAUTHORIZED FORBIDDEN NOT_FOUND CONFLICT WORKFLOW_INACTIVE
  RATE_LIMITED INTERNAL`. `message` localized by `X-Locale`.
- Locale resolution: `X-Locale` header (`en|es|pt`) → else `Accept-Language` → else `en`.
  Mount the locale middleware BEFORE `express.json()` so body-parser/size errors are still
  localized. `req.locale` available everywhere.
- Backend message catalog `backend/src/lib/i18n.ts` with `en/es/pt` for all error codes +
  validation messages. Full key parity.

## 8. Expression engine (safe, no eval)

A resolver `resolveExpr(template: string, ctx): unknown` and `resolveDeep(value, ctx)`.
- Scan strings for `{{ ... }}` tokens. If the whole string is exactly one token → return the
  typed value; if embedded in text → stringify each token and substitute.
- Inside a token: a path expression against the context. Support:
  - `$json` — current node input. `$json.foo.bar`, `$json["a b"]`, `$json.items.0`.
  - `$node["Name"].json...` or `$node.Name.json...` — a prior node's output by NAME.
  - `$now` — ISO timestamp string of run start.
  - `$workflow.name`, `$workflow.id`.
  - `$vars` — reserved (empty for now).
  - Literals inside tokens are NOT evaluated as JS. Only path lookups + a small set of pipe
    helpers: `{{ $json.x | upper }}`, `| lower | trim | json | default:"n/a" | number }`.
- Unknown paths resolve to `undefined` → stringify as empty string in text context.
- Implement with a hand-written tokenizer/path-walker. Absolutely no `eval`, `new Function`,
  `vm`, or template literal injection.

## 9. Execution engine (backend/src/engine)

`runWorkflow({ workflow, trigger, input }) : Promise<Execution>`:
1. Create `Execution` (status RUNNING).
2. Locate the entry trigger node matching `trigger` kind (MANUAL→trigger.manual or any trigger
   for a manual run; WEBHOOK→trigger.webhook; SCHEDULE→trigger.schedule). If none → ERROR.
3. Walk the graph from the trigger following edges (respect `action.if` handles). Linear/branching;
   guard against cycles (visited set, hard cap 100 node-runs). Single-input model: a node's input =
   the output of the upstream node that reached it (for the trigger, the trigger payload).
4. For each node: resolve config via §8 against ctx `{ $json: input, $node: {byName}, $now, $workflow }`,
   execute the node handler, persist a `NodeRun` (order, status, input, output, error, durationMs).
   On a node error: mark it ERROR, stop traversal, Execution.status = ERROR, store `error`.
5. Finalize Execution (status, finishedAt, durationMs). Return full execution with nodeRuns.
- Node handlers live in `engine/nodes/<kind>.ts`, registered in a map. Each: `(ctx, config, input) => output`.
- The engine MUST be runnable in-process (used by manual run, webhook, cron, and tests).

## 10. Seed (backend/scripts/seed.ts → `npm run seed`)

- Users: `demo@fluxo.app` / `demo1234` (USER, "Demo User"); `admin@fluxo.app` / `demo1234`
  (ADMIN, "Admin"). Optionally a 2nd USER `maria@fluxo.app` to make admin views non-trivial.
- For the demo user, create the **3 demo workflows** (active), each a real graph:
  1. **New Lead Capture**: `trigger.webhook` → `action.setFields` (normalize name/email/source)
     → `action.if` (email isNotEmpty) →(true)→ `action.appendRow` (datastore "Leads")
     → `action.notify` (inbox "New lead: {{ $json.name }}").
  2. **Daily Digest**: `trigger.schedule` (cron `0 8 * * *`) → `action.http`
     (GET a public API, e.g. count) → `action.setFields` (compose summary)
     → `action.notify` (inbox).
  3. **Webhook → API → Alert**: `trigger.webhook` → `action.http` (GET public API)
     → `action.if` (threshold) →(true)→ `action.notify`.
- Datastore "Leads" with ~6 rows. ~5 notifications (mix read/unread). 1 connection
  ("JSONPlaceholder", baseUrl `https://jsonplaceholder.typicode.com`). Seed ~8 past
  Executions across the workflows (mix SUCCESS/ERROR) WITH NodeRuns so the run history +
  inspector look alive. Use varied timestamps (spread over the last days).
- Seed must be idempotent (clear the demo users' data and recreate) and END in a pristine
  demo state (call this after any test that writes rows).

## 11. Env

Backend (`backend/.env`, also `.env.example` without secrets):
`DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon non-pooler), `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CRON_SECRET`, `WEBHOOK_SALT`, `APP_URL` (frontend public URL, used to
build webhook URLs shown in UI), `CORS_ORIGIN` (frontend URL; non-fatal fallback to APP_URL),
`NODE_ENV`. Prod fail-fast: in production, missing JWT/CRON secrets throw at boot; CORS is
non-fatal (warn + fall back to APP_URL, never `*`).

Frontend (`frontend/.env.local`, `.env.example`):
`API_PROXY_TARGET` (backend URL for the `/api` rewrite), `APP_URL`.

## 12. Frontend routes & behavior

Public: `/` (landing, technical hero with an animated mini node-graph + demo CTA), `/login`
(one-click "Enter as demo" + "Enter as admin" via `POST /auth/demo`, plus a real email/password form).

App (authed, redirect to `/login` if no session; app shell with sidebar nav + topbar with
language toggle + theme toggle + notifications bell + user menu):
- `/workflows` — cards/list: name, trigger badge, active toggle (PATCH active), last run status, open.
- `/workflows/[id]` — **React Flow editor**: left node palette (drag to add), canvas with custom
  nodes (status rail, kind icon, name), connect handles (if-node has true/false), right config panel
  (form per node kind, live expression fields), top bar: rename, Save (PATCH graph), Activate toggle,
  **Run now** (POST run → toast + open the resulting execution), copy webhook URL (for webhook triggers).
- `/executions` — list with status, trigger, workflow, duration, time. Filter by workflow.
- `/executions/[id]` — run inspector: ordered node steps, each expandable showing input/output JSON
  (pretty, monospace) + error + duration; overall status header.
- `/datastores` and `/datastores/[id]` — tables list + a data grid of rows (dynamic columns).
- `/notifications` — inbox, channel icon, read/unread, mark read / mark all / delete.
- `/connections` — list + create/edit/delete (name, baseUrl, headers key/value editor).
- `/settings` — profile (name), language, theme.
- `/admin` (admin only) — overview stats + recent executions across users + users table.

Non-negotiables: every page fetches live data; one-click demo gives a real session; CRUD persists;
NO dead buttons. EN/ES/PT full parity (UI + backend), auto-detect first visit (cookie `NEXT_LOCALE`)
+ visible toggle on public AND app. Locale-aware number/date. Light/dark + responsive.

## 13. Design system (DISTINCT — dev-tool / node-canvas)

Must look unlike the other portfolio projects. Identity:
- Near-black canvas; **blueprint dot-grid** background on canvas + subtle grid texture on app bg.
- Palette: base zinc/near-black; primary **indigo→violet** (`#6366f1`→`#8b5cf6`); signal
  **lime/emerald** (`#a3e635`/`#34d399`) for running/success pulses; rose `#fb7185` for errors.
- Typography: `ui-monospace` (JetBrains-Mono-like) for node titles, IDs, expressions, logs, code
  blocks, stat numbers; clean sans (Inter) for prose/marketing.
- Nodes: rounded-md card, left status rail (idle gray / running pulsing lime / ok emerald / error
  rose), kind icon in a tinted chip, monospace title. Edges: animated, faint glow.
- Landing hero: a live SVG/React-Flow mini-graph that animates a token flowing trigger→action,
  terminal-style heading. Buttons with a subtle neon ring. NOT a generic SaaS hero.
- Provide CSS variables + Tailwind `@theme` tokens in `globals.css`; dark is the DEFAULT theme,
  light fully supported.

## 14. Quality gates

- `tsc --noEmit` clean both sides; `next build` clean. Engine + smoke tests in
  `backend/scripts/*.ts` (run in-process with `dangerouslyDisableSandbox`, never bind a port).
- No hardcoded user-facing strings (all via next-intl / backend i18n). 3-catalog key parity.
- No dead buttons; every control wired to a real endpoint or a believable lightweight action.
