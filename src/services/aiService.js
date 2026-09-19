// One generic function that works with Groq, Gemini, OpenRouter and Ollama
export async function chat({ system, user, maxTokens = 1000, temperature = 0.2 }) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
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

const QA_SYSTEM_PROMPT = `You are a study tutor. Answer the student's question using ONLY the provided context from their study material.
- If the context does not contain the answer, say: "I couldn't find this in your document."
- Explain clearly and simply. Do not invent facts.
- Mention page numbers when helpful, like (page 4).`;

export async function answerFromContext(question, chunks) {
  const context = chunks
    .map((c, i) => `[Source ${i + 1} | page ${c.pageNumber}]\n${c.text}`)
    .join("\n\n");

  return chat({
    system: QA_SYSTEM_PROMPT,
    user: `<context>\n${context}\n</context>\n\nQuestion: ${question}`,
  });
}

// Turns provider errors into safe messages for the frontend
export function toAiError(err) {
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