const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const newsController = require("../controllers/newsController");

// Admin-only
router.post("/link-preview", newsController.getLinkPreview);
router.post("/", newsController.createNews);
router.put("/:id", newsController.updateNews);
router.delete("/:id", newsController.deleteNews);

module.exports = router;
