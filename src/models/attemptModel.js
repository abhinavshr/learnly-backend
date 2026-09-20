import { pool } from "../config/db.js";

export async function createAttempt({ userId, quizId, mode, timeLimitSeconds, totalQuestions }) {
  const [result] = await pool.execute(
    "INSERT INTO `Attempt` (userId, quizId, mode, timeLimitSeconds, totalQuestions) VALUES (?, ?, ?, ?, ?)",
    [userId, quizId, mode, timeLimitSeconds, totalQuestions]
  );
  return result.insertId;
}

// elapsedSeconds is computed by MySQL itself, so there are no time zone surprises
export async function findAttempt(id, userId) {
  const [rows] = await pool.execute(
    `SELECT id, quizId, mode, status, timeLimitSeconds, totalQuestions, score, timedOut,
            startedAt, submittedAt,
            TIMESTAMPDIFF(SECOND, startedAt, NOW(3)) AS elapsedSeconds
     FROM \`Attempt\` WHERE id = ? AND userId = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

// Grades are saved once: the row is locked so a double-click can't submit twice
export async function saveSubmission({ attemptId, results, score, timedOut }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT status FROM `Attempt` WHERE id = ? FOR UPDATE",
      [attemptId]
    );
    if (!rows[0] || rows[0].status !== "in_progress") {
      const err = new Error("Attempt already submitted");
      err.code = "ALREADY_SUBMITTED";
      throw err;
    }

    const values = results.map((r) => [
      attemptId,
      r.questionId,
      r.selectedIndex,
      r.isCorrect ? 1 : 0,
    ]);
    await conn.query(
      "INSERT INTO `AttemptAnswer` (attemptId, questionId, selectedIndex, isCorrect) VALUES ?",
      [values]
    );

    await conn.execute(
      "UPDATE `Attempt` SET status = 'submitted', score = ?, timedOut = ?, submittedAt = NOW(3) WHERE id = ?",
      [score, timedOut ? 1 : 0, attemptId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getAttemptResults(attemptId) {
  const [rows] = await pool.execute(
    `SELECT q.id AS questionId, q.sortOrder, q.\`question\`, q.\`options\`,
            q.correctIndex, q.explanation, q.topic,
            aa.selectedIndex, aa.isCorrect
     FROM \`AttemptAnswer\` aa
     JOIN \`Question\` q ON q.id = aa.questionId
     WHERE aa.attemptId = ? ORDER BY q.sortOrder`,
    [attemptId]
  );
  return rows.map((r) => ({ ...r, isCorrect: Boolean(r.isCorrect) }));
}

export async function listAttemptsByUser(userId, quizId) {
  const params = [userId];
  let filter = "";
  if (quizId) {
    filter = "AND a.quizId = ?";
    params.push(quizId);
  }

  const [rows] = await pool.execute(
    `SELECT a.id, a.quizId, qz.title AS quizTitle, a.mode, a.status, a.score,
            a.totalQuestions, a.timedOut, a.startedAt, a.submittedAt
     FROM \`Attempt\` a JOIN \`Quiz\` qz ON qz.id = a.quizId
     WHERE a.userId = ? ${filter} ORDER BY a.startedAt DESC`,
    params
  );
  return rows;
}