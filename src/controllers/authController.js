// src/controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool } = require("../db");
const { sendEmail } = require("../utils/emailManager");

// -------------------
// Helpers
// -------------------
function signAccess(user) {
  return jwt.sign(
    {
      id: user.id,
      is_admin: user.is_admin,
      email: user.email,
      display_name: user.display_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function signRefresh(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    display_name: user.display_name,
    email: user.email,
    avatar_url: user.avatar_url,
    has_completed_assessment: user.has_completed_assessment,
    is_admin: user.is_admin,
    profile_completion: user.profile_completion,
    useful_at: user.useful_at,
    useless_at: user.useless_at,
    location: user.location,
    show_location: user.show_location,
    lat: user.lat,
    lng: user.lng,
    region: user.region,
    category_scores: user.category_scores,
    tag_scores: user.tag_scores,
    created_at: user.created_at,
    dob: user.dob,
    accepted_terms: user.accepted_terms,
    is_verified: user.is_verified,
  };
}

function buildFrontendUrl() {
  const fallback =
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : "https://uselessmen.org";
  return (process.env.FRONTEND_URL || fallback).replace(/\/+$/, "");
}

async function sendVerificationEmailTo(user, token) {
  const verifyUrl = `${buildFrontendUrl()}/verify-email?token=${token}`;

  return sendEmail({
    to: user.email,
    subject: "Verify your email",
    text: `Welcome to UMC!\n\nPlease verify your email by clicking the link:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#111827; font-family:Arial,sans-serif; color:#f9fafb;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111827; padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#1f2937; border-radius:12px; padding:30px; text-align:center;">
            <tr>
              <td>
                <h1 style="margin:0; font-size:24px; font-weight:bold; color:#f9fafb;">Welcome to UMC</h1>
                <p style="margin:16px 0; font-size:16px; line-height:1.5; color:#d1d5db;">
                  Please confirm your email address to get started.
                </p>
                <a href="${verifyUrl}" style="display:inline-block; padding:12px 24px; margin:20px 0; background-color:#2563eb; color:#ffffff; font-weight:bold; text-decoration:none; border-radius:8px; font-size:16px;">
                  Verify Email
                </a>
                <p style="margin-top:16px; font-size:14px; color:#9ca3af;">
                  This link expires in 24 hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px; font-size:12px; color:#6b7280;">
                © ${new Date().getFullYear()} Useless Men's Co-Operative. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `,
  });
}

// -------------------
// Controllers
// -------------------
const register = async (req, res) => {
  const {
    first_name,
    last_name,
    display_name,
    email,
    password,
    dob,
    accepted_terms,
  } = req.body;

  const normalisedEmail = String(email || "")
    .trim()
    .toLowerCase();

  // 🔹 Basic required checks
  if (!first_name || !last_name || !password || !dob || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!accepted_terms) {
    return res
      .status(400)
      .json({ error: "You must accept the terms and privacy policy" });
  }

  // 🔹 Age check
  const dobDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (
    age < 18 ||
    (age === 18 && (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())))
  ) {
    return res
      .status(400)
      .json({ error: "You must be at least 18 years old to register." });
  }

  // 🔹 Display name required + format check
  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ error: "Display name is required." });
  }
  if (!/^[A-Za-z0-9_]+$/.test(display_name.trim())) {
    return res.status(400).json({
      error:
        "Display name may only contain letters, numbers, or underscores (no spaces).",
    });
  }

  try {
    // 🔹 Check duplicate email
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [
      normalisedEmail,
    ]);
    if (exists.rows.length) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // 🔹 Check duplicate display name
    const dnCheck = await pool.query(
      "SELECT id FROM users WHERE display_name=$1",
      [display_name.trim()]
    );
    if (dnCheck.rows.length) {
      return res.status(400).json({ error: "Display name already taken" });
    }

    // 🔹 Hash password
    const hashed = await bcrypt.hash(password, 10);

    // 🔹 Insert new user
    const result = await pool.query(
      `INSERT INTO users 
         (first_name, last_name, display_name, email, password, dob, accepted_terms, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, false) 
       RETURNING *`,
      [
        first_name.trim(),
        last_name.trim(),
        display_name.trim(),
        normalisedEmail,
        hashed,
        dob,
        accepted_terms,
      ]
    );

    const user = result.rows[0];

    // 🔹 Generate verification token (24h expiry)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      "UPDATE users SET verification_token=$1, verification_expires=$2 WHERE id=$3",
      [token, expires, user.id]
    );

    // 🔹 Send verification email
    await sendVerificationEmailTo(user, token);

    return res.status(201).json({
      message: "Registration successful. Please verify your email.",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "Email or display name already exists." });
    }
    console.error("Register error:", err);
    return res.status(500).json({ error: "User registration failed" });
  }
};

// 🔹 Check if a display name is available
exports.checkDisplayName = async (req, res) => {
  const { display_name } = req.query;

  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ error: "Display name is required." });
  }
  if (!/^[A-Za-z0-9_]+$/.test(display_name.trim())) {
    return res.status(400).json({
      error:
        "Display name may only contain letters, numbers, or underscores (no spaces).",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE display_name=$1",
      [display_name.trim()]
    );
    if (result.rows.length > 0) {
      return res.json({ available: false });
    }
    return res.json({ available: true });
  } catch (err) {
    console.error("checkDisplayName error:", err);
    res.status(500).json({ error: "Failed to check display name" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const normalisedEmail = String(email || "")
    .trim()
    .toLowerCase();

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      normalisedEmail,
    ]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Invalid email" });

    if (!user.is_verified) {
      return res
        .status(403)
        .json({ error: "Please verify your email before logging in." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    await pool.query("UPDATE users SET refresh_token=$1 WHERE id=$2", [
      refreshToken,
      user.id,
    ]);

    return res.json({
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: "Missing token" });

  try {
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res
        .status(401)
        .json({ error: "Expired or invalid refresh token" });
    }

    const result = await pool.query("SELECT * FROM users WHERE id=$1", [
      payload.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    if (user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: "Refresh token revoked" });
    }

    const newAccessToken = signAccess(user);
    const newRefreshToken = signRefresh(user);

    await pool.query("UPDATE users SET refresh_token=$1 WHERE id=$2", [
      newRefreshToken,
      user.id,
    ]);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

const fetchUserByID = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    return res.json(sanitizeUser(result.rows[0]));
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const result = await pool.query(
      "SELECT id, verification_expires, is_verified FROM users WHERE verification_token=$1",
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const user = result.rows[0];
    if (user.is_verified) {
      return res.json({ message: "Email already verified." });
    }

    if (new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({ error: "Token expired" });
    }

    await pool.query(
      "UPDATE users SET is_verified=true, verification_token=NULL, verification_expires=NULL WHERE id=$1",
      [user.id]
    );

    return res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
};

const resendVerification = async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!email)
    return res
      .status(200)
      .json({ message: "If the account exists, a new link has been sent." });

  try {
    const result = await pool.query(
      "SELECT id, email, is_verified, verification_token, verification_expires FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res
        .status(200)
        .json({ message: "If the account exists, a new link has been sent." });
    }

    const user = result.rows[0];
    if (user.is_verified) {
      return res
        .status(200)
        .json({ message: "If the account exists, a new link has been sent." });
    }

    let token = user.verification_token;
    let expires =
      user.verification_expires && new Date(user.verification_expires);

    const expired = !expires || Date.now() > new Date(expires).getTime();
    if (!token || expired) {
      token = crypto.randomBytes(32).toString("hex");
      expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        "UPDATE users SET verification_token=$1, verification_expires=$2 WHERE id=$3",
        [token, expires, user.id]
      );
    }

    await sendVerificationEmailTo(user, token);
    return res
      .status(200)
      .json({ message: "If the account exists, a new link has been sent." });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res
      .status(200)
      .json({ message: "If the account exists, a new link has been sent." });
  }
};

module.exports = {
  register,
  login,
  refresh,
  fetchUserByID,
  verifyEmail,
  resendVerification,
};
