const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");

// Public news feed
router.get("/", newsController.getAllNews);
router.get("/:id", newsController.getNewsById);

module.exports = router;
