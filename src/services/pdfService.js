import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractPdfText(buffer) {
  // Real PDFs start with "%PDF-", which stops renamed files
  if (buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Not a valid PDF");
  }

  const data = await pdf(buffer);

  const text = data.text
    .replace(/\u0000/g, "")      // strip null characters
    .replace(/[ \t]+\n/g, "\n")  // trailing spaces
    .replace(/\n{3,}/g, "\n\n")  // collapse blank lines
    .trim();

  return { text, pageCount: data.numpages };
}