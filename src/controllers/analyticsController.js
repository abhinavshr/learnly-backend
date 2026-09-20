import { z } from "zod";
import { computeTopicStats } from "../services/analyticsService.js";

const querySchema = z.object({
  documentId: z.coerce.number().int().positive().optional(),
  threshold: z.coerce.number().int().min(1).max(100).default(60),
  minAnswers: z.coerce.number().int().min(1).max(50).default(2),
});

function parseQuery(req, res) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return null;
  }
  return parsed.data;
}

// GET /api/analytics/topics
export async function listTopics(req, res, next) {
  try {
    const query = parseQuery(req, res);
    if (!query) return;

    const topics = await computeTopicStats(req.user.id, query);
    res.json({
      settings: { threshold: query.threshold, minAnswers: query.minAnswers },
      topics,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/weak-topics
export async function listWeakTopics(req, res, next) {
  try {
    const query = parseQuery(req, res);
    if (!query) return;

    const topics = await computeTopicStats(req.user.id, query);
    res.json({
      settings: { threshold: query.threshold, minAnswers: query.minAnswers },
      weakTopics: topics.filter((t) => t.isWeak),
    });
  } catch (err) {
    next(err);
  }
}