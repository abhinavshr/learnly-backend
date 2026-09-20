import { z } from "zod";
import { findDocumentById } from "../models/documentModel.js";
import { getChunkTexts } from "../models/chunkModel.js";
import { findSummary, saveSummary } from "../models/summaryModel.js";
import { retrieveRelevantChunks } from "../services/retrievalService.js";
import { summarizeDocument, summarizeTopic } from "../services/summaryService.js";
import { toAiError } from "../services/aiService.js";

const idSchema = z.coerce.number().int().positive();
const lengthSchema = z.enum(["short", "medium", "detailed"]);

const generateSchema = z.object({
  length: lengthSchema.default("medium"),
  topic: z.string().trim().min(2).max(200).optional(),
  refresh: z.boolean().default(false),
});

function zodError(res, error) {
  return res.status(400).json({
    message: "Validation failed",
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });
}

async function loadReadyDocument(req, res) {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ message: "Invalid document id" });
    return null;
  }

  const document = await findDocumentById(id.data, req.user.id);
  if (!document) {
    res.status(404).json({ message: "Document not found" });
    return null;
  }
  if (document.status !== "READY") {
    res.status(409).json({ message: "Document is not ready yet" });
    return null;
  }
  return document;
}

// POST /api/documents/:id/summary
export async function generateSummary(req, res, next) {
  try {
    const document = await loadReadyDocument(req, res);
    if (!document) return;

    const body = generateSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const { length, topic, refresh } = body.data;

    // Topic summary: searched live, not saved
    if (topic) {
      const chunks = await retrieveRelevantChunks(document.id, topic, 6);
      if (chunks.length === 0) {
        return res.status(409).json({
          message: "This document has no searchable content. Please delete it and upload it again.",
        });
      }

      const content = await summarizeTopic(chunks, length);
      return res.json({
        summary: { length, topic, content, cached: false },
        sources: chunks.map((c) => ({
          pageNumber: c.pageNumber,
          score: Number(c.score.toFixed(3)),
        })),
      });
    }

    // Whole document: reuse the saved summary unless a refresh was requested
    if (!refresh) {
      const saved = await findSummary(document.id, length);
      if (saved) {
        return res.json({
          summary: {
            length,
            content: saved.content,
            cached: true,
            createdAt: saved.createdAt,
          },
        });
      }
    }

    const chunks = await getChunkTexts(document.id);
    if (chunks.length === 0) {
      return res.status(409).json({
        message: "This document has no searchable content. Please delete it and upload it again.",
      });
    }

    const content = await summarizeDocument(chunks, length);
    await saveSummary(document.id, length, content);

    res.status(201).json({ summary: { length, content, cached: false } });
  } catch (err) {
    if (err.code === "DOCUMENT_TOO_LARGE") {
      return res.status(413).json({
        message: "This document is too long to summarize in one go. Use the topic option to summarize a section.",
      });
    }
    const aiError = toAiError(err);
    if (aiError) {
      console.error("AI error:", err.message);
      return res.status(aiError.status).json({ message: aiError.message });
    }
    next(err);
  }
}

// GET /api/documents/:id/summary?length=medium  (no AI call)
export async function getSummary(req, res, next) {
  try {
    const document = await loadReadyDocument(req, res);
    if (!document) return;

    const length = lengthSchema.safeParse(req.query.length ?? "medium");
    if (!length.success) {
      return res.status(400).json({ message: "length must be short, medium or detailed" });
    }

    const saved = await findSummary(document.id, length.data);
    if (!saved) {
      return res.status(404).json({ message: "No summary yet. Generate one first." });
    }

    res.json({
      summary: {
        length: length.data,
        content: saved.content,
        cached: true,
        createdAt: saved.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}