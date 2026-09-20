import { z } from "zod";
import { findDocumentById } from "../models/documentModel.js";
import { retrieveRelevantChunks } from "../services/retrievalService.js";
import { explainFromContext, toAiError } from "../services/aiService.js";

const idSchema = z.coerce.number().int().positive();
const explainSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

export async function explainTopic(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const body = explainSchema.safeParse(req.body);
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

    const { topic, level } = body.data;

    const chunks = await retrieveRelevantChunks(document.id, topic, 4);
    if (chunks.length === 0) {
      return res.status(409).json({
        message: "This document has no searchable content. Please delete it and upload it again.",
      });
    }

    const explanation = await explainFromContext(topic, chunks, level);

    res.json({
      topic,
      level,
      explanation,
      sources: chunks.map((c) => ({
        pageNumber: c.pageNumber,
        score: Number(c.score.toFixed(3)),
      })),
    });
  } catch (err) {
    const aiError = toAiError(err);
    if (aiError) {
      console.error("AI error:", err.message);
      return res.status(aiError.status).json({ message: aiError.message });
    }
    next(err);
  }
}