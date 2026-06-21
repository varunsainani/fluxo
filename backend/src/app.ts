import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./lib/env";
import { localeMiddleware } from "./middleware/locale";
import { notFoundHandler, errorHandler } from "./middleware/error";

import authRouter from "./routes/auth";
import workflowsRouter from "./routes/workflows";
import executionsRouter from "./routes/executions";
import datastoresRouter from "./routes/datastores";
import notificationsRouter from "./routes/notifications";
import connectionsRouter from "./routes/connections";
import adminRouter from "./routes/admin";
// Built by another agent on the same filesystem; imported here (named exports).
import { webhookRouter } from "./routes/webhooks";
import { cronRouter } from "./routes/cron";

export function createApp(): Express {
  const app = express();

  // Behind a proxy (Vercel rewrite / Neon); trust it for secure cookies + IPs.
  app.set("trust proxy", 1);

  app.use(cookieParser());

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Locale resolution BEFORE body parsing so body-parser errors stay localized.
  app.use(localeMiddleware);

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter);
  app.use("/workflows", workflowsRouter);
  app.use("/executions", executionsRouter);
  app.use("/datastores", datastoresRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/connections", connectionsRouter);
  app.use("/admin", adminRouter);

  // Public webhook + protected cron (owned by another agent).
  app.use("/hooks", webhookRouter);
  app.use("/cron", cronRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
