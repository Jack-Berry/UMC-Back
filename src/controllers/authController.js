// src/controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");

// -------------------
// Helpers
// -------------------
function signAccess(user) {
  return jwt.sign(
    { id: user.id, is_admin: user.is_admin, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // change to "14d" or "30d" if you want longer sessions
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    has_completed_assessment: user.has_completed_assessment,
    is_admin: user.is_admin,
  };
}

// -------------------
// Controllers
// -------------------
const register = async (req, res) => {
  const { name, email, password } = req.body;
  const normalisedEmail = email.trim().toLowerCase();

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, normalisedEmail, hashed]
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      refreshToken,
      user.id,
    ]);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "User registration failed" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const normalisedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      normalisedEmail,
    ]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Invalid email" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    // Generate new tokens
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      refreshToken,
      user.id,
    ]);

    res.json({
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: "Missing token" });

  try {
    // Verify refresh token signature & expiry
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ error: "Expired or invalid refresh token" });
    }

    // Fetch user & validate stored refresh token
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      payload.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    if (user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: "Refresh token revoked" });
    }

    // Rotate refresh token
    const newAccessToken = signAccess(user);
    const newRefreshToken = signRefresh(user);

    await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      newRefreshToken,
      user.id,
    ]);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const fetchUserByID = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    res.json(sanitizeUser(result.rows[0]));
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { register, login, refresh, fetchUserByID };
