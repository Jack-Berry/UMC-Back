const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const pool = require("../db");

const register = async (req, res) => {
  const { name, email, password } = req.body;
  console.log("Register endpoint hit with:", req.body);

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, email, hashed]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "User registration failed" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt with:", email, password); // ADD THIS

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    console.log("User from DB:", user); // ADD THIS

    if (!user) {
      console.log("No user found");
      return res.status(401).json({ error: "Invalid email" });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log("Password match:", match); // ADD THIS

    if (!match) {
      console.log("Incorrect password");
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        has_completed_assessment: user.has_completed_assessment,
      },
    });
  } catch (err) {
    console.error("Login error:", err); // IMPROVE THIS
    res.status(500).json({ error: "Login failed" });
  }
};

const fetchUserByID = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { register, login, fetchUserByID };
