import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  generatePlan,
  listPlans,
  getPlan,
  updatePlanDay,
  removePlan,
} from "../controllers/planController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { message: "Too many requests, slow down" },
});

router.post("/", aiLimiter, generatePlan);
router.get("/", listPlans);
router.get("/:id", getPlan);
router.patch("/:id/days/:dayIndex", updatePlanDay);
router.delete("/:id", removePlan);

export default router;