const LENGTHS = {
  short: `Write a SHORT summary in exactly this format:
A single paragraph of 3 to 4 sentences giving the main idea.

## Key points
3 to 5 bullet points.`,

  medium: `Write a MEDIUM summary in Markdown using exactly these sections:

## Overview
One short paragraph.

## Key points
6 to 10 bullet points covering the most important facts.

## Important terms
Bullets in the form "**term**: meaning".`,

  detailed: `Write a DETAILED summary in Markdown using exactly these sections:

## Overview
One short paragraph.

Then one "### Topic name" section for each major topic, with 3 to 6 bullet points or short paragraphs each.

## Important terms
Bullets in the form "**term**: meaning".

## Things to remember
3 to 6 bullet points a student should memorize.`,
};

export function buildSummarySystemPrompt(length) {
  return `You are a study assistant that writes clear summaries of a student's study material.

${LENGTHS[length]}

Rules:
- Use ONLY information from the provided context. Never add outside facts.
- Use simple, clear language.
- Mention page numbers where useful, like (page 4).
- Do not write an introduction such as "Here is a summary" and do not write a conclusion.`;
}

// Used for very long documents: each part is condensed before the final summary
export const NOTES_SYSTEM_PROMPT = `You take study notes from one part of a longer document.

Write concise bullet-point notes that keep every important fact, definition, number, rule and name.
Keep page references like (page 4).
Use ONLY information from the context. Do not add anything else and do not write an introduction.`;