import express from "express";
import { promoteUser, getUsers } from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/users",
  authenticate,
  authorize("admin"),
  getUsers
);

router.post(
  "/users/:userId/promote",
  authenticate,
  authorize("admin"),
  promoteUser
);

export default router;
