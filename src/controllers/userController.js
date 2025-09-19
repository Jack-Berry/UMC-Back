const { pool } = require("../db");

exports.updateAvatar = async (req, res) => {
  const userId = req.params.id;
  const { avatarUrl } = req.body;

  if (!avatarUrl) {
    return res.status(400).json({ error: "avatarUrl required" });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, avatar_url",
      [avatarUrl, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Avatar updated", user: result.rows[0] });
  } catch (err) {
    console.error("Error updating avatar:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.params.id;
  const { name, useful_at, useless_at, location, show_location } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET name          = COALESCE($1, name),
           useful_at     = COALESCE($2, useful_at),
           useless_at    = COALESCE($3, useless_at),
           location      = COALESCE($4, location),
           show_location = COALESCE($5, show_location)
       WHERE id = $6
       RETURNING id, name, email, avatar_url, useful_at, useless_at, location, show_location, created_at, has_completed_assessment`,
      [
        name ?? null,
        useful_at ?? null,
        useless_at ?? null,
        location ?? null,
        show_location ?? null,
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
