/**
 * Fluxo seed (SPEC §10). Idempotent: wipes the demo users' data and recreates a
 * pristine, lively demo state.
 *
 * Run:  npx tsx scripts/seed.ts   (dangerouslyDisableSandbox — hits Neon over network)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "../src/lib/prisma";
import { runWorkflow } from "../src/engine";
import { computeNextRunAt } from "../src/routes/cron";

const PASSWORD = "demo1234";

function webhookToken(): string {
  return randomBytes(20).toString("hex");
}

function nodeId(prefix: string): string {
  return `n_${prefix}_${randomBytes(3).toString("hex")}`;
}

// Lay nodes left -> right with generous spacing.
function pos(col: number, row = 0): { x: number; y: number } {
  return { x: 80 + col * 320, y: 120 + row * 180 };
}

interface BuiltGraph {
  graph: { nodes: any[]; edges: any[] };
  cron?: string;
  timezone?: string;
}

// ---------------------------------------------------------------------------
// Workflow 1: New Lead Capture
//   webhook -> setFields -> if(email isNotEmpty) -true-> appendRow -> notify
// ---------------------------------------------------------------------------
function buildLeadCapture(): BuiltGraph {
  const t = nodeId("wh");
  const set = nodeId("set");
  const iff = nodeId("if");
  const append = nodeId("row");
  const notify = nodeId("notify");

  const nodes = [
    {
      id: t,
      type: "trigger.webhook",
      position: pos(0),
      data: {
        name: "Lead submitted",
        config: {
          sample: JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com", source: "landing" }, null, 2),
        },
      },
    },
    {
      id: set,
      type: "action.setFields",
      position: pos(1),
      data: {
        name: "Normalize lead",
        config: {
          fields: [
            { name: "name", value: "{{ $json.name | trim }}" },
            { name: "email", value: "{{ $json.email | lower | trim }}" },
            { name: "source", value: "{{ $json.source | default:\"website\" }}" },
            { name: "capturedAt", value: "{{ $now }}" },
          ],
        },
      },
    },
    {
      id: iff,
      type: "action.if",
      position: pos(2),
      data: {
        name: "Has email?",
        config: {
          combinator: "and",
          conditions: [{ left: "{{ $json.email }}", operator: "isNotEmpty", right: "" }],
        },
      },
    },
    {
      id: append,
      type: "action.appendRow",
      position: pos(3),
      data: {
        name: "Save to Leads",
        config: {
          datastore: "Leads",
          columns: [
            { name: "name", value: "{{ $json.name }}" },
            { name: "email", value: "{{ $json.email }}" },
            { name: "source", value: "{{ $json.source }}" },
            { name: "capturedAt", value: "{{ $json.capturedAt }}" },
          ],
        },
      },
    },
    {
      id: notify,
      type: "action.notify",
      position: pos(4),
      data: {
        name: "Notify team",
        config: {
          channel: "inbox",
          title: "New lead: {{ $node[\"Normalize lead\"].json.name }}",
          body: "{{ $node[\"Normalize lead\"].json.email }} via {{ $node[\"Normalize lead\"].json.source }}",
        },
      },
    },
  ];

  const edges = [
    { id: `e_${t}_${set}`, source: t, target: set },
    { id: `e_${set}_${iff}`, source: set, target: iff },
    { id: `e_${iff}_${append}`, source: iff, target: append, sourceHandle: "true" },
    { id: `e_${append}_${notify}`, source: append, target: notify },
  ];

  return { graph: { nodes, edges } };
}

// ---------------------------------------------------------------------------
// Workflow 2: Daily Digest
//   schedule -> http(GET todos) -> setFields(summary) -> notify
// ---------------------------------------------------------------------------
function buildDailyDigest(connectionId: string): BuiltGraph {
  const t = nodeId("sch");
  const http = nodeId("http");
  const set = nodeId("set");
  const notify = nodeId("notify");
  const cron = "0 8 * * *";
  const timezone = "UTC";

  const nodes = [
    {
      id: t,
      type: "trigger.schedule",
      position: pos(0),
      data: {
        name: "Every morning 8am",
        config: { cron, timezone, sample: JSON.stringify({ label: "daily-digest" }, null, 2) },
      },
    },
    {
      id: http,
      type: "action.http",
      position: pos(1),
      data: {
        name: "Fetch todos",
        config: {
          method: "GET",
          url: "/todos/1",
          connectionId,
          headers: [],
          bodyMode: "none",
          timeoutMs: 10000,
        },
      },
    },
    {
      id: set,
      type: "action.setFields",
      position: pos(2),
      data: {
        name: "Compose summary",
        config: {
          fields: [
            { name: "title", value: "Daily digest for {{ $json.now }}" },
            { name: "topTodo", value: "{{ $node[\"Fetch todos\"].json.body.title }}" },
            { name: "completed", value: "{{ $node[\"Fetch todos\"].json.body.completed }}" },
          ],
        },
      },
    },
    {
      id: notify,
      type: "action.notify",
      position: pos(3),
      data: {
        name: "Send digest",
        config: {
          channel: "inbox",
          title: "{{ $json.title }}",
          body: "Top item: {{ $json.topTodo }} (completed: {{ $json.completed }})",
        },
      },
    },
  ];

  const edges = [
    { id: `e_${t}_${http}`, source: t, target: http },
    { id: `e_${http}_${set}`, source: http, target: set },
    { id: `e_${set}_${notify}`, source: set, target: notify },
  ];

  return { graph: { nodes, edges }, cron, timezone };
}

// ---------------------------------------------------------------------------
// Workflow 3: Webhook -> API -> Alert
//   webhook -> http(GET) -> if(userId gte threshold) -true-> notify
// ---------------------------------------------------------------------------
function buildWebhookApiAlert(connectionId: string): BuiltGraph {
  const t = nodeId("wh");
  const http = nodeId("http");
  const iff = nodeId("if");
  const notify = nodeId("notify");

  const nodes = [
    {
      id: t,
      type: "trigger.webhook",
      position: pos(0),
      data: {
        name: "Incoming event",
        config: { sample: JSON.stringify({ postId: 1 }, null, 2) },
      },
    },
    {
      id: http,
      type: "action.http",
      position: pos(1),
      data: {
        name: "Lookup post",
        config: {
          method: "GET",
          url: "/posts/{{ $json.postId | default:\"1\" }}",
          connectionId,
          headers: [],
          bodyMode: "none",
          timeoutMs: 10000,
        },
      },
    },
    {
      id: iff,
      type: "action.if",
      position: pos(2),
      data: {
        name: "High-priority?",
        config: {
          combinator: "and",
          conditions: [{ left: "{{ $node[\"Lookup post\"].json.body.userId }}", operator: "gte", right: "1" }],
        },
      },
    },
    {
      id: notify,
      type: "action.notify",
      position: pos(3),
      data: {
        name: "Raise alert",
        config: {
          channel: "slack",
          title: "Alert: post {{ $node[\"Lookup post\"].json.body.id }}",
          body: "{{ $node[\"Lookup post\"].json.body.title }}",
        },
      },
    },
  ];

  const edges = [
    { id: `e_${t}_${http}`, source: t, target: http },
    { id: `e_${http}_${iff}`, source: http, target: iff },
    { id: `e_${iff}_${notify}`, source: iff, target: notify, sourceHandle: "true" },
  ];

  return { graph: { nodes, edges } };
}

// ---------------------------------------------------------------------------
// Manual mini-workflow for maria (so admin views are non-trivial).
// ---------------------------------------------------------------------------
function buildManualHello(): BuiltGraph {
  const t = nodeId("man");
  const code = nodeId("code");
  const notify = nodeId("notify");

  const nodes = [
    {
      id: t,
      type: "trigger.manual",
      position: pos(0),
      data: { name: "Run manually", config: { sample: JSON.stringify({ name: "Maria" }, null, 2) } },
    },
    {
      id: code,
      type: "action.code",
      position: pos(1),
      data: {
        name: "Build payload",
        config: { template: '{ "greeting": "Hello {{ $json.name }}", "at": "{{ $now }}" }' },
      },
    },
    {
      id: notify,
      type: "action.notify",
      position: pos(2),
      data: {
        name: "Greet",
        config: { channel: "inbox", title: "{{ $json.greeting }}", body: "Generated at {{ $json.at }}" },
      },
    },
  ];

  const edges = [
    { id: `e_${t}_${code}`, source: t, target: code },
    { id: `e_${code}_${notify}`, source: code, target: notify },
  ];

  return { graph: { nodes, edges } };
}

async function wipeUser(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  // Cascades handle children, but be explicit/ordered for clarity & idempotency.
  await prisma.execution.deleteMany({ where: { userId: user.id } });
  await prisma.datastore.deleteMany({ where: { userId: user.id } });
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.connection.deleteMany({ where: { userId: user.id } });
  await prisma.workflow.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
}

async function upsertUser(email: string, name: string, role: "USER" | "ADMIN"): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash, locale: "en" },
    update: { name, role, passwordHash },
  });
  return { id: user.id };
}

function daysAgo(d: number, hour = 9, minute = 0): Date {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - d);
  dt.setUTCHours(hour, minute, 0, 0);
  return dt;
}

async function main(): Promise<void> {
  console.log("Seeding Fluxo demo data...");

  // Wipe demo users (idempotent).
  for (const email of ["demo@fluxo.app", "admin@fluxo.app", "maria@fluxo.app"]) {
    await wipeUser(email);
  }

  const demo = await upsertUser("demo@fluxo.app", "Demo User", "USER");
  const admin = await upsertUser("admin@fluxo.app", "Admin", "ADMIN");
  const maria = await upsertUser("maria@fluxo.app", "Maria Santos", "USER");

  // Connection (JSONPlaceholder) for the demo user.
  const connection = await prisma.connection.create({
    data: {
      userId: demo.id,
      name: "JSONPlaceholder",
      baseUrl: "https://jsonplaceholder.typicode.com",
      headers: [{ key: "Accept", value: "application/json" }],
    },
  });

  // ----- Workflows for demo user -----
  const leadCapture = buildLeadCapture();
  const dailyDigest = buildDailyDigest(connection.id);
  const webhookAlert = buildWebhookApiAlert(connection.id);

  const wfLead = await prisma.workflow.create({
    data: {
      userId: demo.id,
      name: "New Lead Capture",
      description: "Capture inbound leads, validate, store, and alert the team.",
      active: true,
      graph: leadCapture.graph as object,
      webhookToken: webhookToken(),
    },
  });

  const digestNext = computeNextRunAt(dailyDigest.cron!, dailyDigest.timezone!, new Date());
  const wfDigest = await prisma.workflow.create({
    data: {
      userId: demo.id,
      name: "Daily Digest",
      description: "Every morning, fetch data from an API and post a digest to the inbox.",
      active: true,
      graph: dailyDigest.graph as object,
      webhookToken: webhookToken(),
      cron: dailyDigest.cron,
      timezone: dailyDigest.timezone,
      nextRunAt: digestNext,
    },
  });

  const wfAlert = await prisma.workflow.create({
    data: {
      userId: demo.id,
      name: "Webhook -> API -> Alert",
      description: "Receive an event, enrich it from an API, and raise an alert when needed.",
      active: true,
      graph: webhookAlert.graph as object,
      webhookToken: webhookToken(),
    },
  });

  // ----- Workflow for maria -----
  const mariaHello = buildManualHello();
  const wfMaria = await prisma.workflow.create({
    data: {
      userId: maria.id,
      name: "Manual Greeter",
      description: "A simple manual workflow that builds a greeting payload.",
      active: true,
      graph: mariaHello.graph as object,
      webhookToken: webhookToken(),
    },
  });

  // ----- Datastore "Leads" with ~6 rows -----
  const leads = await prisma.datastore.create({
    data: { userId: demo.id, name: "Leads" },
  });
  const leadRows = [
    { name: "Ada Lovelace", email: "ada@example.com", source: "landing", capturedAt: daysAgo(6).toISOString() },
    { name: "Alan Turing", email: "alan@example.com", source: "referral", capturedAt: daysAgo(5).toISOString() },
    { name: "Grace Hopper", email: "grace@example.com", source: "webinar", capturedAt: daysAgo(4).toISOString() },
    { name: "Katherine Johnson", email: "katherine@example.com", source: "landing", capturedAt: daysAgo(3).toISOString() },
    { name: "Margaret Hamilton", email: "margaret@example.com", source: "ads", capturedAt: daysAgo(2).toISOString() },
    { name: "Hedy Lamarr", email: "hedy@example.com", source: "referral", capturedAt: daysAgo(1).toISOString() },
  ];
  for (const [i, data] of leadRows.entries()) {
    await prisma.datastoreRow.create({
      data: { datastoreId: leads.id, data: data as object, createdAt: daysAgo(6 - i) },
    });
  }

  // ----- Notifications (~5, mix read/unread) -----
  const notifs = [
    { channel: "inbox", title: "New lead: Ada Lovelace", body: "ada@example.com via landing", read: true, createdAt: daysAgo(6, 9, 5) },
    { channel: "inbox", title: "New lead: Grace Hopper", body: "grace@example.com via webinar", read: true, createdAt: daysAgo(4, 11, 20) },
    { channel: "slack", title: "Alert: post 1", body: "sunt aut facere repellat provident", read: false, createdAt: daysAgo(2, 14, 0) },
    { channel: "inbox", title: "Daily digest for today", body: "Top item: delectus aut autem (completed: false)", read: false, createdAt: daysAgo(1, 8, 1) },
    { channel: "inbox", title: "New lead: Hedy Lamarr", body: "hedy@example.com via referral", read: false, createdAt: daysAgo(1, 16, 30) },
  ];
  for (const n of notifs) {
    await prisma.notification.create({ data: { userId: demo.id, ...n } });
  }

  // ----- Live executions: actually run some workflows -----
  // Lead capture (webhook): appendRow + notify happen.
  await runWorkflow({
    workflowId: wfLead.id,
    trigger: "WEBHOOK",
    input: { name: "Sofia Kovalevskaya", email: "sofia@example.com", source: "landing" },
  });

  // Webhook -> API -> Alert (real HTTP to JSONPlaceholder).
  await runWorkflow({ workflowId: wfAlert.id, trigger: "WEBHOOK", input: { postId: 2 } });

  // Daily digest (schedule; real HTTP).
  await runWorkflow({
    workflowId: wfDigest.id,
    trigger: "SCHEDULE",
    input: { now: new Date().toISOString() },
  });

  // Maria's manual run.
  await runWorkflow({ workflowId: wfMaria.id, trigger: "MANUAL", input: { name: "Maria" } });

  // A lead-capture run that takes the FALSE branch (no email) -> stops after the if.
  await runWorkflow({
    workflowId: wfLead.id,
    trigger: "WEBHOOK",
    input: { name: "Anonymous", source: "landing" },
  });

  // ----- Backfill a few older executions by hand (varied timestamps + an ERROR) -----
  await insertHistoricalExecution({
    workflowId: wfLead.id,
    userId: demo.id,
    trigger: "WEBHOOK",
    status: "SUCCESS",
    when: daysAgo(5, 10, 12),
    input: { name: "Alan Turing", email: "alan@example.com", source: "referral" },
    steps: [
      { kind: "trigger.webhook", name: "Lead submitted", status: "SUCCESS", out: { name: "Alan Turing", email: "alan@example.com", source: "referral" } },
      { kind: "action.setFields", name: "Normalize lead", status: "SUCCESS", out: { name: "Alan Turing", email: "alan@example.com", source: "referral", capturedAt: daysAgo(5, 10, 12).toISOString() } },
      { kind: "action.if", name: "Has email?", status: "SUCCESS", out: { name: "Alan Turing", email: "alan@example.com", source: "referral", capturedAt: daysAgo(5, 10, 12).toISOString() } },
      { kind: "action.appendRow", name: "Save to Leads", status: "SUCCESS", out: { id: "row_demo_hist", data: { name: "Alan Turing", email: "alan@example.com" } } },
      { kind: "action.notify", name: "Notify team", status: "SUCCESS", out: { id: "ntf_demo_hist", channel: "inbox", title: "New lead: Alan Turing" } },
    ],
  });

  await insertHistoricalExecution({
    workflowId: wfAlert.id,
    userId: demo.id,
    trigger: "WEBHOOK",
    status: "ERROR",
    when: daysAgo(3, 13, 45),
    input: { postId: 99999 },
    error: "HTTP 404 Not Found for GET https://jsonplaceholder.typicode.com/posts/99999",
    steps: [
      { kind: "trigger.webhook", name: "Incoming event", status: "SUCCESS", out: { postId: 99999 } },
      { kind: "action.http", name: "Lookup post", status: "ERROR", out: null, error: "HTTP 404 Not Found for GET https://jsonplaceholder.typicode.com/posts/99999" },
    ],
  });

  await insertHistoricalExecution({
    workflowId: wfDigest.id,
    userId: demo.id,
    trigger: "SCHEDULE",
    status: "SUCCESS",
    when: daysAgo(2, 8, 0),
    input: { now: daysAgo(2, 8, 0).toISOString() },
    steps: [
      { kind: "trigger.schedule", name: "Every morning 8am", status: "SUCCESS", out: { now: daysAgo(2, 8, 0).toISOString(), label: "daily-digest" } },
      { kind: "action.http", name: "Fetch todos", status: "SUCCESS", out: { status: 200, body: { userId: 1, id: 1, title: "delectus aut autem", completed: false } } },
      { kind: "action.setFields", name: "Compose summary", status: "SUCCESS", out: { title: "Daily digest", topTodo: "delectus aut autem", completed: false } },
      { kind: "action.notify", name: "Send digest", status: "SUCCESS", out: { id: "ntf_digest_hist", channel: "inbox" } },
    ],
  });

  // Recompute nextRunAt for the digest (so it's fresh after the schedule run).
  await prisma.workflow.update({
    where: { id: wfDigest.id },
    data: { nextRunAt: computeNextRunAt(dailyDigest.cron!, dailyDigest.timezone!, new Date()) },
  });

  const execCount = await prisma.execution.count({ where: { userId: demo.id } });
  console.log(`Seed complete. demo executions: ${execCount}`);
  console.log("Users: demo@fluxo.app / admin@fluxo.app / maria@fluxo.app  (password: demo1234)");
}

interface HistoricalStep {
  kind: string;
  name: string;
  status: "SUCCESS" | "ERROR";
  out: unknown;
  error?: string;
}

async function insertHistoricalExecution(opts: {
  workflowId: string;
  userId: string;
  trigger: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  status: "SUCCESS" | "ERROR";
  when: Date;
  input: unknown;
  error?: string;
  steps: HistoricalStep[];
}): Promise<void> {
  const finished = new Date(opts.when.getTime() + 1200);
  const exec = await prisma.execution.create({
    data: {
      workflowId: opts.workflowId,
      userId: opts.userId,
      trigger: opts.trigger,
      status: opts.status,
      input: (opts.input ?? {}) as object,
      error: opts.error ?? null,
      startedAt: opts.when,
      finishedAt: finished,
      durationMs: 1200,
    },
  });

  let order = 0;
  let prevOut: unknown = opts.input ?? {};
  for (const step of opts.steps) {
    await prisma.nodeRun.create({
      data: {
        executionId: exec.id,
        nodeId: `n_hist_${order}`,
        nodeKind: step.kind,
        nodeName: step.name,
        order,
        status: step.status,
        input: (prevOut ?? null) as object,
        output: (step.out ?? null) as object,
        error: step.error ?? null,
        durationMs: 120 + order * 40,
      },
    });
    prevOut = step.out;
    order++;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
