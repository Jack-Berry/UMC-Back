// src/routes/matchesRoutes.js
const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const {
  getMatches,
  searchMatchesByTag,
  getMatchToken,
} = require("../controllers/matchesController");

const router = express.Router();

// 🔒 Protect all routes in this file
router.use(authenticateToken);

// Suggested matches
router.get("/", getMatches);

// Search by tag
router.get("/search", searchMatchesByTag);

// Match token
router.get("/token", getMatchToken);

module.exports = router;
