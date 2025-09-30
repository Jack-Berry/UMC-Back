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
    { id: user.id, is_admin: user.is_admin, email: user.email },
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
    name: user.name,
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
  };
}

function buildFrontendUrl() {
  const fallback =
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : "https://uselessmen.org";
  const base = (process.env.FRONTEND_URL || fallback).replace(/\/+$/, "");
  return base;
}

async function sendVerificationEmailTo(user, token) {
  const verifyUrl = `${buildFrontendUrl()}/verify-email?token=${token}`;

  return sendEmail({
    to: user.email,
    subject: "Verify your email",
    text: `
Welcome to UMC!

Thanks for signing up. Please verify your email address by clicking the link below:

${verifyUrl}

This link expires in 24 hours.

If you did not create an account, you can ignore this email.

— Useless Men’s Co-Operative
    `,
    html: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111827; padding:40px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" 
             style="background-color:#1f2937; border-radius:12px; padding:30px; font-family:Arial,sans-serif; color:#f9fafb;">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <div style="background-color:#111827; padding:10px 20px; border-radius:8px; display:inline-block;">
              <img src="https://www.uselessmen.org/assets/Main-yyq4P3wy.png"
                   alt="Useless Men's Co-Operative Logo"
                   width="120"
                   style="display:block;" />
            </div>
          </td>
        </tr>
        <tr>
          <td align="center">
            <h1 style="margin:0; font-size:24px; font-weight:bold;">Welcome to UMC</h1>
            <p style="margin:16px 0; font-size:16px; line-height:1.5; color:#d1d5db;">
              Thanks for signing up! Please confirm your email address to get started.
            </p>
            <a href="${verifyUrl}"
               role="button"
               aria-label="Verify your email address for Useless Men's Co-Operative"
               style="display:inline-block; padding:12px 24px; margin:20px 0; 
                      background-color:#2563eb; color:#ffffff; font-weight:bold; 
                      text-decoration:none; border-radius:8px; font-size:16px;">
              Verify Email
            </a>
            <p style="margin-top:16px; font-size:14px; color:#9ca3af;">
              This link expires in 24 hours.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:20px; font-size:12px; color:#6b7280;">
            © ${new Date().getFullYear()} Useless Men's Co-Operative. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
    `,
  });
}

// -------------------
// Controllers
// -------------------
const register = async (req, res) => {
  const { name, email, password } = req.body;
  const normalisedEmail = String(email || "")
    .trim()
    .toLowerCase();

  try {
    // basic duplicate guard
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [
      normalisedEmail,
    ]);
    if (exists.rows.length) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, is_verified) VALUES ($1, $2, $3, false) RETURNING *",
      [name, normalisedEmail, hashed]
    );

    const user = result.rows[0];

    // Generate verification token (24h)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      "UPDATE users SET verification_token=$1, verification_expires=$2 WHERE id=$3",
      [token, expires, user.id]
    );

    await sendVerificationEmailTo(user, token);

    // Do NOT sign-in yet; require verification first
    return res
      .status(201)
      .json({ message: "Registration successful. Please verify your email." });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "User registration failed" });
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

    // Block login until email verified
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
  // Public endpoint; do not reveal whether the email exists.
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
      // Pretend success to avoid account enumeration
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

    // Reuse existing unexpired token to reduce spam; otherwise create new
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
    // Still return generic success to avoid leaking details
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
