import { pool } from "../config/db.js";

export async function insertFlashcards(documentId, userId, cards) {
  if (cards.length === 0) return;

  const rows = cards.map((c) => [documentId, userId, c.front, c.back, c.topic]);
  await pool.query(
    "INSERT INTO `Flashcard` (documentId, userId, front, back, topic) VALUES ?",
    [rows]
  );
}

export async function listFlashcardsByDocument(documentId, userId) {
  const [rows] = await pool.execute(
    `SELECT id, front, back, topic, easeFactor, intervalDays, repetitions, nextReviewAt, lastReviewedAt
     FROM \`Flashcard\` WHERE documentId = ? AND userId = ? ORDER BY createdAt`,
    [documentId, userId]
  );
  return rows;
}

export async function listDueFlashcards(userId, limit) {
  const [rows] = await pool.execute(
    `SELECT f.id, f.documentId, d.title AS documentTitle, f.front, f.back, f.topic,
            f.easeFactor, f.intervalDays, f.repetitions, f.nextReviewAt
     FROM \`Flashcard\` f JOIN \`Document\` d ON d.id = f.documentId
     WHERE f.userId = ? AND f.nextReviewAt <= NOW(3)
     ORDER BY f.nextReviewAt ASC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

export async function findFlashcard(id, userId) {
  const [rows] = await pool.execute(
    "SELECT * FROM `Flashcard` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return rows[0] || null;
}

export async function updateSchedule(id, { easeFactor, intervalDays, repetitions, nextReviewAt }) {
  await pool.execute(
    `UPDATE \`Flashcard\`
     SET easeFactor = ?, intervalDays = ?, repetitions = ?, nextReviewAt = ?, lastReviewedAt = NOW(3)
     WHERE id = ?`,
    [easeFactor, intervalDays, repetitions, nextReviewAt, id]
  );
}

export async function deleteFlashcard(id, userId) {
  const [result] = await pool.execute(
    "DELETE FROM `Flashcard` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return result.affectedRows > 0;
}