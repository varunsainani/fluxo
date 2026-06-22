// Live browser pass: re-fetch-loop detection + EN screenshots (light + dark).
const pkg = require("/home/varun/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js");
const { chromium } = pkg;

const FRONT = "https://fluxo-lac.vercel.app";
const OUT = "/home/varun/my-projects/fluxo/screenshots";
const CHROME = "/home/varun/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";

// current seeded ids (post-reseed)
const WF_LEAD = "cmqogaeou0006plxn02kbwwdf";   // New Lead Capture (5-node webhook graph)
const EXEC = "cmqogat82002iplxnujw15eef";
const DS_LEADS = "cmqogafof000eplxngdsa0v9l";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loopFlags = [];

async function makeContext(browser, theme) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await context.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch (e) {} }, theme);
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: FRONT }]);
  return context;
}

async function demoLogin(context, label) {
  const page = await context.newPage();
  await page.goto(FRONT + "/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: label }).click();
  await page.waitForURL("**/workflows", { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  await page.close();
}

async function shot(context, path, name, opts = {}) {
  const page = await context.newPage();
  const counts = {};
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/") && req.method() === "GET") {
      const k = u.split("?")[0].replace(FRONT, "");
      counts[k] = (counts[k] || 0) + 1;
    }
  });
  try {
    await page.goto(FRONT + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (opts.waitSelector) await page.waitForSelector(opts.waitSelector, { timeout: 20000 }).catch(() => {});
    await sleep(opts.settle ?? 4500); // let any polling/loops surface
    if (opts.click) { for (const sel of opts.click) { await page.click(sel, { timeout: 4000 }).catch(() => {}); } await sleep(1200); }
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    // loop detection
    const max = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const looped = Object.entries(counts).filter(([, c]) => c >= 4);
    if (looped.length) loopFlags.push(`${name}: ${looped.map(([k, c]) => `${k}×${c}`).join(", ")}`);
    console.log(`  ${name.padEnd(22)} top=${max ? max[0] + "×" + max[1] : "none"}  ${looped.length ? "⚠ LOOP" : "ok"}`);
  } catch (e) {
    console.log(`  ${name.padEnd(22)} ERROR ${String(e).slice(0, 80)}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

  // ---------- LIGHT ----------
  console.log("LIGHT (user):");
  let ctx = await makeContext(browser, "light");
  await shot(ctx, "/", "01-landing-light", { settle: 3500 });
  await shot(ctx, "/login", "02-login-light", { settle: 2500 });
  await demoLogin(ctx, "Enter as demo user");
  await shot(ctx, "/workflows", "03-workflows-light", { waitSelector: "text=New Lead Capture" });
  await shot(ctx, `/workflows/${WF_LEAD}`, "04-editor-light", { waitSelector: ".react-flow__node", settle: 5500 });
  await shot(ctx, "/executions", "05-executions-light", { settle: 4000 });
  await shot(ctx, `/executions/${EXEC}`, "06-run-inspector-light", { settle: 4000 });
  await shot(ctx, `/datastores/${DS_LEADS}`, "07-datastore-light", { settle: 3500 });
  await shot(ctx, "/notifications", "08-notifications-light", { settle: 3500 });
  await shot(ctx, "/connections", "09-connections-light", { settle: 3000 });
  await ctx.close();

  console.log("LIGHT (admin):");
  let actx = await makeContext(browser, "light");
  await demoLogin(actx, "Enter as admin");
  await shot(actx, "/admin", "10-admin-light", { settle: 4000 });
  await actx.close();

  // ---------- DARK ----------
  console.log("DARK (user):");
  let dctx = await makeContext(browser, "dark");
  await shot(dctx, "/", "11-landing-dark", { settle: 3500 });
  await demoLogin(dctx, "Enter as demo user");
  await shot(dctx, "/workflows", "12-workflows-dark", { waitSelector: "text=New Lead Capture" });
  await shot(dctx, `/workflows/${WF_LEAD}`, "13-editor-dark", { waitSelector: ".react-flow__node", settle: 5500 });
  await shot(dctx, `/executions/${EXEC}`, "14-run-inspector-dark", { settle: 4000 });
  await shot(dctx, `/datastores/${DS_LEADS}`, "15-datastore-dark", { settle: 3500 });
  await dctx.close();

  console.log("DARK (admin):");
  let dactx = await makeContext(browser, "dark");
  await demoLogin(dactx, "Enter as admin");
  await shot(dactx, "/admin", "16-admin-dark", { settle: 4000 });
  await dactx.close();

  await browser.close();
  console.log("\n=== LOOP FLAGS ===");
  console.log(loopFlags.length ? loopFlags.join("\n") : "NONE — no page re-fetched any resource >=4x");
})();
