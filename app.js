const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./src/routes/authRoutes");
const assessmentRoutes = require("./src/routes/assessment");
const { pool, isConnected } = require("./db"); // 👈 import the DB wrapper we updated

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "https://uselessmen.org",
      "https://www.uselessmen.org",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);
app.use(express.json());

// 🔹 Add a status route for demo/testing
app.get("/api/status", (req, res) => {
  if (!isConnected) {
    return res.json({
      status: "ok",
      db: "disconnected",
      message: "API is live, DB not connected – showing mock data",
    });
  }

  res.json({
    status: "ok",
    db: "connected",
    message: "API and DB are both live",
  });
});

// 🔹 Example mock fallback route for assessment
app.get("/api/demo-assessment", async (req, res) => {
  if (!isConnected) {
    return res.json({
      status: "ok",
      source: "mock",
      assessments: [
        { id: 1, category: "DIY", score: 3 },
        { id: 2, category: "Technology", score: 4 },
      ],
    });
  }

  try {
    const result = await pool.query("SELECT * FROM assessments");
    res.json({ status: "ok", source: "db", assessments: result.rows });
  } catch (err) {
    console.error("DB query error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Existing routes
app.use("/api/auth", authRoutes);
app.use("/api/assessment", assessmentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
