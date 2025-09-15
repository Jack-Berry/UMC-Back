const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const router = express.Router();
const {
  register,
  login,
  refresh,
  fetchUserByID,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});
router.get("/user/:id", fetchUserByID);

module.exports = router;
