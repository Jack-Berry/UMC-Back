// src/routes/tagsRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
} = require("../controllers/tagsController");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

// ---------- Public ----------
router.get("/", getAllTags);

// ---------- Admin-only CRUD ----------
router.post("/", authenticateToken, requireAdmin, createTag);
router.put("/:id", authenticateToken, requireAdmin, updateTag);
router.delete("/:id", authenticateToken, requireAdmin, deleteTag);

module.exports = router;
