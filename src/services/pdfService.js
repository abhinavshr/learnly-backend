import pdf from "pdf-parse/lib/pdf-parse.js";

function cleanText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Same as pdf-parse's default renderer, but also records each page
function makePageRenderer(pages) {
  return async (pageData) => {
    const content = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });

    let lastY;
    let text = "";
    for (const item of content.items) {
      if (lastY === undefined || lastY === item.transform[5]) {
        text += item.str;
      } else {
        text += "\n" + item.str;
      }
      lastY = item.transform[5];
    }

    pages.push(cleanText(text));
    return text;
  };
}

export async function extractPdfText(buffer) {
  if (buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Not a valid PDF");
  }

  const pages = [];
  const data = await pdf(buffer, { pagerender: makePageRenderer(pages) });

  return {
    text: cleanText(data.text),
    pageCount: data.numpages,
    pages, // pages[0] is page 1
  };
}