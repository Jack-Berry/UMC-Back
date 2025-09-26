// src/utils/matchToken.js
const jwt = require("jsonwebtoken");

const MATCH_SECRET = process.env.MATCH_SECRET || "supersecret"; // keep this safe

function generateMatchToken(userA, userB) {
  const payload = { userA, userB };
  return jwt.sign(payload, MATCH_SECRET, { expiresIn: "5m" }); // short expiry
}

function verifyMatchToken(token, requesterId, peerId) {
  try {
    const decoded = jwt.verify(token, MATCH_SECRET);
    // Ensure the token matches this exact pair of users
    const { userA, userB } = decoded;
    const pair = [String(userA), String(userB)].sort().join("-");
    const expected = [String(requesterId), String(peerId)].sort().join("-");
    return pair === expected;
  } catch (err) {
    return false;
  }
}

module.exports = { generateMatchToken, verifyMatchToken };
