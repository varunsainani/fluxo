import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listDatastores,
  createDatastore,
  getDatastore,
  deleteDatastore,
} from "../controllers/datastores";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listDatastores));
router.post("/", asyncHandler(createDatastore));
router.get("/:id", asyncHandler(getDatastore));
router.delete("/:id", asyncHandler(deleteDatastore));

export default router;
