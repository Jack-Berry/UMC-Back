const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware"); // ✅ destructure here
const router = express.Router();
const {
  register,
  login,
  fetchUserByID,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});
router.get("/user/:id", fetchUserByID);

module.exports = router;
