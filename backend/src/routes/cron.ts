import { Router, type Request, type Response } from "express";
import { parseExpression } from "cron-parser";
import { prisma } from "../lib/prisma";
import { runWorkflow } from "../engine";

/**
 * Cron tick router. Mounted at `/cron` by app.ts.
 *   GET /tick  -> requires Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 *   Finds active workflows with cron != null and nextRunAt <= now; runs each
 *   (trigger SCHEDULE, input { now }) and recomputes nextRunAt. -> { ran: n }
 */
export const cronRouter = Router();

cronRouter.get("/tick", (req, res) => {
  void tick(req, res);
});

async function tick(req: Request, res: Response): Promise<void> {
  const secret = process.env.CRON_SECRET ?? "";
  const provided = extractSecret(req);

  if (!secret || provided !== secret) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } });
    return;
  }

  const now = new Date();

  const due = await prisma.workflow.findMany({
    where: {
      active: true,
      cron: { not: null },
      nextRunAt: { not: null, lte: now },
    },
  });

  let ran = 0;
  for (const wf of due) {
    try {
      await runWorkflow({
        workflowId: wf.id,
        trigger: "SCHEDULE",
        input: { now: now.toISOString() },
      });
      ran++;
    } catch {
      // continue with other workflows even if one fails to launch
    }

    const next = computeNextRunAt(wf.cron, wf.timezone, now);
    await prisma.workflow
      .update({
        where: { id: wf.id },
        data: { nextRunAt: next, lastRunAt: now },
      })
      .catch(() => undefined);
  }

  res.status(200).json({ ran });
}

function extractSecret(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const q = req.query.secret;
  if (typeof q === "string") return q;
  return null;
}

/** Compute the next run time for a cron expression in a given timezone, after `from`. */
export function computeNextRunAt(
  cron: string | null,
  timezone: string | null | undefined,
  from: Date = new Date()
): Date | null {
  if (!cron) return null;
  try {
    const interval = parseExpression(cron, {
      currentDate: from,
      tz: timezone || "UTC",
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}
