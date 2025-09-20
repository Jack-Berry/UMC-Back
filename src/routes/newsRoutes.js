// src/routes/newsRoutes.js
const express = require("express");
const router = express.Router();
const { getAllNews, getNewsById } = require("../controllers/newsController");

// ✅ Public feed routes
router.get("/", getAllNews);
router.get("/:id", getNewsById);

module.exports = router;
