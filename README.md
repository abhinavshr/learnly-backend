# Learnly — AI Study Assistant (Backend)

An AI-powered backend that turns any PDF into an interactive study companion. Upload a document and get Q&A, beginner-friendly explanations, quizzes, flashcards, summaries, weak-topic tracking, and personalized study plans — all grounded in the content you uploaded.

## Features

- **Authentication** — register, login, JWT-protected routes
- **Document upload** — PDF text extraction and chunking
- **Ask questions** — RAG-based Q&A grounded in your document, with page citations
- **Teach me like a beginner** — topic explanations at beginner / intermediate / advanced levels
- **Summaries** — short, medium, or detailed, for the whole document or one topic (cached)
- **MCQ quizzes** — auto-generated, tagged by topic, adjustable difficulty and count
- **Practice & exam mode** — timed or untimed attempts, graded server-side
- **Weak-topic tracking** — accuracy per topic across all attempts, with a one-click "quiz my weak topics"
- **Flashcards** — AI-generated, with SM-2 spaced repetition scheduling
- **Study plans** — day-by-day schedule built from your documents, weak topics, and exam date

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES modules) |
| Framework | Express |
| Database | MySQL (raw SQL via `mysql2`, no ORM) |
| Auth | JWT + bcrypt |
| PDF parsing | `pdf-parse` |
| File upload | `multer` |
| Validation | `zod` |
| AI (chat) | Any OpenAI-compatible endpoint (Gemini, Groq, OpenRouter, Ollama) |
| AI (embeddings) | Gemini embeddings (`gemini-embedding-001`) |

## Project Structure

learnly-backend/
├── server.js
├── sql/ # numbered migration scripts (run manually in Workbench)
│ ├── 001_init.sql
│ ├── 002_chunks.sql
│ ├── 003_quiz.sql
│ ├── 004_attempts.sql
│ ├── 005_summary.sql
│ ├── 006_flashcards.sql
│ └── 007_study_plans.sql
├── src/
│ ├── config/db.js # MySQL connection pool
│ ├── models/ # raw SQL queries only
│ ├── services/ # business logic (chunking, retrieval, AI calls, SRS, planning)
│ ├── prompts/ # system prompt builders per feature
│ ├── controllers/ # request validation + response shaping
│ ├── middleware/ # auth (JWT), file upload
│ ├── routes/ # one file per resource
│ └── utils/ # AppError, shared helpers
└── .env # not committed


## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

In MySQL Workbench:

```sql
CREATE DATABASE studymate_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Then run every file in `sql/`, in order, against `studymate_dev`.

### 3. Configure environment variables

Create a `.env` file in the project root:

```dotenv
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=studymate_dev

# Auth
JWT_SECRET=replace_with_a_long_random_string

# LLM (chat) — any OpenAI-compatible provider
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_API_KEY=your_key_here
LLM_MODEL=your_model_name
LLM_FALLBACK_MODEL=optional_second_model_name

# Embeddings
EMBEDDING_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBEDDING_API_KEY=your_key_here
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768

# CORS
CORS_ORIGIN=http://localhost:5173
```

Never commit `.env`. Rotate any key that is ever exposed.

### 4. Run the server

```bash
npm run server
```

You should see:

MySQL connected
Learnly Backend running on port 5000


## API Overview

All protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | Current user |

### Documents
| Method | Route | Description |
|---|---|---|
| POST | `/api/documents` | Upload a PDF (`multipart/form-data`, field `file`) |
| GET | `/api/documents` | List my documents |
| GET | `/api/documents/:id` | Get one document |
| DELETE | `/api/documents/:id` | Delete a document |

### AI Study Features (per document)
| Method | Route | Description |
|---|---|---|
| POST | `/api/documents/:id/ask` | Ask a question, grounded in the document |
| POST | `/api/documents/:id/explain` | Explain a topic (`beginner` / `intermediate` / `advanced`) |
| POST | `/api/documents/:id/summary` | Generate/fetch a summary (`short` / `medium` / `detailed`) |
| GET | `/api/documents/:id/summary` | Read a saved summary, no AI call |
| POST | `/api/documents/:id/quiz` | Generate an MCQ quiz |
| POST | `/api/documents/:id/quiz/weak` | Generate a quiz from this document's weak topics |
| POST | `/api/documents/:id/flashcards` | Generate flashcards |
| GET | `/api/documents/:id/flashcards` | List a document's flashcards |

### Quizzes & Attempts
| Method | Route | Description |
|---|---|---|
| GET | `/api/quizzes` | List my quizzes |
| GET | `/api/quizzes/:id` | Get a quiz (`?withAnswers=true` to include answers) |
| DELETE | `/api/quizzes/:id` | Delete a quiz |
| POST | `/api/quizzes/:id/attempts` | Start an attempt (`practice` or `exam` mode) |
| POST | `/api/attempts/:id/submit` | Submit answers, get graded |
| GET | `/api/attempts/:id` | Review a submitted attempt |
| GET | `/api/attempts` | Attempt history |

### Analytics
| Method | Route | Description |
|---|---|---|
| GET | `/api/analytics/topics` | Accuracy per topic across all attempts |
| GET | `/api/analytics/weak-topics` | Only topics below the accuracy threshold |

### Flashcards
| Method | Route | Description |
|---|---|---|
| GET | `/api/flashcards/due` | Cards due for review today |
| POST | `/api/flashcards/:id/review` | Record a review (`quality`: 0 forgot – 3 easy) and reschedule |
| DELETE | `/api/flashcards/:id` | Delete a card |

### Study Plans
| Method | Route | Description |
|---|---|---|
| POST | `/api/study-plans` | Generate a day-by-day plan |
| GET | `/api/study-plans` | List my plans |
| GET | `/api/study-plans/:id` | Get one plan with its days |
| PATCH | `/api/study-plans/:id/days/:dayIndex` | Mark a day done/not done |
| DELETE | `/api/study-plans/:id` | Delete a plan |

## Design Notes

- **Raw SQL, no ORM.** Every query lives in `models/`; controllers and services never touch `pool` directly.
- **AI calls are isolated in `services/aiService.js`.** Provider, model, and retry/fallback logic live in one place, so swapping providers means editing `.env`, not the codebase.
- **JSON output from the AI is always validated with `zod`** (quizzes, flashcards) before it's saved, with one retry on invalid output.
- **Retrieval (RAG)** embeds each document's chunks once and reuses them; cosine similarity is computed in Node, which is fine at this document scale.
- **Study plan scheduling is deterministic code, not AI.** Only the day's motivational "focus" sentence is AI-generated, and it falls back to a plain sentence if the AI is unavailable — the plan never fails because of the AI.
- **Every resource is scoped by `userId`** in its SQL query. A request for another user's data returns 404, not 403, so IDs can't be enumerated.

## Known Limitations

- Scanned/image-only PDFs are not supported (no OCR yet).
- Free-tier LLM/embedding providers can rate-limit or intermittently 503; the service retries automatically but can still fail under sustained load.
- Chunk page numbers reflect the page a chunk *starts* on; a chunk spanning two pages may cite the earlier page.
- No refresh tokens yet — JWTs expire after 7 days and require a fresh login.

## Roadmap / Not Yet Done

- [ ] Streaming responses (SSE) for `/ask` and `/explain`
- [ ] Automated tests (`vitest` + `supertest`)
- [ ] OCR support for scanned PDFs
- [ ] React frontend

## License

Private project — not licensed for reuse.
