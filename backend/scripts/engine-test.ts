/**
 * Fluxo engine tests — in-process (tsx). Hits the Neon DB; run with dangerouslyDisableSandbox.
 * Exercises: expression resolver, every node handler, full webhook run, if-false-branch stop,
 * real HTTP node, and cron nextRunAt. Restores a pristine demo DB by calling the seed at the end.
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import { prisma } from "../src/lib/prisma";
import { resolveExpr, resolveDeep, type ExprContext } from "../src/engine/expr";
import { runWorkflow, getExecutionDetail } from "../src/engine";
import { computeNextRunAt } from "../src/routes/cron";
import { registry } from "../src/engine/registry";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name} (got ${a}, expected ${e})`);
    console.log(`  FAIL  ${name}  got=${a} expected=${e}`);
  }
}

function baseCtx(partial: Partial<ExprContext> = {}): ExprContext {
  return {
    $json: {},
    $node: {},
    $now: "2026-06-22T08:00:00.000Z",
    $workflow: { id: "wf_test", name: "Test WF" },
    $vars: {},
    ...partial,
  };
}

async function testExpressions(): Promise<void> {
  console.log("\n[expr] expression resolver");

  const ctx = baseCtx({
    $json: {
      name: " Ada ",
      email: "ADA@Example.com",
      count: 3,
      nested: { a: { b: "deep" } },
      items: ["x", "y", "z"],
      flag: true,
      "weird key": "spacey",
    },
    $node: { "Prev Node": { json: { value: 42, label: "hello" } } },
  });

  // Whole-token typed value
  eq("whole-token number returns typed", resolveExpr("{{ $json.count }}", ctx), 3);
  eq("whole-token boolean returns typed", resolveExpr("{{ $json.flag }}", ctx), true);
  eq("whole-token object returns typed", resolveExpr("{{ $json.nested }}", ctx), { a: { b: "deep" } });

  // Path lookups
  eq("dot path nested", resolveExpr("{{ $json.nested.a.b }}", ctx), "deep");
  eq("bracket string key", resolveExpr('{{ $json["weird key"] }}', ctx), "spacey");
  eq("array index dot", resolveExpr("{{ $json.items.1 }}", ctx), "y");
  eq("array index bracket", resolveExpr("{{ $json.items[2] }}", ctx), "z");
  eq("node by name bracket", resolveExpr('{{ $node["Prev Node"].json.value }}', ctx), 42);
  eq("node by name dot (no space)", resolveExpr("{{ $node.PrevNode.json.label }}", baseCtx({ $node: { PrevNode: { json: { label: "hi" } } } })), "hi");
  eq("$now whole token", resolveExpr("{{ $now }}", ctx), "2026-06-22T08:00:00.000Z");
  eq("$workflow.name", resolveExpr("{{ $workflow.name }}", ctx), "Test WF");

  // Pipes
  eq("upper pipe", resolveExpr("{{ $json.name | trim | upper }}", ctx), "ADA");
  eq("lower+trim pipe", resolveExpr("{{ $json.email | lower | trim }}", ctx), "ada@example.com");
  eq("number pipe", resolveExpr("{{ $json.count | number }}", ctx), 3);
  eq("json pipe", resolveExpr("{{ $json.nested | json }}", ctx), JSON.stringify({ a: { b: "deep" } }));
  eq("default pipe on missing", resolveExpr('{{ $json.missing | default:"n/a" }}', ctx), "n/a");
  eq("default pipe on present", resolveExpr('{{ $json.name | trim | default:"x" }}', ctx), "Ada");

  // Embedded substitution
  eq("embedded text", resolveExpr("Hi {{ $json.name | trim }}, count={{ $json.count }}", ctx), "Hi Ada, count=3");

  // Unknown path -> empty string in text context
  eq("unknown path -> empty in text", resolveExpr("x={{ $json.nope.deep }}y", ctx), "x=y");
  eq("unknown whole token -> undefined", resolveExpr("{{ $json.nope }}", ctx), undefined);

  // resolveDeep
  const deep = resolveDeep(
    { a: "{{ $json.count }}", b: ["{{ $json.name | trim }}", { c: "static" }], d: 5 },
    ctx
  );
  eq("resolveDeep nested", deep, { a: 3, b: ["Ada", { c: "static" }], d: 5 });

  // SAFETY: no eval. Tokens that look like JS must NOT execute.
  eq("no eval: arithmetic not evaluated", resolveExpr("{{ 1 + 1 }}", ctx), undefined);
  eq("no eval: process not reachable", resolveExpr("{{ process.env.DATABASE_URL }}", ctx), undefined);
  eq("no eval: constructor not reachable", resolveExpr("{{ constructor.constructor }}", ctx), undefined);
  eq("no eval: global not reachable", resolveExpr("{{ global.process }}", ctx), undefined);
  // Ensure a malicious-looking token cannot mutate or read anything; result is text-empty.
  eq("no eval: text context safe", resolveExpr("a{{ this.constructor }}b", ctx), "ab");
}

async function testNodeHandlers(userId: string): Promise<void> {
  console.log("\n[nodes] individual handlers");

  // trigger.manual
  {
    const r = await registry["trigger.manual"]({ ctx: baseCtx(), config: {}, input: { x: 1 }, userId, prisma });
    eq("trigger.manual passes input", r.output, { x: 1 });
    const r2 = await registry["trigger.manual"]({ ctx: baseCtx(), config: { sample: '{"s":true}' }, input: undefined, userId, prisma });
    eq("trigger.manual uses sample", r2.output, { s: true });
  }

  // trigger.webhook
  {
    const r = await registry["trigger.webhook"]({ ctx: baseCtx(), config: {}, input: { body: 1 }, userId, prisma });
    eq("trigger.webhook passes body", r.output, { body: 1 });
  }

  // trigger.schedule
  {
    const r = await registry["trigger.schedule"]({
      ctx: baseCtx(),
      config: { cron: "0 8 * * *", timezone: "UTC", sample: '{"k":"v"}' },
      input: { now: "2026-06-22T08:00:00.000Z" },
      userId,
      prisma,
    });
    eq("trigger.schedule merges now+sample", r.output, { now: "2026-06-22T08:00:00.000Z", k: "v" });
  }

  // action.setFields
  {
    const r = await registry["action.setFields"]({
      ctx: baseCtx(),
      config: { fields: [{ name: "a", value: 1 }, { name: "b", value: "two" }] },
      input: {},
      userId,
      prisma,
    });
    eq("action.setFields builds object", r.output, { a: 1, b: "two" });
  }

  // action.if (true / false)
  {
    const rTrue = await registry["action.if"]({
      ctx: baseCtx(),
      config: { combinator: "and", conditions: [{ left: "abc", operator: "isNotEmpty", right: "" }] },
      input: { keep: 1 },
      userId,
      prisma,
    });
    ok("action.if true branch", rTrue.branch === "true");
    eq("action.if passes input unchanged", rTrue.output, { keep: 1 });

    const rFalse = await registry["action.if"]({
      ctx: baseCtx(),
      config: { combinator: "and", conditions: [{ left: 5, operator: "gt", right: 10 }] },
      input: {},
      userId,
      prisma,
    });
    ok("action.if false branch", rFalse.branch === "false");

    const rOr = await registry["action.if"]({
      ctx: baseCtx(),
      config: { combinator: "or", conditions: [{ left: 1, operator: "gt", right: 10 }, { left: "x", operator: "eq", right: "x" }] },
      input: {},
      userId,
      prisma,
    });
    ok("action.if or combinator", rOr.branch === "true");

    const rContains = await registry["action.if"]({
      ctx: baseCtx(),
      config: { combinator: "and", conditions: [{ left: "hello world", operator: "contains", right: "world" }] },
      input: {},
      userId,
      prisma,
    });
    ok("action.if contains", rContains.branch === "true");
  }

  // action.appendRow (writes DB)
  {
    const dsName = `__test_ds_${randomBytes(3).toString("hex")}`;
    const r = await registry["action.appendRow"]({
      ctx: baseCtx(),
      config: { datastore: dsName, columns: [{ name: "name", value: "Tester" }, { name: "n", value: 7 }] },
      input: {},
      userId,
      prisma,
    });
    const out = r.output as { id: string; data: Record<string, unknown> };
    ok("action.appendRow returns id+data", typeof out.id === "string" && out.data.name === "Tester");
    const ds = await prisma.datastore.findFirst({ where: { userId, name: dsName }, include: { rows: true } });
    ok("action.appendRow persisted row", !!ds && ds.rows.length === 1);
    // cleanup test datastore
    if (ds) await prisma.datastore.delete({ where: { id: ds.id } });
  }

  // action.notify (writes DB)
  {
    const r = await registry["action.notify"]({
      ctx: baseCtx(),
      config: { channel: "inbox", title: "Test", body: "Body" },
      input: {},
      userId,
      prisma,
    });
    const out = r.output as { id: string; title: string };
    ok("action.notify returns row", out.title === "Test" && typeof out.id === "string");
    await prisma.notification.delete({ where: { id: out.id } }).catch(() => undefined);
  }

  // action.delay (capped)
  {
    const start = Date.now();
    const r = await registry["action.delay"]({ ctx: baseCtx(), config: { seconds: 0.05 }, input: { d: 1 }, userId, prisma });
    const elapsed = Date.now() - start;
    eq("action.delay passes input", r.output, { d: 1 });
    ok("action.delay waited (~50ms) & capped", elapsed >= 40 && elapsed < 2000);
  }

  // action.code (JSON.parse, no eval)
  {
    const r = await registry["action.code"]({
      ctx: baseCtx({ $json: { name: "Zoe" } }),
      config: { template: '{ "greeting": "Hello {{ $json.name }}", "n": 5 }' },
      input: { name: "Zoe" },
      userId,
      prisma,
    });
    eq("action.code parses JSON with expr", r.output, { greeting: "Hello Zoe", n: 5 });

    let threw = false;
    try {
      await registry["action.code"]({ ctx: baseCtx(), config: { template: "{ not valid json }" }, input: {}, userId, prisma });
    } catch {
      threw = true;
    }
    ok("action.code throws on invalid JSON", threw);
  }

  // action.http (REAL fetch to JSONPlaceholder)
  {
    const r = await registry["action.http"]({
      ctx: baseCtx(),
      config: { method: "GET", url: "https://jsonplaceholder.typicode.com/todos/1", headers: [], bodyMode: "none", timeoutMs: 10000 },
      input: {},
      userId,
      prisma,
    });
    const out = r.output as { status: number; body: { id: number } };
    eq("action.http status 200", out.status, 200);
    eq("action.http parsed body.id", out.body.id, 1);

    // non-2xx -> throw
    let threw = false;
    try {
      await registry["action.http"]({
        ctx: baseCtx(),
        config: { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/99999999", headers: [], bodyMode: "none", timeoutMs: 10000 },
        input: {},
        userId,
        prisma,
      });
    } catch {
      threw = true;
    }
    ok("action.http throws on non-2xx", threw);
  }
}

async function testFullRuns(userId: string): Promise<void> {
  console.log("\n[exec] full workflow runs");

  // Build a lead-capture workflow and run it via the executor (webhook).
  const t = "n_t";
  const set = "n_set";
  const iff = "n_if";
  const append = "n_append";
  const notify = "n_notify";
  const dsName = `__test_leads_${randomBytes(3).toString("hex")}`;

  const graph = {
    nodes: [
      { id: t, type: "trigger.webhook", position: { x: 0, y: 0 }, data: { name: "In", config: {} } },
      {
        id: set,
        type: "action.setFields",
        position: { x: 1, y: 0 },
        data: { name: "Norm", config: { fields: [{ name: "name", value: "{{ $json.name | trim }}" }, { name: "email", value: "{{ $json.email | lower }}" }] } },
      },
      {
        id: iff,
        type: "action.if",
        position: { x: 2, y: 0 },
        data: { name: "HasEmail", config: { combinator: "and", conditions: [{ left: "{{ $json.email }}", operator: "isNotEmpty", right: "" }] } },
      },
      {
        id: append,
        type: "action.appendRow",
        position: { x: 3, y: 0 },
        data: { name: "Save", config: { datastore: dsName, columns: [{ name: "name", value: "{{ $json.name }}" }, { name: "email", value: "{{ $json.email }}" }] } },
      },
      {
        id: notify,
        type: "action.notify",
        position: { x: 4, y: 0 },
        data: { name: "Notify", config: { channel: "inbox", title: "New lead: {{ $node[\"Norm\"].json.name }}", body: "{{ $node[\"Norm\"].json.email }}" } },
      },
    ],
    edges: [
      { id: "e1", source: t, target: set },
      { id: "e2", source: set, target: iff },
      { id: "e3", source: iff, target: append, sourceHandle: "true" },
      { id: "e4", source: append, target: notify },
    ],
  };

  const wf = await prisma.workflow.create({
    data: { userId, name: `__test_lead_${randomBytes(3).toString("hex")}`, active: true, graph: graph as object, webhookToken: randomBytes(16).toString("hex") },
  });

  // TRUE branch: appendRow + notify happen.
  const execTrue = await runWorkflow({ workflowId: wf.id, trigger: "WEBHOOK", input: { name: " Lin ", email: "LIN@x.com" } });
  eq("full run SUCCESS", execTrue.status, "SUCCESS");
  eq("full run produced 5 node runs", execTrue.nodeRuns.length, 5);
  ok("full run order ascending", execTrue.nodeRuns.every((nr, i) => nr.order === i));
  const appendRun = execTrue.nodeRuns.find((nr) => nr.nodeKind === "action.appendRow");
  const notifyRun = execTrue.nodeRuns.find((nr) => nr.nodeKind === "action.notify");
  ok("appendRow ran in full run", !!appendRun && appendRun.status === "SUCCESS");
  ok("notify ran in full run", !!notifyRun && notifyRun.status === "SUCCESS");
  const dsAfter = await prisma.datastore.findFirst({ where: { userId, name: dsName }, include: { rows: true } });
  ok("full run wrote a Leads row", !!dsAfter && dsAfter.rows.length === 1);
  const rowData = dsAfter?.rows[0]?.data as Record<string, unknown> | undefined;
  eq("full run row normalized name", rowData?.name, "Lin");
  eq("full run row normalized email", rowData?.email, "lin@x.com");

  // FALSE branch: no email -> stops after the if; no appendRow/notify.
  const execFalse = await runWorkflow({ workflowId: wf.id, trigger: "WEBHOOK", input: { name: "NoEmail" } });
  eq("if-false run SUCCESS", execFalse.status, "SUCCESS");
  const ranKinds = execFalse.nodeRuns.map((nr) => nr.nodeKind);
  eq("if-false stops after if (3 nodes)", execFalse.nodeRuns.length, 3);
  ok("if-false did NOT append", !ranKinds.includes("action.appendRow"));
  ok("if-false did NOT notify", !ranKinds.includes("action.notify"));
  const ifRun = execFalse.nodeRuns.find((nr) => nr.nodeKind === "action.if");
  ok("if-false if node still SUCCESS", !!ifRun && ifRun.status === "SUCCESS");

  // getExecutionDetail round-trip
  const detail = await getExecutionDetail(execTrue.id);
  ok("getExecutionDetail returns the run", !!detail && detail.id === execTrue.id && detail.nodeRuns.length === 5);

  // Error propagation: a workflow whose http node 404s.
  const httpId = "n_http";
  const wfErr = await prisma.workflow.create({
    data: {
      userId,
      name: `__test_err_${randomBytes(3).toString("hex")}`,
      active: true,
      webhookToken: randomBytes(16).toString("hex"),
      graph: {
        nodes: [
          { id: t, type: "trigger.webhook", position: { x: 0, y: 0 }, data: { name: "In", config: {} } },
          { id: httpId, type: "action.http", position: { x: 1, y: 0 }, data: { name: "Get", config: { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/99999999", headers: [], bodyMode: "none", timeoutMs: 10000 } } },
          { id: notify, type: "action.notify", position: { x: 2, y: 0 }, data: { name: "After", config: { channel: "inbox", title: "should not run", body: "" } } },
        ],
        edges: [
          { id: "e1", source: t, target: httpId },
          { id: "e2", source: httpId, target: notify },
        ],
      } as object,
    },
  });
  const execErr = await runWorkflow({ workflowId: wfErr.id, trigger: "WEBHOOK", input: {} });
  eq("error run status ERROR", execErr.status, "ERROR");
  ok("error run has an error message", !!execErr.error);
  ok("error run stopped before notify", !execErr.nodeRuns.some((nr) => nr.nodeKind === "action.notify"));
  const httpRun = execErr.nodeRuns.find((nr) => nr.nodeKind === "action.http");
  ok("error run http node marked ERROR", !!httpRun && httpRun.status === "ERROR");

  // Cleanup test workflows + their data.
  if (dsAfter) await prisma.datastore.delete({ where: { id: dsAfter.id } }).catch(() => undefined);
  await prisma.notification.deleteMany({ where: { userId, title: { startsWith: "New lead:" } } }).catch(() => undefined);
  await prisma.workflow.delete({ where: { id: wf.id } }).catch(() => undefined);
  await prisma.workflow.delete({ where: { id: wfErr.id } }).catch(() => undefined);
}

function testCron(): void {
  console.log("\n[cron] nextRunAt computation");
  const from = new Date("2026-06-22T07:30:00.000Z");
  const next = computeNextRunAt("0 8 * * *", "UTC", from);
  ok("cron computed a date", next instanceof Date);
  eq("cron next is 08:00 UTC same day", next?.toISOString(), "2026-06-22T08:00:00.000Z");

  const from2 = new Date("2026-06-22T09:00:00.000Z");
  const next2 = computeNextRunAt("0 8 * * *", "UTC", from2);
  eq("cron rolls to next day after 8am", next2?.toISOString(), "2026-06-23T08:00:00.000Z");

  const bad = computeNextRunAt("not a cron", "UTC", from);
  ok("cron invalid expr -> null", bad === null);

  // Timezone awareness (8am New York is not 8am UTC).
  const tzNext = computeNextRunAt("0 8 * * *", "America/New_York", new Date("2026-06-22T00:00:00.000Z"));
  ok("cron tz-aware (not 08:00Z)", !!tzNext && tzNext.toISOString() !== "2026-06-22T08:00:00.000Z");
}

async function main(): Promise<void> {
  console.log("=== Fluxo engine tests ===");

  // Use (or create) a throwaway test user so we don't pollute demo data mid-test.
  const email = "__engine_test@fluxo.app";
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Engine Test", role: "USER", passwordHash: "x", locale: "en" },
    update: {},
  });

  try {
    await testExpressions();
    await testNodeHandlers(user.id);
    await testFullRuns(user.id);
    testCron();
  } finally {
    // Remove the throwaway test user and ALL its data (cascade).
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log("  - " + f);
  }

  // Restore a pristine demo DB by running the seed (it wipes+recreates demo users).
  console.log("\nRestoring pristine demo state via seed...");
  await import("./seed");
}

main().catch(async (err) => {
  console.error("engine-test crashed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
