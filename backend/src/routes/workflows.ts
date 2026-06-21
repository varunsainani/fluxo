import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listWorkflows,
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflowController,
} from "../controllers/workflows";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listWorkflows));
router.post("/", asyncHandler(createWorkflow));
router.get("/:id", asyncHandler(getWorkflow));
router.patch("/:id", asyncHandler(updateWorkflow));
router.delete("/:id", asyncHandler(deleteWorkflow));
router.post("/:id/run", asyncHandler(runWorkflowController));

export default router;
