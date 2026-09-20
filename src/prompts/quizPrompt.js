const DIFFICULTY = {
  easy: "Ask direct recall questions about definitions and basic facts stated in the context.",
  medium: "Ask questions that need understanding of how ideas connect, not just word matching.",
  hard: "Ask application or comparison questions that need careful reasoning over the context. Make the wrong options tempting.",
};

export function buildQuizSystemPrompt({ count, difficulty }) {
  return `You are an exam writer creating multiple-choice questions from a student's study material.

Write exactly ${count} questions. ${DIFFICULTY[difficulty]}

Rules:
- Use ONLY facts stated in the provided context. Never use outside knowledge.
- Each question has exactly 4 options and exactly one correct answer.
- Wrong options must be plausible but clearly wrong according to the context.
- Do not use "all of the above" or "none of the above".
- Vary which option is correct. Do not always put it first.
- Every question must make sense on its own. Do not write "according to the text" or "in the passage".
- "explanation" is 1 or 2 sentences saying why the correct answer is right.
- "topic" is a short label of 1 to 4 words (for example "Payments" or "Order statuses"). Use the same label for questions about the same subject.

Return ONLY valid JSON with no markdown fences and no extra text, in exactly this shape:
{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","topic":"..."}]}

"correctIndex" is the position of the correct option in "options", from 0 to 3.`;
}