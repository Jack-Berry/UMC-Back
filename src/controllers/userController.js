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
    cb(null, `${req.user.id}-avatar-${Date.now()}${ext}`);
  },
});

exports.upload = multer({ storage }).single("avatar");

// 🔹 Handle avatar upload + DB update
exports.uploadAvatar = async (req, res) => {
  const userId = req.user.id;

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

// 🔹 Update profile fields (only your own profile)
exports.updateProfile = async (req, res) => {
  const userId = req.user.id; // from JWT
  const {
    first_name,
    last_name,
    display_name,
    dob,
    useful_at,
    useless_at,
    location,
    lat,
    lng,
    show_location,
    region,
    bio,
  } = req.body;

  try {
    const updates = {};
    const errors = {};

    // First name
    if (first_name !== undefined) {
      if (!first_name.trim()) {
        errors.first_name = "First name cannot be empty.";
      } else {
        updates.first_name = first_name.trim();
      }
    }

    // Last name
    if (last_name !== undefined) {
      if (!last_name.trim()) {
        errors.last_name = "Last name cannot be empty.";
      } else {
        updates.last_name = last_name.trim();
      }
    }

    // Display name validation + uniqueness
    if (display_name !== undefined) {
      if (!display_name.trim()) {
        errors.display_name = "Display name cannot be empty.";
      } else if (!/^[A-Za-z0-9_]+$/.test(display_name)) {
        errors.display_name =
          "Display name may only contain letters, numbers, or underscores.";
      } else {
        const dnCheck = await pool.query(
          "SELECT id FROM users WHERE display_name=$1 AND id<>$2",
          [display_name.trim(), userId]
        );
        if (dnCheck.rows.length) {
          errors.display_name = "Display name already taken.";
        } else {
          updates.display_name = display_name.trim();
        }
      }
    }

    // DOB + age check
    if (dob !== undefined) {
      const dobDate = new Date(dob);
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      const under18 =
        age < 18 ||
        (age === 18 &&
          (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())));
      if (under18) {
        errors.dob = "You must be at least 18 years old.";
      } else {
        updates.dob = dob;
      }
    }

    // Other optional fields
    if (useful_at !== undefined) updates.useful_at = useful_at;
    if (useless_at !== undefined) updates.useless_at = useless_at;
    if (location !== undefined) updates.location = location;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (show_location !== undefined) updates.show_location = show_location;
    if (region !== undefined) updates.region = region;
    if (bio !== undefined) updates.bio = bio.trim();

    // If validation errors → stop
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    // Build SQL dynamically
    const setClause = Object.keys(updates)
      .map((key, idx) => `${key}=$${idx + 1}`)
      .join(", ");
    const values = [...Object.values(updates), userId];

    const result = await pool.query(
      `UPDATE users SET ${setClause} WHERE id=$${values.length} 
       RETURNING id, first_name, last_name, display_name, email, avatar_url,
                 useful_at, useless_at, location, region, lat, lng, show_location,
                 created_at, has_completed_assessment, dob, accepted_terms, bio`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// 🔹 Search users by email, first_name, last_name, display_name (any combination)

exports.searchUsers = async (req, res) => {
  try {
    const { email, first_name, last_name, display_name, lat, lng } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (email) {
      conditions.push(`email ILIKE $${idx++}`);
      values.push(`%${email}%`);
    }
    if (first_name) {
      conditions.push(`first_name ILIKE $${idx++}`);
      values.push(`%${first_name}%`);
    }
    if (last_name) {
      conditions.push(`last_name ILIKE $${idx++}`);
      values.push(`%${last_name}%`);
    }
    if (display_name) {
      conditions.push(`display_name ILIKE $${idx++}`);
      values.push(`%${display_name}%`);
    }

    if (conditions.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one search parameter is required" });
    }

    // lat/lng placeholders
    const latIdx = idx++;
    const lngIdx = idx++;

    const query = `
      SELECT id, first_name, last_name, display_name, email, avatar_url,
             lat, lng,
             CASE
               WHEN $${latIdx}::float IS NOT NULL AND $${lngIdx}::float IS NOT NULL 
                    AND lat IS NOT NULL AND lng IS NOT NULL
               THEN (point($${lngIdx}::float, $${latIdx}::float) <@> point(lng, lat)) * 1609.34
               ELSE NULL
             END as distance
      FROM users
      WHERE ${conditions.join(
        " AND "
      )}   -- 🔹 use AND so all provided fields must match
      ORDER BY distance NULLS LAST
      LIMIT 50
    `;

    const result = await pool.query(query, [
      ...values,
      lat || null,
      lng || null,
    ]);
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
              created_at, has_completed_assessment, dob, accepted_terms, bio
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
