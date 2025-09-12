// src/routes/adminAssessment.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// ---------- Categories ----------

// GET all categories
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM assessment_categories ORDER BY sort_order, id"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE category
router.post("/categories", async (req, res) => {
  const { name, description, sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO assessment_categories (name, description, sort_order)
       VALUES ($1,$2,$3) RETURNING *`,
      [name, description || null, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE category
router.put("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, sort_order } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE assessment_categories
       SET name = COALESCE($1,name),
           description = COALESCE($2,description),
           sort_order = COALESCE($3,sort_order),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, description, sort_order, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Category not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE category
router.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM assessment_categories WHERE id = $1", [id]);
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// REORDER categories
router.patch("/categories/reorder", async (req, res) => {
  const { ids } = req.body; // array of ids in desired order
  if (!Array.isArray(ids))
    return res.status(400).json({ error: "ids array required" });

  try {
    await pool.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await pool.query(
        "UPDATE assessment_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2",
        [i, ids[i]]
      );
    }
    await pool.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error reordering categories:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- Questions ----------

// GET questions (optional ?category_id=)
router.get("/questions", async (req, res) => {
  const { category_id } = req.query;
  let where = "";
  const params = [];

  if (category_id) {
    params.push(category_id);
    where = `WHERE q.category_id = $${params.length}`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT q.* 
       FROM assessment_questions q
       ${where}
       ORDER BY q.category_id, q.parent_id NULLS FIRST, q.sort_order, q.id`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching questions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE question
router.post("/questions", async (req, res) => {
  const {
    category_id,
    parent_id,
    prompt,
    help_text,
    type = "scale",
    weight = 1,
    sort_order = 0,
    meta = {},
    is_active = true,
  } = req.body;

  if (!category_id || !prompt)
    return res.status(400).json({ error: "category_id and prompt required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO assessment_questions
       (category_id, parent_id, prompt, help_text, type, weight, sort_order, meta, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        category_id,
        parent_id || null,
        prompt,
        help_text || null,
        type,
        weight,
        sort_order,
        meta,
        is_active,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating question:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE question
router.put("/questions/:id", async (req, res) => {
  const { id } = req.params;
  const {
    category_id,
    parent_id,
    prompt,
    help_text,
    type,
    weight,
    sort_order,
    meta,
    is_active,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE assessment_questions
       SET category_id = COALESCE($1, category_id),
           parent_id = $2,
           prompt = COALESCE($3, prompt),
           help_text = COALESCE($4, help_text),
           type = COALESCE($5, type),
           weight = COALESCE($6, weight),
           sort_order = COALESCE($7, sort_order),
           meta = COALESCE($8, meta),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        category_id || null,
        parent_id === undefined ? null : parent_id,
        prompt || null,
        help_text || null,
        type || null,
        weight || null,
        sort_order || null,
        meta || null,
        is_active === undefined ? null : is_active,
        id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "Question not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating question:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE question
router.delete("/questions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM assessment_questions WHERE id = $1", [id]);
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting question:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// REORDER questions
router.patch("/questions/reorder", async (req, res) => {
  const { ids } = req.body; // array of ids in desired order
  if (!Array.isArray(ids))
    return res.status(400).json({ error: "ids array required" });

  try {
    await pool.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await pool.query(
        "UPDATE assessment_questions SET sort_order = $1, updated_at = NOW() WHERE id = $2",
        [i, ids[i]]
      );
    }
    await pool.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error reordering questions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
