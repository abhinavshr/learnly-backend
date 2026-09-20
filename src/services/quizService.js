import { z } from "zod";
import { generateQuizText } from "./aiService.js";

const questionSchema = z.object({
  question: z.string().trim().min(10).max(500),
  options: z
    .array(z.string().trim().min(1).max(300))
    .length(4)
    .refine(
      (opts) => new Set(opts.map((o) => o.toLowerCase())).size === 4,
      "Options must all be different"
    ),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(1000),
  topic: z.string().trim().min(2).max(100),
});

const quizSchema = z.object({ questions: z.array(questionSchema).min(1) });

// Models sometimes wrap JSON in ```json fences or add a sentence around it
function parseJson(text) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Picks chunks spread evenly across the whole document
export function sampleEvenly(items, n) {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

export async function generateQuestions({ chunks, count, difficulty, topic }) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await generateQuizText({ chunks, count, difficulty, topic });
      const parsed = quizSchema.parse(parseJson(raw));
      return parsed.questions.slice(0, count);
    } catch (err) {
      // Provider errors (overloaded, rate limit) are not JSON problems
      if (err?.status) throw err;
      console.warn(`Quiz JSON invalid (attempt ${attempt}/2): ${err.message}`);
    }
  }

  const error = new Error("Model returned invalid quiz JSON");
  error.code = "INVALID_QUIZ_JSON";
  throw error;
}