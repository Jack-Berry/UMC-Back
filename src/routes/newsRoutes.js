const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");

// ---------- Public routes ----------

// Get paginated list of news
router.get("/", newsController.getAllNews);

// Get single news item by ID
router.get("/:id", newsController.getNewsById);

module.exports = router;
