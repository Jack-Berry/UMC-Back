const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./src/routes/authRoutes");
const assessmentRoutes = require("./src/routes/assessment");
const { pool, checkConnection } = require("./src/db"); // ✅ changed

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

// 🔹 Live DB status check
app.get("/api/status", async (req, res) => {
  const dbOk = await checkConnection();

  res.json({
    status: "ok",
    db: dbOk ? "connected" : "disconnected",
    message: dbOk
      ? "API and DB are both live"
      : "API is live, DB not connected – showing mock data",
  });
});

// 🔹 Example route with fallback
app.get("/api/demo-assessment", async (req, res) => {
  const dbOk = await checkConnection();

  if (!dbOk) {
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
