import { z } from "zod";
import { findDocumentById } from "../models/documentModel.js";
import { getChunkTexts } from "../models/chunkModel.js";
import {
  insertFlashcards,
  listFlashcardsByDocument,
  listDueFlashcards,
  findFlashcard,
  updateSchedule,
  deleteFlashcard,
} from "../models/flashcardModel.js";
import { retrieveRelevantChunks } from "../services/retrievalService.js";
import { generateCards } from "../services/flashcardService.js";
import { scheduleNext } from "../services/srsService.js";
import { toAiError } from "../services/aiService.js";

const idSchema = z.coerce.number().int().positive();

function zodError(res, error) {
  return res.status(400).json({
    message: "Validation failed",
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });
}

const generateSchema = z.object({
  count: z.coerce.number().int().min(3).max(30).default(10),
  topic: z.string().trim().min(2).max(200).optional(),
});

// POST /api/documents/:id/flashcards
export async function generateFlashcards(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const body = generateSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const document = await findDocumentById(id.data, req.user.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (document.status !== "READY") {
      return res.status(409).json({ message: "Document is not ready yet" });
    }

    const { count, topic } = body.data;

    const chunks = topic
      ? await retrieveRelevantChunks(document.id, topic, 6)
      : await getChunkTexts(document.id);

    if (chunks.length === 0) {
      return res.status(409).json({
        message: "This document has no searchable content. Please delete it and upload it again.",
      });
    }

    const cards = await generateCards({ chunks, count, topic });
    await insertFlashcards(document.id, req.user.id, cards);

    res.status(201).json({ count: cards.length, cards });
  } catch (err) {
    if (err.code === "INVALID_FLASHCARD_JSON") {
      return res.status(502).json({ message: "Could not generate flashcards. Please try again." });
    }
    const aiError = toAiError(err);
    if (aiError) {
      console.error("AI error:", err.message);
      return res.status(aiError.status).json({ message: aiError.message });
    }
    next(err);
  }
}

// GET /api/documents/:id/flashcards
export async function listFlashcards(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const document = await findDocumentById(id.data, req.user.id);
    if (!document) return res.status(404).json({ message: "Document not found" });

    const cards = await listFlashcardsByDocument(document.id, req.user.id);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

// GET /api/flashcards/due?limit=20
export async function getDueFlashcards(req, res, next) {
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(20).safeParse(req.query.limit);
    if (!limit.success) return res.status(400).json({ message: "Invalid limit" });

    const cards = await listDueFlashcards(req.user.id, limit.data);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

const reviewSchema = z.object({
  quality: z.coerce.number().int().min(0).max(3), // 0 forgot, 1 hard, 2 good, 3 easy
});

// POST /api/flashcards/:id/review
export async function reviewFlashcard(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid flashcard id" });

    const body = reviewSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const card = await findFlashcard(id.data, req.user.id);
    if (!card) return res.status(404).json({ message: "Flashcard not found" });

    const next_ = scheduleNext(
      {
        easeFactor: Number(card.easeFactor),
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
      },
      body.data.quality
    );

    const nextReviewAt = new Date(Date.now() + next_.intervalDays * 24 * 60 * 60 * 1000);
    await updateSchedule(card.id, { ...next_, nextReviewAt });

    res.json({
      card: {
        id: card.id,
        easeFactor: next_.easeFactor,
        intervalDays: next_.intervalDays,
        repetitions: next_.repetitions,
        nextReviewAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/flashcards/:id
export async function removeFlashcard(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid flashcard id" });

    const deleted = await deleteFlashcard(id.data, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Flashcard not found" });

    res.json({ message: "Flashcard deleted" });
  } catch (err) {
    next(err);
  }
}