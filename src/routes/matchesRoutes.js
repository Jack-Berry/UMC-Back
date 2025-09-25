const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const {
  getMatches,
  searchMatchesByTag,
} = require("../controllers/matchesController");

const router = express.Router();

router.use(authenticateToken);

// Suggested matches
router.get("/", getMatches);

// Search by tag
router.get("/search", searchMatchesByTag);

module.exports = router;
