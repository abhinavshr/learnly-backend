import { getChunksByDocument, saveEmbeddings } from "../models/chunkModel.js";
import { embedDocuments, embedQuery } from "./embeddingService.js";

// Creates embeddings only for chunks that don't have one yet
async function ensureEmbeddings(chunks) {
  const missing = chunks.filter((c) => !c.embedding);
  if (missing.length === 0) return chunks;

  const vectors = await embedDocuments(missing.map((c) => c.text));
  missing.forEach((c, i) => {
    c.embedding = vectors[i];
  });
  await saveEmbeddings(missing.map((c) => ({ id: c.id, embedding: c.embedding })));
  return chunks;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveRelevantChunks(documentId, question, k = 5) {
  const chunks = await ensureEmbeddings(await getChunksByDocument(documentId));
  const queryVector = await embedQuery(question);

  return chunks
    .map((c) => ({ ...c, score: cosineSimilarity(queryVector, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}