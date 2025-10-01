// src/routes/authRoutes.js
const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const router = express.Router();

const {
  register,
  login,
  refresh,
  fetchUserByID,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");

const userController = require("../controllers/userController");

// --- Routes ---
router.post("/register", register);

// ✅ Added display name availability check
router.get("/check-displayname", userController.checkDisplayName);

router.post("/login", login);
router.post("/refresh", refresh);

// public verification endpoints
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

router.get("/user/:id", fetchUserByID);

module.exports = router;
