const express = require("express");
const helmet = require("helmet");
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
  windowMs: 60 * 1000,
  max: 500,
  message: "Too many requests, please try again later.",
});

// ✅ Allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://uselessmen.org",
  "https://www.uselessmen.org",
];

// ✅ Global CORS middleware (fix for preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ✅ Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// ✅ Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ✅ Serve uploads publicly (avatars + news)
app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };
      if (types[ext]) res.setHeader("Content-Type", types[ext]);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// ✅ Apply limiter
app.use("/api/", apiLimiter);

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/news", newsRoutes);

// ---------- Admin routes ----------
app.use("/api/admin/news", authenticateToken, requireAdmin, adminNewsRouter);
app.use(
  "/api/admin/assessment",
  authenticateToken,
  requireAdmin,
  adminAssessmentRouter
);

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
