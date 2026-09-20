import { extractNotes, summarizeContext } from "./aiService.js";

const SINGLE_CALL_MAX_CHARS = 24000; // about 6k tokens: one AI call is enough
const GROUP_MAX_CHARS = 20000;       // size of each part for long documents
const MAX_GROUPS = 8;                // protects free-tier rate limits

const format = (c) => `[page ${c.pageNumber}]\n${c.text}`;

function groupChunks(chunks) {
  const groups = [];
  let current = [];
  let size = 0;

  for (const chunk of chunks) {
    const piece = format(chunk);
    if (size + piece.length > GROUP_MAX_CHARS && current.length) {
      groups.push(current.join("\n\n"));
      current = [];
      size = 0;
    }
    current.push(piece);
    size += piece.length;
  }
  if (current.length) groups.push(current.join("\n\n"));
  return groups;
}

export async function summarizeDocument(chunks, length) {
  const fullText = chunks.map(format).join("\n\n");

  // Small document: one call
  if (fullText.length <= SINGLE_CALL_MAX_CHARS) {
    return summarizeContext(fullText, length);
  }

  // Long document: condense each part, then combine the notes
  const groups = groupChunks(chunks);
  if (groups.length > MAX_GROUPS) {
    const err = new Error("Document too large to summarize in one go");
    err.code = "DOCUMENT_TOO_LARGE";
    throw err;
  }

  const notes = [];
  for (const [i, group] of groups.entries()) {
    notes.push(`Part ${i + 1}:\n${await extractNotes(group)}`); // one after another, gentle on rate limits
  }

  return summarizeContext(notes.join("\n\n"), length, { fromNotes: true });
}

export async function summarizeTopic(chunks, length) {
  return summarizeContext(chunks.map(format).join("\n\n"), length);
}