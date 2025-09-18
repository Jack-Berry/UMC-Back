const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");

// Helper to generate tokens
function generateTokens(user) {
  const payload = {
    id: user.id, // ✅ use "id", not "userId"
    is_admin: user.is_admin,
    email: user.email, // optional, but nice to have
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
}

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
    const { accessToken, refreshToken } = generateTokens(user);
    await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      refreshToken,
      user.id,
    ]);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        has_completed_assessment: user.has_completed_assessment,
        is_admin: user.is_admin, // include admin flag
      },
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
    const { accessToken, refreshToken } = generateTokens(user);
    await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      refreshToken,
      user.id,
    ]);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        has_completed_assessment: user.has_completed_assessment,
        is_admin: user.is_admin, // include admin flag
      },
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
    // Check if refresh token exists in DB
    const result = await pool.query(
      "SELECT * FROM users WHERE refresh_token = $1",
      [refreshToken]
    );
    if (result.rows.length === 0)
      return res.status(403).json({ error: "Invalid refresh token" });

    const user = result.rows[0];

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err) => {
      if (err)
        return res
          .status(403)
          .json({ error: "Expired or invalid refresh token" });

      const { accessToken, refreshToken: newRefreshToken } =
        generateTokens(user);

      // Save new refresh token (rotate it)
      pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
        newRefreshToken,
        user.id,
      ]);

      res.json({ accessToken, refreshToken: newRefreshToken });
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

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { register, login, refresh, fetchUserByID };
