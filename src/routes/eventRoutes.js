const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const authenticateToken = require("../middleware/authMiddleware");

// Public
router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);

// Protected
router.post("/", authenticateToken, eventController.createEvent);
router.put("/:id", authenticateToken, eventController.updateEvent);
router.delete("/:id", authenticateToken, eventController.deleteEvent);

router.post(
  "/:id/register",
  authenticateToken,
  eventController.registerInterest
);
router.delete(
  "/:id/unregister",
  authenticateToken,
  eventController.unregisterInterest
);

router.get("/user/:id", authenticateToken, eventController.getUserEvents);

module.exports = router;
