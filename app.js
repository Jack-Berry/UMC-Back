const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const rateLimit = require("express-rate-limit");

// Routes & middleware
const authRoutes = require("./src/routes/authRoutes");
const assessmentRoutes = require("./src/routes/assessment");
const userRoutes = require("./src/routes/userRoutes");
const adminAssessmentRouter = require("./src/routes/adminAssessment");
const eventRoutes = require("./src/routes/eventRoutes");
const newsRoutes = require("./src/routes/newsRoutes");
const adminNewsRouter = require("./src/routes/adminNews");

const { pool, checkConnection } = require("./src/db");
const authenticateToken = require("./src/middleware/authMiddleware");
const requireAdmin = require("./src/middleware/requireAdmin");

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// ✅ Rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500,
  message: "Too many requests, please try again later.",
});

// ✅ CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://uselessmen.org",
    "https://www.uselessmen.org",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ✅ Security
app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ✅ Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ✅ Apply limiter to all API routes
app.use("/api/", apiLimiter);

// ✅ Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/news", newsRoutes);

app.use(
  "/api/admin/assessment",
  authenticateToken,
  requireAdmin,
  adminAssessmentRouter
);

app.use("/api/admin/news", authenticateToken, requireAdmin, adminNewsRouter);

// ---------- Status check ----------
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

// ---------- Demo fallback ----------
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
