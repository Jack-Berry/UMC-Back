// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticateToken = require("../middleware/authMiddleware");

// Presence (must be before "/:id")
router.get("/online", authenticateToken, userController.getOnlineUsers);
router.get("/presence", authenticateToken, userController.getPresence);

// Avatar upload (with multer middleware)
router.put(
  "/:id/avatar",
  authenticateToken,
  userController.upload,
  userController.uploadAvatar
);

// Profile update
router.put("/:id", authenticateToken, userController.updateProfile);

// Search users
router.get("/search", authenticateToken, userController.searchUsers);

// Get user by ID
router.get("/:id", authenticateToken, userController.getUserById);

module.exports = router;
