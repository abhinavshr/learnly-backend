import { z } from "zod";
import { findDocumentById } from "../models/documentModel.js";
import { getChunkTexts } from "../models/chunkModel.js";
import {
  createQuiz,
  listQuizzesByUser,
  findQuiz,
  getQuestions,
  deleteQuiz,
} from "../models/quizModel.js";
import { retrieveRelevantChunks } from "../services/retrievalService.js";
import { generateQuestions, sampleEvenly } from "../services/quizService.js";
import { toAiError } from "../services/aiService.js";

const idSchema = z.coerce.number().int().positive();

const generateSchema = z.object({
  count: z.coerce.number().int().min(3).max(15).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  topic: z.string().trim().min(2).max(200).optional(),
});

export async function generateQuiz(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const body = generateSchema.safeParse(req.body ?? {});
    if (!body.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: body.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }

    const document = await findDocumentById(id.data, req.user.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (document.status !== "READY") {
      return res.status(409).json({ message: "Document is not ready yet" });
    }

    const { count, difficulty, topic } = body.data;

    // A chosen topic uses search. Otherwise we sample the whole document.
    const chunks = topic
      ? await retrieveRelevantChunks(document.id, topic, 6)
      : sampleEvenly(await getChunkTexts(document.id), 8);

    if (chunks.length === 0) {
      return res.status(409).json({
        message: "This document has no searchable content. Please delete it and upload it again.",
      });
    }

    const questions = await generateQuestions({ chunks, count, difficulty, topic });

    const title = (topic ? `${document.title} - ${topic}` : `${document.title} Quiz`).slice(0, 255);
    const quizId = await createQuiz({
      userId: req.user.id,
      documentId: document.id,
      title,
      difficulty,
      questions,
    });

    res.status(201).json({
      quiz: { id: quizId, documentId: document.id, title, difficulty },
      questions,
    });
  } catch (err) {
    if (err.code === "INVALID_QUIZ_JSON") {
      return res.status(502).json({ message: "Could not generate a valid quiz. Please try again." });
    }
    const aiError = toAiError(err);
    if (aiError) {
      console.error("AI error:", err.message);
      return res.status(aiError.status).json({ message: aiError.message });
    }
    next(err);
  }
}

export async function listQuizzes(req, res, next) {
  try {
    const documentId = req.query.documentId
      ? idSchema.safeParse(req.query.documentId)
      : null;
    if (documentId && !documentId.success) {
      return res.status(400).json({ message: "Invalid documentId" });
    }

    const quizzes = await listQuizzesByUser(req.user.id, documentId?.data);
    res.json({ quizzes });
  } catch (err) {
    next(err);
  }
}

export async function getQuiz(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid quiz id" });

    const quiz = await findQuiz(id.data, req.user.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    let questions = await getQuestions(quiz.id);

    // Answers are hidden unless asked for, so practice/exam mode can't leak them
    if (req.query.withAnswers !== "true") {
      questions = questions.map(({ correctIndex, explanation, ...rest }) => rest);
    }

    res.json({ quiz, questions });
  } catch (err) {
    next(err);
  }
}

export async function removeQuiz(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid quiz id" });

    const deleted = await deleteQuiz(id.data, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Quiz not found" });

    res.json({ message: "Quiz deleted" });
  } catch (err) {
    next(err);
  }
}