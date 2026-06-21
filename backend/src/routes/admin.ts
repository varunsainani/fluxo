import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { overview, listUsers, listAllWorkflows } from "../controllers/admin";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/overview", asyncHandler(overview));
router.get("/users", asyncHandler(listUsers));
router.get("/workflows", asyncHandler(listAllWorkflows));

export default router;
