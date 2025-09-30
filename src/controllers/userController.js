const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const multer = require("multer");

// presence helpers
const { getOnlineUserIds, getPresenceForIds } = require("../socket");

// 🔹 Upload directory (inside /uploads/avatars)
const uploadDir = path.join(__dirname, "../../uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 🔹 Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}-avatar-${Date.now()}${ext}`);
  },
});

exports.upload = multer({ storage }).single("avatar");

// 🔹 Handle avatar upload + DB update
exports.uploadAvatar = async (req, res) => {
  const userId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const avatarUrl = `${req.protocol}://${req.get("host")}/uploads/avatars/${
      req.file.filename
    }`;

    // Remove old avatar if exists
    const existing = await pool.query(
      "SELECT avatar_url FROM users WHERE id = $1",
      [userId]
    );

    if (existing.rows.length > 0 && existing.rows[0].avatar_url) {
      const oldUrl = existing.rows[0].avatar_url;
      if (oldUrl.includes("/uploads/avatars/")) {
        const oldFile = oldUrl.split("/uploads/avatars/")[1];
        if (oldFile) {
          const oldPath = path.join(uploadDir, oldFile);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
    }

    const result = await pool.query(
      "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, avatar_url",
      [avatarUrl, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Avatar updated", user: result.rows[0] });
  } catch (err) {
    console.error("Error uploading avatar:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// 🔹 Update profile fields
exports.updateProfile = async (req, res) => {
  const userId = req.params.id;
  const {
    first_name,
    last_name,
    display_name,
    useful_at,
    useless_at,
    location,
    lat,
    lng,
    show_location,
    region,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET first_name    = COALESCE($1, first_name),
           last_name     = COALESCE($2, last_name),
           display_name  = COALESCE($3, display_name),
           useful_at     = COALESCE($4, useful_at),
           useless_at    = COALESCE($5, useless_at),
           location      = COALESCE($6, location),
           lat           = COALESCE($7, lat),
           lng           = COALESCE($8, lng),
           show_location = COALESCE($9, show_location),
           region        = COALESCE($10, region)
       WHERE id = $11
       RETURNING id, first_name, last_name, display_name, email, avatar_url,
                 useful_at, useless_at, location, region, lat, lng, show_location,
                 created_at, has_completed_assessment, dob, accepted_terms`,
      [
        first_name ?? null,
        last_name ?? null,
        display_name ?? null,
        useful_at ?? null,
        useless_at ?? null,
        location ?? null,
        lat ?? null,
        lng ?? null,
        show_location ?? null,
        region ?? null,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// 🔹 Search users by email (for friend requests)
exports.searchUsers = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const result = await pool.query(
      `SELECT id, first_name, last_name, display_name, email, avatar_url 
       FROM users 
       WHERE email ILIKE $1 
       LIMIT 5`,
      [email + "%"]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
};

// 🔹 Get user by ID
exports.getUserById = async (req, res) => {
  const userId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, display_name, email, avatar_url,
              useful_at, useless_at, location, region, lat, lng, show_location,
              created_at, has_completed_assessment, dob, accepted_terms
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// GET /api/users/online
exports.getOnlineUsers = async (req, res) => {
  try {
    const online = getOnlineUserIds();
    res.json({ online });
  } catch (err) {
    console.error("getOnlineUsers error:", err);
    res.status(500).json({ error: "Failed to fetch online users" });
  }
};

// GET /api/users/presence?ids=1,2,3
exports.getPresence = async (req, res) => {
  try {
    const idsRaw = req.query.ids || "";
    const ids = String(idsRaw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((v) => (Number.isNaN(Number(v)) ? v : Number(v)));

    if (ids.length === 0) {
      return res.status(400).json({ error: "ids query param is required" });
    }

    const presence = getPresenceForIds(ids);
    res.json({ presence });
  } catch (err) {
    console.error("getPresence error:", err);
    res.status(500).json({ error: "Failed to fetch presence" });
  }
};
