import { Router } from "express";
import { listQuizzes, getQuiz, removeQuiz } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", listQuizzes);
router.get("/:id", getQuiz);
router.delete("/:id", removeQuiz);

export default router;