// src/routes/adminNews.js
const express = require("express");
const router = express.Router();
const {
  createNews,
  updateNews,
  deleteNews,
  uploadImage,
  linkPreview,
} = require("../controllers/newsController");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const noCache = require("../middleware/noCache");
const upload = require("../middleware/upload");

// 🔒 All admin routes protected
router.use(authenticateToken, requireAdmin, noCache);

// ✅ Upload image
router.post("/upload", upload.single("image"), uploadImage);

// ✅ Create news
router.post("/", createNews);

// ✅ Update news
router.put("/:id", updateNews);

// ✅ Delete news
router.delete("/:id", deleteNews);

// ✅ Link preview
router.post("/link-preview", linkPreview);

module.exports = router;
