import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";

import { testConnection } from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import documentRoutes from "./src/routes/documentRoutes.js";
import quizRoutes from "./src/routes/quizRoutes.js";
import attemptRoutes from "./src/routes/attemptRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import flashcardRoutes from "./src/routes/flashcardRoutes.js";
import planRoutes from "./src/routes/planRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// Allowed frontend origins (comma-separated in .env for multiple environments)
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim());

// Middleware
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // origin is undefined for same-origin tools like curl/Postman; allow those
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // required so the browser sends/receives the httpOnly auth cookie
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(morgan("dev"));

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Learnly Backend API is running",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/study-plans", planRoutes);

// 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});

// Start server only after the database is reachable
async function start() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`Learnly Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to MySQL:", err.message);
    process.exit(1);
  }
}

start();