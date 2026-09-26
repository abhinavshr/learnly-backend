import { z } from "zod";
import { listDocumentsByUser, findDocumentById } from "../models/documentModel.js";
import { computeTopicStats } from "../services/analyticsService.js";
import { buildSchedule } from "../services/planService.js";
import { generateDayFocusLines } from "../services/aiService.js";
import {
  createPlan,
  listPlansByUser,
  findPlan,
  getPlanDays,
  setDayDone,
  deletePlan,
} from "../models/planModel.js";

const idSchema = z.coerce.number().int().positive();

function zodError(res, error) {
  return res.status(400).json({
    message: "Validation failed",
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });
}

const generateSchema = z.object({
  title: z.string().trim().min(2).max(255).optional(),
  examDate: z.coerce.date(),
  hoursPerDay: z.coerce.number().min(0.5).max(12),
  documentIds: z.array(z.coerce.number().int().positive()).min(1).max(20).optional(),
});

// POST /api/study-plans
export async function generatePlan(req, res, next) {
  try {
    const body = generateSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const { title, examDate, hoursPerDay, documentIds } = body.data;

    // Default to every ready document the student has
    let documents;
    if (documentIds) {
      documents = [];
      for (const id of documentIds) {
        const doc = await findDocumentById(id, req.user.id);
        if (!doc) return res.status(404).json({ message: `Document ${id} not found` });
        if (doc.status !== "READY") {
          return res.status(409).json({ message: `Document ${id} is not ready yet` });
        }
        documents.push(doc);
      }
    } else {
      documents = (await listDocumentsByUser(req.user.id)).filter((d) => d.status === "READY");
    }

    if (documents.length === 0) {
      return res.status(409).json({ message: "No ready documents to build a plan from" });
    }

    // Weakest topics across the chosen documents, capped so the schedule doesn't overload
    const allowed = new Set(documents.map((d) => d.id));
    const stats = await computeTopicStats(req.user.id, {});
    const weakTopics = stats
      .filter((t) => t.isWeak && allowed.has(t.documentId))
      .slice(0, 10)
      .map((t) => ({ documentId: t.documentId, topic: t.topic }));

    let days;
    try {
      days = buildSchedule({
        documents: documents.map((d) => ({ id: d.id, title: d.title })),
        weakTopics,
        examDate,
        hoursPerDay,
      });
    } catch (err) {
      if (err.code === "INVALID_EXAM_DATE") {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }

    const focusLines = await generateDayFocusLines(days);
    days.forEach((d, i) => {
      d.focus = focusLines[i];
    });

    const planTitle = (title || `Study plan for ${documents.map((d) => d.title).join(", ")}`).slice(0, 255);
    const planId = await createPlan({
      userId: req.user.id,
      title: planTitle,
      examDate,
      hoursPerDay,
      days,
    });

    res.status(201).json({
      plan: { id: planId, title: planTitle, examDate, hoursPerDay, totalDays: days.length },
      days,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/study-plans
export async function listPlans(req, res, next) {
  try {
    const plans = await listPlansByUser(req.user.id);
    res.json({ plans });
  } catch (err) {
    next(err);
  }
}

// GET /api/study-plans/:id
export async function getPlan(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid plan id" });

    const plan = await findPlan(id.data, req.user.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const days = await getPlanDays(plan.id);
    res.json({ plan, days });
  } catch (err) {
    next(err);
  }
}

const dayUpdateSchema = z.object({ isDone: z.boolean() });

// PATCH /api/study-plans/:id/days/:dayIndex
export async function updatePlanDay(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    const dayIndex = idSchema.safeParse(req.params.dayIndex);
    if (!id.success || !dayIndex.success) {
      return res.status(400).json({ message: "Invalid plan or day id" });
    }

    const body = dayUpdateSchema.safeParse(req.body ?? {});
    if (!body.success) return zodError(res, body.error);

    const plan = await findPlan(id.data, req.user.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const updated = await setDayDone(plan.id, dayIndex.data, body.data.isDone);
    if (!updated) return res.status(404).json({ message: "Day not found in this plan" });

    res.json({ message: "Day updated" });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/study-plans/:id
export async function removePlan(req, res, next) {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Invalid plan id" });

    const deleted = await deletePlan(id.data, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Plan not found" });

    res.json({ message: "Plan deleted" });
  } catch (err) {
    next(err);
  }
}