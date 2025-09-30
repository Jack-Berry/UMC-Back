// routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");

const messageController = require("../controllers/messageController");

router.use(authenticateToken);

router.post("/threads", messageController.getOrCreateConversation);
router.post("/threads/:id/messages", messageController.sendMessage);
router.get("/threads/:id/messages", messageController.listMessages);
router.get("/threads", messageController.listThreads);

// 🔹 Mark messages as read
router.put("/threads/:id/read", messageController.markRead);

module.exports = router;
