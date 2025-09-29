// src/routes/tagsRoutes.js
const express = require("express");
const router = express.Router();
const {
  getTags, // ✅ correct name
  createTag,
  updateTag,
  deleteTag,
} = require("../controllers/tagsController");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

// ---------- Public ----------
router.get("/", getTags);

// ---------- Admin-only CRUD ----------
router.post("/", authenticateToken, requireAdmin, createTag);
router.put("/:id", authenticateToken, requireAdmin, updateTag);
router.delete("/:id", authenticateToken, requireAdmin, deleteTag);

module.exports = router;
