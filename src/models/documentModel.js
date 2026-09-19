import { pool } from "../config/db.js";

export async function createDocument({ userId, title, originalName }) {
  const [result] = await pool.execute(
    "INSERT INTO `Document` (userId, title, originalName) VALUES (?, ?, ?)",
    [userId, title, originalName]
  );
  return result.insertId;
}

export async function markDocumentReady(id, { fullText, pageCount }) {
  await pool.execute(
    "UPDATE `Document` SET status = 'READY', `fullText` = ?, pageCount = ? WHERE id = ?",
    [fullText, pageCount, id]
  );
}

export async function markDocumentFailed(id, errorMessage) {
  await pool.execute(
    "UPDATE `Document` SET status = 'FAILED', errorMessage = ? WHERE id = ?",
    [errorMessage, id]
  );
}

// List view: never load fullText here, it can be huge
export async function listDocumentsByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT id, title, originalName, status, pageCount, errorMessage, createdAt
     FROM \`Document\` WHERE userId = ? ORDER BY createdAt DESC`,
    [userId]
  );
  return rows;
}

// Scoped by userId so users can only ever see their own documents
export async function findDocumentById(id, userId) {
  const [rows] = await pool.execute(
    `SELECT id, title, originalName, status, pageCount, errorMessage, createdAt
     FROM \`Document\` WHERE id = ? AND userId = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

// Used later by chunking, summary and quiz features
export async function getDocumentText(id, userId) {
  const [rows] = await pool.execute(
    "SELECT id, title, `fullText` FROM `Document` WHERE id = ? AND userId = ? AND status = 'READY'",
    [id, userId]
  );
  return rows[0] || null;
}

export async function deleteDocument(id, userId) {
  const [result] = await pool.execute(
    "DELETE FROM `Document` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return result.affectedRows > 0;
}