const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const authenticateToken = require("../middleware/authMiddleware");

// Public
router.get("/", eventController.getEvents);

// Protected
router.post("/", authenticateToken, eventController.createEvent);
router.post(
  "/:id/register",
  authenticateToken,
  eventController.registerInterest
);
router.get("/user/:id", authenticateToken, eventController.getUserEvents);

module.exports = router;
