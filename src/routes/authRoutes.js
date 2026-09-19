import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, getMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const   router = Router();

// Slows down password guessing: 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: "Too many attempts, try again later" },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, getMe);

export default router;