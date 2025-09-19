const express = require("express");
const router = express.Router();
const {
  uploadAvatar,
  updateProfile,
  upload,
} = require("../controllers/userController");
const authenticateToken = require("../middleware/authMiddleware");

// Avatar upload (with multer middleware)
router.put("/:id/avatar", authenticateToken, upload, uploadAvatar);

// Profile update
router.put("/:id", authenticateToken, updateProfile);

module.exports = router;
