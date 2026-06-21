import "dotenv/config";
import type { Server } from "http";
import { createApp } from "../src/app";

const PORT = 4055;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
let fail = 0;
const fails: string[] = [];
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    fails.push(label);
    console.log("  ✗ " + label);
  }
}

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; locale?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.locale) headers["X-Locale"] = opts.locale;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

async function main() {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  try {
    // health
    let r = await req("GET", "/health");
    ok(r.status === 200 && r.data?.ok === true, "GET /health → {ok:true}");

    // auth scoping
    r = await req("GET", "/workflows");
    ok(r.status === 401, "GET /workflows without token → 401");

    // demo user login
    r = await req("POST", "/auth/demo", { body: { role: "user" } });
    ok(r.status === 200 && !!r.data?.accessToken, "POST /auth/demo(user) → accessToken");
    ok(r.data?.user?.email === "demo@fluxo.app", "demo user is demo@fluxo.app");
    const token: string = r.data.accessToken;

    // me
    r = await req("GET", "/auth/me", { token });
    ok(r.status === 200 && r.data?.user?.role === "USER", "GET /auth/me → USER");

    // workflows list
    r = await req("GET", "/workflows", { token });
    ok(r.status === 200 && Array.isArray(r.data) && r.data.length >= 3, `GET /workflows → ≥3 (got ${r.data?.length})`);
    const wfList = r.data as any[];
    const leadWf = wfList.find((w) => /lead/i.test(w.name)) ?? wfList[0];
    ok(!!leadWf?.id, "found a workflow to run");

    // workflow detail
    r = await req("GET", `/workflows/${leadWf.id}`, { token });
    ok(r.status === 200 && !!r.data?.graph?.nodes?.length, "GET /workflows/:id → graph.nodes");
    const webhookToken: string | undefined = r.data?.webhookToken;
    const isWebhookWf = (r.data?.graph?.nodes ?? []).some((n: any) => n.type === "trigger.webhook");

    // manual run
    r = await req("POST", `/workflows/${leadWf.id}/run`, {
      token,
      body: { input: { name: "Smoke Lead", email: "smoke@test.com", source: "smoke" } },
    });
    ok((r.status === 200 || r.status === 201) && !!r.data?.id, `POST /workflows/:id/run → execution (status ${r.status})`);
    ok(["SUCCESS", "ERROR"].includes(r.data?.status), `run status terminal (got ${r.data?.status})`);
    ok(Array.isArray(r.data?.nodeRuns) && r.data.nodeRuns.length > 0, `run produced nodeRuns (${r.data?.nodeRuns?.length})`);
    const execId = r.data?.id;

    // execution list + detail
    r = await req("GET", `/executions?workflowId=${leadWf.id}`, { token });
    ok(r.status === 200 && Array.isArray(r.data) && r.data.some((e: any) => e.id === execId), "GET /executions?workflowId= includes run");
    r = await req("GET", `/executions/${execId}`, { token });
    ok(r.status === 200 && r.data?.id === execId && Array.isArray(r.data?.nodeRuns), "GET /executions/:id detail");

    // webhook trigger (public, no auth) — use a webhook workflow's token
    const webhookWf = wfList.find((w) => w.trigger === "WEBHOOK" && w.active) ?? (isWebhookWf ? leadWf : null);
    if (webhookWf) {
      const detail = await req("GET", `/workflows/${webhookWf.id}`, { token });
      const tk = detail.data?.webhookToken;
      r = await req("POST", `/hooks/${tk}`, { body: { name: "Hook Lead", email: "hook@test.com" } });
      ok(r.status === 200 && !!r.data?.executionId, `POST /hooks/:token → executionId (status ${r.status})`);
    } else {
      ok(false, "no active webhook workflow found to test /hooks");
    }

    // webhook bad token → 404
    r = await req("POST", `/hooks/nonexistenttoken123`, { body: {} });
    ok(r.status === 404, "POST /hooks/bad → 404");

    // datastores
    r = await req("GET", "/datastores", { token });
    ok(r.status === 200 && Array.isArray(r.data), "GET /datastores → array");
    const leads = (r.data as any[]).find((d) => /lead/i.test(d.name));
    ok(!!leads && leads.rowCount >= 1, "Leads datastore has rows");
    if (leads) {
      r = await req("GET", `/datastores/${leads.id}`, { token });
      ok(r.status === 200 && Array.isArray(r.data?.columns) && Array.isArray(r.data?.rows), "GET /datastores/:id → columns+rows");
    }

    // notifications
    r = await req("GET", "/notifications", { token });
    ok(r.status === 200 && Array.isArray(r.data), "GET /notifications → array");
    r = await req("GET", "/notifications/unread-count", { token });
    ok(r.status === 200 && typeof r.data?.count === "number", "GET /notifications/unread-count");

    // connections
    r = await req("GET", "/connections", { token });
    ok(r.status === 200 && Array.isArray(r.data), "GET /connections → array");

    // CRUD create+delete a connection
    r = await req("POST", "/connections", { token, body: { name: "Smoke Conn", baseUrl: "https://example.com", headers: [{ key: "X-Test", value: "1" }] } });
    ok(r.status === 200 || r.status === 201, "POST /connections → created");
    const connId = r.data?.id;
    if (connId) {
      r = await req("DELETE", `/connections/${connId}`, { token });
      ok(r.status === 200 && r.data?.ok === true, "DELETE /connections/:id");
    }

    // i18n: bad login localized differently per locale
    const en = await req("POST", "/auth/login", { locale: "en", body: { email: "demo@fluxo.app", password: "wrongpw" } });
    const es = await req("POST", "/auth/login", { locale: "es", body: { email: "demo@fluxo.app", password: "wrongpw" } });
    ok(en.status === 401 && es.status === 401, "bad login → 401 both locales");
    ok(typeof en.data?.error?.message === "string" && en.data.error.message !== es.data?.error?.message, "error message localized (en ≠ es)");

    // admin
    r = await req("POST", "/auth/demo", { body: { role: "admin" } });
    ok(r.status === 200 && r.data?.user?.role === "ADMIN", "POST /auth/demo(admin) → ADMIN");
    const adminToken = r.data?.accessToken;
    r = await req("GET", "/admin/overview", { token: adminToken });
    ok(r.status === 200 && !!r.data?.stats, "GET /admin/overview (admin) → stats");
    // non-admin forbidden
    r = await req("GET", "/admin/overview", { token });
    ok(r.status === 403, "GET /admin/overview as user → 403");
  } finally {
    server.close();
  }

  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("FAILURES:\n - " + fails.join("\n - "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
