// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  updateProfile,
  updateAvatar,
} = require("../controllers/userController");
const authenticateToken = require("../middleware/authMiddleware");
const noCache = require("../middleware/noCache");

// ✅ Update profile
router.put("/:id", authenticateToken, noCache, updateProfile);

// ✅ Update avatar
router.post("/:id/avatar", authenticateToken, noCache, updateAvatar);

module.exports = router;
