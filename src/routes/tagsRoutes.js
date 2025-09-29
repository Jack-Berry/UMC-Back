// src/routes/tags.js
const express = require("express");
const {
  getTags,
  createTag,
  updateTag,
  deleteTag,
} = require("../controllers/tagsController");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

// Public: GET /api/tags
router.get("/", getTags);

// Admin-only: CRUD
router.post("/", authenticateToken, requireAdmin, createTag);
router.put("/:id", authenticateToken, requireAdmin, updateTag);
router.delete("/:id", authenticateToken, requireAdmin, deleteTag);

module.exports = router;
