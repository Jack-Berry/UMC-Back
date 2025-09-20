const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticateToken = require("../middleware/authMiddleware");

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

module.exports = router;
