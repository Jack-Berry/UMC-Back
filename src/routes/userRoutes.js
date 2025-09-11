const express = require("express");
const router = express.Router();
const {
  updateAvatar,
  updateProfile,
} = require("../controllers/userController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.put("/:id/avatar", authenticateToken, updateAvatar);
router.put("/:id", authenticateToken, updateProfile); // 👈 new

module.exports = router;
