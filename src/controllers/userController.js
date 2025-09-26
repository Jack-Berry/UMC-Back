const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const multer = require("multer");

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
    // Build public URL (same pattern as news.image_url)
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

    // Save **full URL** in DB (consistent with news.image_url)
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
    name,
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
       SET name          = COALESCE($1, name),
           useful_at     = COALESCE($2, useful_at),
           useless_at    = COALESCE($3, useless_at),
           location      = COALESCE($4, location),
           lat           = COALESCE($5, lat),
           lng           = COALESCE($6, lng),
           show_location = COALESCE($7, show_location),
           region        = COALESCE($8, region)
       WHERE id = $9
       RETURNING id, name, email, avatar_url, useful_at, useless_at,
                 location, region, lat, lng, show_location,
                 created_at, has_completed_assessment`,
      [
        name ?? null,
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
      `SELECT id, name, email, avatar_url 
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
      `SELECT id, name, email, avatar_url, useful_at, useless_at,
              location, region, lat, lng, show_location,
              created_at, has_completed_assessment
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
