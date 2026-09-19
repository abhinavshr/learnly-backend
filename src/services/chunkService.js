const CHUNK_SIZE = 2500; // characters (roughly 600 tokens)
const OVERLAP = 300;     // shared text between neighbouring chunks

export function chunkPages(pages) {
  // 1. Break every page into sentence-sized pieces, remembering the page number
  const pieces = [];
  pages.forEach((pageText, i) => {
    const clean = pageText.replace(/\s+/g, " ").trim();
    if (!clean) return;

    const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [clean];
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      // Very long "sentences" (tables, code) are cut so no piece exceeds a chunk
      for (let start = 0; start < s.length; start += CHUNK_SIZE) {
        pieces.push({ text: s.slice(start, start + CHUNK_SIZE) + " ", page: i + 1 });
      }
    }
  });

  // 2. Group pieces into chunks, carrying a little overlap into the next one
  const chunks = [];
  let current = [];
  let length = 0;

  const pushChunk = () => {
    chunks.push({
      text: current.map((p) => p.text).join("").trim(),
      pageNumber: current[0].page,
    });
  };

  for (const piece of pieces) {
    if (length + piece.text.length > CHUNK_SIZE && current.length) {
      pushChunk();

      const keep = [];
      let keepLength = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        if (keepLength + current[i].text.length > OVERLAP) break;
        keep.unshift(current[i]);
        keepLength += current[i].text.length;
      }
      current = keep;
      length = keepLength;
    }
    current.push(piece);
    length += piece.text.length;
  }
  if (current.length) pushChunk();

  return chunks.map((c, index) => ({ ...c, chunkIndex: index }));
}