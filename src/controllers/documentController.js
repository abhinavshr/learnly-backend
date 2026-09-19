import { z } from "zod";
import {
  createDocument,
  markDocumentReady,
  markDocumentFailed,
  listDocumentsByUser,
  findDocumentById,
  deleteDocument,
} from "../models/documentModel.js";
import { insertChunks } from "../models/chunkModel.js";
import { extractPdfText } from "../services/pdfService.js";
import { chunkPages } from "../services/chunkService.js";

const MIN_TEXT_LENGTH = 100; // less than this means a scanned/image PDF
const idSchema = z.coerce.number().int().positive();

export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'PDF file is required (form-data field name: "file")',
      });
    }

    const originalName = req.file.originalname.slice(0, 255);
    const title =
      (req.body.title || "").trim().slice(0, 255) ||
      originalName.replace(/\.pdf$/i, "");

    // Save the record first so failures are visible in the document list
    const docId = await createDocument({
      userId: req.user.id,
      title,
      originalName,
    });

    // 1. Extract text (also returns the text of each page)
    let extracted;
    try {
      extracted = await extractPdfText(req.file.buffer);
    } catch {
      const message =
        "Could not read this PDF. It may be corrupted or password protected.";
      await markDocumentFailed(docId, message);
      return res.status(422).json({ message, documentId: docId });
    }

    if (extracted.text.length < MIN_TEXT_LENGTH) {
      const message =
        "No readable text found. This looks like a scanned PDF (OCR is not supported yet).";
      await markDocumentFailed(docId, message);
      return res.status(422).json({ message, documentId: docId });
    }

    // 2. Split into chunks and save everything
    try {
      const chunks = chunkPages(extracted.pages);

      // Chunks first, so a document is never READY without its chunks
      await insertChunks(docId, chunks);
      await markDocumentReady(docId, {
        fullText: extracted.text,
        pageCount: extracted.pageCount,
      });
    } catch (err) {
      await markDocumentFailed(docId, "Failed to save extracted text");
      throw err; // still logged and returned as a 500 by the global handler
    }

    const document = await findDocumentById(docId, req.user.id);
    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const documents = await listDocumentsByUser(req.user.id);
    res.json({ documents });
  } catch (err) {
    next(err);
  }
}

export async function getDocument(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const document = await findDocumentById(id.data, req.user.id);
    if (!document) return res.status(404).json({ message: "Document not found" });

    res.json({ document });
  } catch (err) {
    next(err);
  }
}

export async function removeDocument(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid document id" });

    const deleted = await deleteDocument(id.data, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Document not found" });

    res.json({ message: "Document deleted" });
  } catch (err) {
    next(err);
  }
}