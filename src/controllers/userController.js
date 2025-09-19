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
                 location, region, lat, lng, show_location, created_at, has_completed_assessment`,
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
