// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.sendStatus(401); // expired
      }
      return res.sendStatus(403); // invalid
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
