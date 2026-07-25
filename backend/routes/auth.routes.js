import express from "express";
import {
  login,
  register,
  getUser,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/user", protect, getUser);
router.get("/verify-email", verifyEmail);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

export default router;
