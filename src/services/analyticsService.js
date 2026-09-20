import { getTopicStats } from "../models/analyticsModel.js";

export async function computeTopicStats(
  userId,
  { documentId, threshold = 60, minAnswers = 2 } = {}
) {
  const rows = await getTopicStats(userId, documentId);

  return rows
    .map((r) => {
      const accuracy = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      return {
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        topic: r.topic,
        correct: r.correct,
        total: r.total,
        accuracy,
        isWeak: r.total >= minAnswers && accuracy < threshold,
        lastPracticedAt: r.lastPracticedAt,
      };
    })
    // Weakest first. On a tie, the topic with more evidence comes first.
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}