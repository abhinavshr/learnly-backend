import { Router } from "express";
import { listQuizzes, getQuiz, removeQuiz } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";
import { startAttempt } from "../controllers/attemptController.js";

const router = Router();

router.use(requireAuth);

router.get("/", listQuizzes);
router.get("/:id", getQuiz);
router.delete("/:id", removeQuiz);
router.post("/:id/attempts", startAttempt);

export default router;