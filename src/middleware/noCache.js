// src/middleware/noCache.js
module.exports = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};
