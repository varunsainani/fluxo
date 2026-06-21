import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
} from "../controllers/connections";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listConnections));
router.post("/", asyncHandler(createConnection));
router.patch("/:id", asyncHandler(updateConnection));
router.delete("/:id", asyncHandler(deleteConnection));

export default router;
