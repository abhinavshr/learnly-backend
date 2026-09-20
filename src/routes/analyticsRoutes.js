import { Router } from "express";
import { listTopics, listWeakTopics } from "../controllers/analyticsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/topics", listTopics);
router.get("/weak-topics", listWeakTopics);

export default router;