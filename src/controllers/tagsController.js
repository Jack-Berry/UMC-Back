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

/**
 * POST /api/tags
 * Admin only: create a new tag
 */
async function createTag(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Tag name is required" });

  try {
    const result = await pool.query(
      `INSERT INTO tags (name) VALUES ($1) RETURNING id, name`,
      [name.toLowerCase().trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create tag:", err);
    res.status(500).json({ error: "Failed to create tag" });
  }
}

/**
 * PUT /api/tags/:id
 * Admin only: update a tag name
 */
async function updateTag(req, res) {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Tag name is required" });

  try {
    const result = await pool.query(
      `UPDATE tags SET name = $1 WHERE id = $2 RETURNING id, name`,
      [name.toLowerCase().trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update tag:", err);
    res.status(500).json({ error: "Failed to update tag" });
  }
}

/**
 * DELETE /api/tags/:id
 * Admin only: delete a tag
 */
async function deleteTag(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM tags WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error("Failed to delete tag:", err);
    res.status(500).json({ error: "Failed to delete tag" });
  }
}

module.exports = {
  getTags,
  createTag,
  updateTag,
  deleteTag,
};
