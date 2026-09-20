import { pool } from "../config/db.js";

export async function findSummary(documentId, summaryLength) {
  const [rows] = await pool.execute(
    "SELECT summaryLength, content, createdAt FROM `Summary` WHERE documentId = ? AND summaryLength = ?",
    [documentId, summaryLength]
  );
  return rows[0] || null;
}

// Inserts a new summary, or replaces the old one of the same length
export async function saveSummary(documentId, summaryLength, content) {
  await pool.execute(
    `INSERT INTO \`Summary\` (documentId, summaryLength, content) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE content = ?, createdAt = NOW(3)`,
    [documentId, summaryLength, content, content]
  );
}