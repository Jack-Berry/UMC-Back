// src/routes/eventRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getUserEvents,
} = require("../controllers/eventController");
const authenticateToken = require("../middleware/authMiddleware");
const noCache = require("../middleware/noCache");

// ✅ Public event browsing
router.get("/", getAllEvents);
router.get("/:id", getEventById);

// ✅ Protected routes
router.post("/", authenticateToken, noCache, createEvent);
router.put("/:id", authenticateToken, noCache, updateEvent);
router.delete("/:id", authenticateToken, noCache, deleteEvent);
router.post("/:id/register", authenticateToken, noCache, registerForEvent);
router.get("/user/:id", authenticateToken, noCache, getUserEvents);

module.exports = router;
