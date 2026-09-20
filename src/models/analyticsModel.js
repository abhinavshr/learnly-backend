import { pool } from "../config/db.js";

// Accuracy per topic across all submitted attempts of one user.
// Unanswered questions were saved as wrong, so they count against the topic.
export async function getTopicStats(userId, documentId) {
  const params = [userId];
  let filter = "";
  if (documentId) {
    filter = "AND qz.documentId = ?";
    params.push(documentId);
  }

  const [rows] = await pool.execute(
    `SELECT qz.documentId, d.title AS documentTitle, q.topic,
            COUNT(*) AS total,
            SUM(aa.isCorrect) AS correct,
            MAX(a.submittedAt) AS lastPracticedAt
     FROM \`AttemptAnswer\` aa
     JOIN \`Attempt\` a   ON a.id  = aa.attemptId
     JOIN \`Question\` q  ON q.id  = aa.questionId
     JOIN \`Quiz\` qz     ON qz.id = q.quizId
     JOIN \`Document\` d  ON d.id  = qz.documentId
     WHERE a.userId = ? AND a.status = 'submitted' ${filter}
     GROUP BY qz.documentId, d.title, q.topic`,
    params
  );

  // MySQL returns SUM() and COUNT() as strings or BigInts, so convert them
  return rows.map((r) => ({
    ...r,
    total: Number(r.total),
    correct: Number(r.correct),
  }));
}