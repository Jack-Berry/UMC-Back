const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const messageController = require("../controllers/messageController");

router.use(authenticateToken);

router.post("/threads", messageController.getOrCreateConversation);
router.post("/threads/:id/messages", messageController.sendMessage);
router.get("/threads/:id/messages", messageController.listMessages);

module.exports = router;
