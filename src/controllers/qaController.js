import { z } from "zod";
import { findDocumentById } from "../models/documentModel.js";
import { retrieveRelevantChunks } from "../services/retrievalService.js";
import { answerFromContext } from "../services/aiService.js";

const idSchema = z.coerce.number().int().positive();
const askSchema = z.object({
  question: z.string().trim().min(3).max(1000),
});

export async function askQuestion(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const body = askSchema.safeParse(req.body);
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

    const chunks = await retrieveRelevantChunks(document.id, body.data.question);
    const answer = await answerFromContext(body.data.question, chunks);

    res.json({
      answer,
      sources: chunks.map((c) => ({
        pageNumber: c.pageNumber,
        score: Number(c.score.toFixed(3)),
        preview: c.text.slice(0, 150),
      })),
    });
  } catch (err) {
    next(err);
  }
}