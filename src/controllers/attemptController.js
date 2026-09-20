import { z } from "zod";
import { findQuiz, getQuestions } from "../models/quizModel.js";
import {
  createAttempt,
  findAttempt,
  saveSubmission,
  getAttemptResults,
  listAttemptsByUser,
} from "../models/attemptModel.js";

const idSchema = z.coerce.number().int().positive();

const startSchema = z.object({
  mode: z.enum(["practice", "exam"]).default("practice"),
  timeLimitMinutes: z.coerce.number().int().min(1).max(180).optional(),
});

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.coerce.number().int().positive(),
        selectedIndex: z.number().int().min(0).max(3).nullable(),
      })
    )
    .max(50)
    .default([]),
});

const GRACE_SECONDS = 30; // covers network delay and slow phones

const percent = (score, total) => (total ? Math.round((score / total) * 100) : 0);

function zodError(res, error) {
  return res.status(400).json({
    message: "Validation failed",
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });
}

// Accuracy per topic: this is what weak-topic tracking will be built on
function topicBreakdown(results) {
  const map = new Map();
  for (const r of results) {
    const t = map.get(r.topic) ?? { topic: r.topic, correct: 0, total: 0 };
    t.total += 1;
    if (r.isCorrect) t.correct += 1;
    map.set(r.topic, t);
  }
  return [...map.values()].map((t) => ({ ...t, accuracy: percent(t.correct, t.total) }));
}

function attemptSummary(a) {
  return {
    id: a.id,
    quizId: a.quizId,
    mode: a.mode,
    status: a.status,
    score: a.score,
    totalQuestions: a.totalQuestions,
    percentage: percent(a.score, a.totalQuestions),
    timedOut: Boolean(a.timedOut),
    submittedAt: a.submittedAt,
  };
}

// POST /api/quizzes/:id/attempts
export async function startAttempt(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid quiz id" });

    const body = startSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const quiz = await findQuiz(id.data, req.user.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const questions = await getQuestions(quiz.id);
    if (questions.length === 0) {
      return res.status(409).json({ message: "This quiz has no questions" });
    }

    const { mode, timeLimitMinutes } = body.data;

    // Practice has no timer. Exam defaults to 1 minute per question.
    const timeLimitSeconds =
      mode === "exam" ? (timeLimitMinutes ?? questions.length) * 60 : null;

    const attemptId = await createAttempt({
      userId: req.user.id,
      quizId: quiz.id,
      mode,
      timeLimitSeconds,
      totalQuestions: questions.length,
    });

    res.status(201).json({
      attempt: {
        id: attemptId,
        quizId: quiz.id,
        mode,
        timeLimitSeconds,
        totalQuestions: questions.length,
      },
      // Answers and explanations are never sent before grading
      questions: questions.map(({ correctIndex, explanation, ...rest }) => rest),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/attempts/:id/submit
export async function submitAttempt(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid attempt id" });

    const body = submitSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const attempt = await findAttempt(id.data, req.user.id);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (attempt.status !== "in_progress") {
      return res.status(409).json({ message: "This attempt was already submitted" });
    }

    const questions = await getQuestions(attempt.quizId);
    const questionIds = new Set(questions.map((q) => q.id));

    // Reject answers for questions that are not in this quiz, or repeated ones
    const chosen = new Map();
    for (const a of body.data.answers) {
      if (!questionIds.has(a.questionId)) {
        return res
          .status(400)
          .json({ message: `Question ${a.questionId} is not part of this quiz` });
      }
      if (chosen.has(a.questionId)) {
        return res
          .status(400)
          .json({ message: `Question ${a.questionId} was answered more than once` });
      }
      chosen.set(a.questionId, a.selectedIndex);
    }

    const timedOut =
      attempt.mode === "exam" &&
      attempt.timeLimitSeconds != null &&
      attempt.elapsedSeconds > attempt.timeLimitSeconds + GRACE_SECONDS;

    // Grade every question. Unanswered ones count as wrong.
    const results = questions.map((q) => {
      const selectedIndex = chosen.get(q.id) ?? null;
      return {
        questionId: q.id,
        sortOrder: q.sortOrder,
        question: q.question,
        options: q.options,
        selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect: selectedIndex === q.correctIndex,
        explanation: q.explanation,
        topic: q.topic,
      };
    });
    const score = results.filter((r) => r.isCorrect).length;

    await saveSubmission({ attemptId: attempt.id, results, score, timedOut });

    res.json({
      attempt: {
        id: attempt.id,
        quizId: attempt.quizId,
        mode: attempt.mode,
        score,
        totalQuestions: questions.length,
        percentage: percent(score, questions.length),
        timedOut,
      },
      topics: topicBreakdown(results),
      results,
    });
  } catch (err) {
    if (err.code === "ALREADY_SUBMITTED") {
      return res.status(409).json({ message: "This attempt was already submitted" });
    }
    next(err);
  }
}

// GET /api/attempts/:id  (review a finished attempt)
export async function getAttempt(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid attempt id" });

    const attempt = await findAttempt(id.data, req.user.id);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    // Answers stay hidden until the attempt is submitted
    if (attempt.status !== "submitted") {
      return res.status(409).json({ message: "Submit the attempt to see the results" });
    }

    const results = await getAttemptResults(attempt.id);
    res.json({
      attempt: attemptSummary(attempt),
      topics: topicBreakdown(results),
      results,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/attempts?quizId=1
export async function listAttempts(req, res, next) {
  try {
    const quizId = req.query.quizId ? idSchema.safeParse(req.query.quizId) : null;
    if (quizId && !quizId.success) {
      return res.status(400).json({ message: "Invalid quizId" });
    }

    const rows = await listAttemptsByUser(req.user.id, quizId?.data);
    const attempts = rows.map((a) => ({
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quizTitle,
      mode: a.mode,
      status: a.status,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.score == null ? null : percent(a.score, a.totalQuestions),
      timedOut: Boolean(a.timedOut),
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
    }));

    res.json({ attempts });
  } catch (err) {
    next(err);
  }
}