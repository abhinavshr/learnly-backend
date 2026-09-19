import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Learnly Backend API is running",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Learnly Backend running on port ${PORT}`);
});