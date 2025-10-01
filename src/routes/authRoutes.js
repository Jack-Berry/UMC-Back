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
  checkDisplayName, // ✅ import from authController now
} = require("../controllers/authController");

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// ✅ check displayname route now works
router.get("/check-displayname", checkDisplayName);

// public verification endpoints
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Protected example route
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

// Fetch user by ID
router.get("/user/:id", fetchUserByID);

module.exports = router;
