const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = process.env.VOYAGE_MODEL || "voyage-3.5-lite";
const BATCH_SIZE = 64;

async function embedBatch(texts, inputType) {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

// For chunks of the document
export async function embedDocuments(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    vectors.push(...(await embedBatch(batch, "document")));
  }
  return vectors;
}

// For the student's question
export async function embedQuery(text) {
  const [vector] = await embedBatch([text], "query");
  return vector;
}