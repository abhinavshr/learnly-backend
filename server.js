import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { testConnection } from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
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

// 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
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