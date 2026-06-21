import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { runWorkflow } from "../engine";

/**
 * Public webhook router (NO auth). Mounted at `/hooks` by app.ts; routes are relative.
 *   POST /:token  -> run workflow with req.body as trigger input
 *   GET  /:token  -> run workflow with req.query as trigger input (easy demo)
 */
export const webhookRouter = Router();

async function handle(req: Request, res: Response, input: unknown): Promise<void> {
  const token = req.params.token;

  const workflow = await prisma.workflow.findUnique({ where: { webhookToken: token } });
  if (!workflow) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Webhook not found" },
    });
    return;
  }

  if (!workflow.active) {
    res.status(404).json({
      error: { code: "WORKFLOW_INACTIVE", message: "This workflow is not active" },
    });
    return;
  }

  try {
    const execution = await runWorkflow({
      workflowId: workflow.id,
      trigger: "WEBHOOK",
      input,
    });
    res.status(200).json({ executionId: execution.id, status: execution.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    res.status(500).json({ error: { code: "INTERNAL", message } });
  }
}

webhookRouter.post("/:token", (req, res) => {
  void handle(req, res, req.body ?? {});
});

webhookRouter.get("/:token", (req, res) => {
  void handle(req, res, req.query ?? {});
});
