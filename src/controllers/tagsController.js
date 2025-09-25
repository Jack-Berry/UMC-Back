// src/controllers/tagsController.js
const { pool } = require("../db");

/**
 * GET /api/tags
 * Public endpoint: returns all tags or filters by query (?q=)
 */
async function getTags(req, res) {
  const { q } = req.query;
  try {
    let result;
    if (q) {
      result = await pool.query(
        `SELECT id, name 
         FROM tags 
         WHERE name ILIKE $1
         ORDER BY name ASC`,
        [`%${q}%`]
      );
    } else {
      result = await pool.query("SELECT id, name FROM tags ORDER BY name ASC");
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch tags:", err);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
}

module.exports = {
  getTags,
};
