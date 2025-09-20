const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const authenticateToken = require("../middleware/authMiddleware");

// Protected routes
router.post("/:id/request", authenticateToken, friendController.sendRequest);
router.post("/:id/accept", authenticateToken, friendController.acceptRequest);
router.post("/:id/decline", authenticateToken, friendController.declineRequest);
router.delete("/:id/remove", authenticateToken, friendController.removeFriend);
router.get("/", authenticateToken, friendController.getFriends);
router.get("/pending", authenticateToken, friendController.getPending);

module.exports = router;
