import { Router } from "express";
import {
  submitAttempt,
  getAttempt,
  listAttempts,
} from "../controllers/attemptController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", listAttempts);
router.get("/:id", getAttempt);
router.post("/:id/submit", submitAttempt);

export default router;