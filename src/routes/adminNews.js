const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const newsController = require("../controllers/newsController");

// ---------- Admin-only routes ----------

// Upload image
router.post("/upload", upload.single("image"), newsController.uploadNewsImage);

// External link preview (lightweight fetch + jsdom)
router.post("/link-preview", newsController.getLinkPreview);

// Create news post
router.post("/", newsController.createNews);

// Update news post
router.put("/:id", newsController.updateNews);

// Delete news post
router.delete("/:id", newsController.deleteNews);

module.exports = router;
