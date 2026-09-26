import { z } from "zod";
import { generateFlashcardText } from "./aiService.js";

const cardSchema = z.object({
  front: z.string().trim().min(3).max(300),
  back: z.string().trim().min(3).max(600),
  topic: z.string().trim().min(2).max(100),
});

const cardsSchema = z.object({ cards: z.array(cardSchema).min(1) });

function parseJson(text) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function generateCards({ chunks, count, topic, topics }) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await generateFlashcardText({ chunks, count, topic, topics });
      const parsed = cardsSchema.parse(parseJson(raw));
      return parsed.cards.slice(0, count);
    } catch (err) {
      if (err?.status) throw err; // provider error, not a JSON problem
      console.warn(`Flashcard JSON invalid (attempt ${attempt}/2): ${err.message}`);
    }
  }

  const error = new Error("Model returned invalid flashcard JSON");
  error.code = "INVALID_FLASHCARD_JSON";
  throw error;
}