import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { listExecutions, getExecution } from "../controllers/executions";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listExecutions));
router.get("/:id", asyncHandler(getExecution));

export default router;
