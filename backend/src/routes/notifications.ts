import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  unreadCount,
  updateNotification,
  readAll,
  deleteNotification,
} from "../controllers/notifications";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listNotifications));
router.get("/unread-count", asyncHandler(unreadCount));
router.post("/read-all", asyncHandler(readAll));
router.patch("/:id", asyncHandler(updateNotification));
router.delete("/:id", asyncHandler(deleteNotification));

export default router;
