// src/routes/tags.js
const express = require("express");
const { getTags } = require("../controllers/tagsController");

const router = express.Router();

// Public: GET /api/tags
router.get("/", getTags);

module.exports = router;
