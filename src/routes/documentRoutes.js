import { Router } from "express";
import {
  uploadDocument,
  listDocuments,
  getDocument,
  removeDocument,
} from "../controllers/documentController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadPdf } from "../middleware/upload.js";
import rateLimit from "express-rate-limit";
import { askQuestion } from "../controllers/qaController.js";
import { explainTopic } from "../controllers/explainController.js";
import { generateQuiz } from "../controllers/quizController.js";
import { generateWeakTopicQuiz } from "../controllers/quizController.js";
import { generateSummary, getSummary } from "../controllers/summaryController.js";

// AI calls cost money: 20 questions per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { message: "Too many requests, slow down" },
});

const router = Router();

router.use(requireAuth); // every document route needs a logged-in user

router.post("/", uploadPdf, uploadDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.delete("/:id", removeDocument);
router.post("/:id/ask", aiLimiter, askQuestion);
router.post("/:id/explain", aiLimiter, explainTopic);
router.post("/:id/quiz", aiLimiter, generateQuiz);
router.post("/:id/quiz/weak", aiLimiter, generateWeakTopicQuiz);
router.post("/:id/summary", aiLimiter, generateSummary);
router.get("/:id/summary", getSummary);

export default router;