import { pool } from "../config/db.js";

export async function insertChunks(documentId, chunks) {
  if (chunks.length === 0) return;

  const rows = chunks.map((c) => [documentId, c.chunkIndex, c.pageNumber, c.text]);

  // query() (not execute()) is needed for the bulk "VALUES ?" form
  await pool.query(
    "INSERT INTO `Chunk` (documentId, chunkIndex, pageNumber, `text`) VALUES ?",
    [rows]
  );
}

// Used in the next steps (embeddings and Q&A)
export async function getChunksByDocument(documentId) {
  const [rows] = await pool.execute(
    "SELECT id, chunkIndex, pageNumber, `text`, embedding FROM `Chunk` WHERE documentId = ? ORDER BY chunkIndex",
    [documentId]
  );
  return rows;
}