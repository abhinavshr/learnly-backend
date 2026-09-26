import { Router } from "express";
import {
  getDueFlashcards,
  reviewFlashcard,
  removeFlashcard,
} from "../controllers/flashcardController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/due", getDueFlashcards);
router.post("/:id/review", reviewFlashcard);
router.delete("/:id", removeFlashcard);

export default router;