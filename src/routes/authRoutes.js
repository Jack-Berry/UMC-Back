// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const {
  register,
  login,
  refresh,
  getUserById,
} = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");
const noCache = require("../middleware/noCache");

// ✅ Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// ✅ Protected routes
router.get("/profile", authenticateToken, noCache, (req, res) => {
  res.json(req.user);
});

// 🚨 Originally public, now protected
router.get("/user/:id", authenticateToken, noCache, getUserById);

module.exports = router;
