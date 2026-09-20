import { pool } from "../config/db.js";

// Quiz and questions are saved together, or not at all
export async function createQuiz({ userId, documentId, title, difficulty, questions }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      "INSERT INTO `Quiz` (userId, documentId, title, difficulty) VALUES (?, ?, ?, ?)",
      [userId, documentId, title, difficulty]
    );
    const quizId = result.insertId;

    const rows = questions.map((q, i) => [
      quizId,
      i + 1,
      q.question,
      JSON.stringify(q.options),
      q.correctIndex,
      q.explanation,
      q.topic,
    ]);
    await conn.query(
      "INSERT INTO `Question` (quizId, sortOrder, `question`, `options`, correctIndex, explanation, topic) VALUES ?",
      [rows]
    );

    await conn.commit();
    return quizId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listQuizzesByUser(userId, documentId) {
  const params = [userId];
  let filter = "";
  if (documentId) {
    filter = "AND q.documentId = ?";
    params.push(documentId);
  }

  const [rows] = await pool.execute(
    `SELECT q.id, q.documentId, q.title, q.difficulty, q.createdAt,
            (SELECT COUNT(*) FROM \`Question\` WHERE quizId = q.id) AS questionCount
     FROM \`Quiz\` q WHERE q.userId = ? ${filter} ORDER BY q.createdAt DESC`,
    params
  );
  return rows;
}

// Scoped by userId so users only ever see their own quizzes
export async function findQuiz(id, userId) {
  const [rows] = await pool.execute(
    "SELECT id, documentId, title, difficulty, createdAt FROM `Quiz` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return rows[0] || null;
}

export async function getQuestions(quizId) {
  const [rows] = await pool.execute(
    `SELECT id, sortOrder, \`question\`, \`options\`, correctIndex, explanation, topic
     FROM \`Question\` WHERE quizId = ? ORDER BY sortOrder`,
    [quizId]
  );
  return rows;
}

export async function deleteQuiz(id, userId) {
  const [result] = await pool.execute(
    "DELETE FROM `Quiz` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return result.affectedRows > 0;
}