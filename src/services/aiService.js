import { buildExplainSystemPrompt } from "../prompts/explainPrompt.js";
import { buildQuizSystemPrompt } from "../prompts/quizPrompt.js";
import { buildSummarySystemPrompt, NOTES_SYSTEM_PROMPT } from "../prompts/summaryPrompt.js";
import { buildFlashcardSystemPrompt } from "../prompts/flashcardPrompt.js";
import { PLAN_FOCUS_SYSTEM_PROMPT, describeTasks } from "../prompts/planPrompt.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Core LLM call (works with Gemini, Groq, OpenRouter, Ollama) ----------

async function callLlm(model, { system, user, maxTokens, temperature }) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`LLM error ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Temporary problems worth retrying: overloaded (503) or server errors (500/502/504)
const isTemporary = (err) => [500, 502, 503, 504].includes(err?.status);

export async function chat({ system, user, maxTokens = 1000, temperature = 0.2 }) {
  const options = { system, user, maxTokens, temperature };
  const models = [process.env.LLM_MODEL, process.env.LLM_FALLBACK_MODEL].filter(Boolean);

  let lastError;
  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await callLlm(model, options);
      } catch (err) {
        lastError = err;
        // Wrong key, bad model, rate limit: retrying the same call won't help
        if (!isTemporary(err)) throw err;

        console.warn(`LLM ${model} unavailable (attempt ${attempt}/3)`);
        if (attempt < 3) await sleep(attempt * 2000); // waits 2s, then 4s
      }
    }
  }
  throw lastError;
}

// ---------- Shared helper ----------

function buildContext(chunks) {
  return chunks
    .map((c, i) => `[Source ${i + 1} | page ${c.pageNumber}]\n${c.text}`)
    .join("\n\n");
}

// ---------- Q&A ----------

const QA_SYSTEM_PROMPT = `You are a study tutor. Answer the student's question using ONLY the provided context from their study material.
- If the context does not contain the answer, say: "I couldn't find this in your document."
- Explain clearly and simply. Do not invent facts.
- Mention page numbers when helpful, like (page 4).`;

export async function answerFromContext(question, chunks) {
  return chat({
    system: QA_SYSTEM_PROMPT,
    user: `<context>\n${buildContext(chunks)}\n</context>\n\nQuestion: ${question}`,
  });
}

// ---------- Explain like a beginner ----------

export async function explainFromContext(topic, chunks, level = "beginner") {
  return chat({
    system: buildExplainSystemPrompt(level),
    user: `<context>\n${buildContext(chunks)}\n</context>\n\nTopic to explain: ${topic}`,
    maxTokens: 1500,
    temperature: 0.4,
  });
}

// ---------- Quiz generation ----------

// topic  = one topic chosen by the student
// topics = list of weak topics (exact names are reused so the stats stay consistent)
export async function generateQuizText({ chunks, count, difficulty, topic, topics }) {
  let focus = "Cover the main topics spread across the context.";
  if (topics?.length) {
    focus = `Focus only on these topics: ${topics.join("; ")}. Use exactly these names as the "topic" value of each question.`;
  } else if (topic) {
    focus = `Focus topic: ${topic}`;
  }

  return chat({
    system: buildQuizSystemPrompt({ count, difficulty }),
    user: `<context>\n${buildContext(chunks)}\n</context>\n\n${focus}`,
    maxTokens: 3500,
    temperature: 0.3,
  });
}

export async function generateFlashcardText({ chunks, count, topic, topics }) {
  let focus = "Cover the main topics spread across the context.";
  if (topics?.length) {
    focus = `Focus only on these topics: ${topics.join("; ")}. Use exactly these names as the "topic" value of each card.`;
  } else if (topic) {
    focus = `Focus topic: ${topic}`;
  }

  return chat({
    system: buildFlashcardSystemPrompt(count),
    user: `<context>\n${buildContext(chunks)}\n</context>\n\n${focus}`,
    maxTokens: 3000,
    temperature: 0.3,
  });
}

// ---------- Summary ----------

const SUMMARY_TOKENS = { short: 700, medium: 1500, detailed: 3000 };

export async function summarizeContext(context, length, { fromNotes = false } = {}) {
  const intro = fromNotes
    ? "Below are notes taken from consecutive parts of one document. Combine them into one summary."
    : "Summarize the following study material.";

  return chat({
    system: buildSummarySystemPrompt(length),
    user: `${intro}\n\n<context>\n${context}\n</context>`,
    maxTokens: SUMMARY_TOKENS[length],
    temperature: 0.3,
  });
}

export async function extractNotes(context) {
  return chat({
    system: NOTES_SYSTEM_PROMPT,
    user: `<context>\n${context}\n</context>`,
    maxTokens: 1500,
    temperature: 0.2,
  });
}

// Writes one friendly sentence per day. Falls back to a plain sentence if the AI fails,
// since the schedule itself must never depend on the AI being available.
export async function generateDayFocusLines(days) {
  const fallback = (d) => `Day ${d.dayIndex}: focused study session (${d.tasks.reduce((s, t) => s + t.minutes, 0)} minutes).`;

  try {
    const raw = await chat({
      system: PLAN_FOCUS_SYSTEM_PROMPT,
      user: days.map(describeTasks).join("\n"),
      maxTokens: 1200,
      temperature: 0.5,
    });

    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    const byIndex = new Map(parsed.days.map((d) => [d.dayIndex, d.focus]));

    return days.map((d) => byIndex.get(d.dayIndex) || fallback(d));
  } catch (err) {
    console.warn("Falling back to plain focus lines:", err.message);
    return days.map(fallback);
  }
}

// ---------- Errors ----------

// Turns provider errors into safe messages for the frontend
export function toAiError(err) {
  if (err?.status >= 500) {
    return { status: 503, message: "AI is busy right now, please try again in a moment" };
  }
  if (err?.status === 429) {
    return { status: 429, message: "AI is busy or the free limit was reached, try again later" };
  }
  if (err?.status === 401 || err?.status === 403) {
    return { status: 503, message: "AI service is not configured correctly" };
  }
  if (err?.status === 404 || err?.status === 400) {
    return { status: 503, message: "AI model is unavailable" };
  }
  if (err?.cause?.code === "ECONNREFUSED") {
    return { status: 503, message: "AI service is not running" };
  }
  return null;
}