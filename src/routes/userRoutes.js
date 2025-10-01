// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticateToken = require("../middleware/authMiddleware");

// Presence (must be before "/:id")
router.get("/online", authenticateToken, userController.getOnlineUsers);
router.get("/presence", authenticateToken, userController.getPresence);

// 🔹 Avatar upload (no :id param now, always current user)
router.patch(
  "/profile/avatar",
  authenticateToken,
  userController.upload,
  userController.uploadAvatar
);

// 🔹 Profile update (no :id param, always current user)
router.patch("/profile", authenticateToken, userController.updateProfile);

// Search users
router.get("/search", authenticateToken, userController.searchUsers);

// Get user by ID
router.get("/:id", authenticateToken, userController.getUserById);

module.exports = router;
