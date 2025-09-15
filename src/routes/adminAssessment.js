// src/routes/adminAssessment.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const { generateQuestionId } = require("../utils/generateQuestionId");

// ---------- Categories ----------

// GET distinct categories for a given assessment_type (or all)
router.get("/categories", authenticateToken, requireAdmin, async (req, res) => {
  const { type } = req.query; // optional ?type=initial
  try {
    const params = [];
    let where = "";

    if (type) {
      params.push(type);
      where = `WHERE assessment_type = $1`;
    }

    const { rows } = await pool.query(
      `
      SELECT DISTINCT assessment_type, category
      FROM assessment_questions
      ${where}
      ORDER BY assessment_type, category
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- Questions ----------

// GET questions, optional filter by category or type
router.get("/questions", authenticateToken, requireAdmin, async (req, res) => {
  const { category, type } = req.query;
  const params = [];
  const where = [];

  if (type) {
    params.push(type);
    where.push(`assessment_type = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
      SELECT id, assessment_type, category, text, parent_id, active, version, sort_order
      FROM assessment_questions
      ${whereClause}
      ORDER BY category, parent_id NULLS FIRST, sort_order, id
      `,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching questions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE question
router.post("/questions", authenticateToken, requireAdmin, async (req, res) => {
  const {
    assessment_type,
    category,
    text,
    parent_id,
    version = 1,
    active = true,
    sort_order = 0,
  } = req.body;

  if (!assessment_type || !text) {
    return res
      .status(400)
      .json({ error: "assessment_type and text are required" });
  }

  try {
    const client = await pool.connect();
    try {
      // Generate a clean ID
      const id = await generateQuestionId(client, assessment_type, parent_id);

      const { rows } = await client.query(
        `
        INSERT INTO assessment_questions
          (id, assessment_type, category, text, parent_id, version, active, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          id,
          assessment_type,
          category || assessment_type, // fallback to type if no category
          text,
          parent_id || null,
          version,
          active,
          sort_order,
        ]
      );

      res.status(201).json(rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error creating question:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE question
router.put(
  "/questions/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { category, text, parent_id, version, active, sort_order } = req.body;

    try {
      const { rows } = await pool.query(
        `
        UPDATE assessment_questions
        SET category   = COALESCE($1, category),
            text       = COALESCE($2, text),
            parent_id  = $3,
            version    = COALESCE($4, version),
            active     = COALESCE($5, active),
            sort_order = COALESCE($6, sort_order),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
        `,
        [category, text, parent_id || null, version, active, sort_order, id]
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "Question not found" });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("Error updating question:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// DELETE question
router.delete(
  "/questions/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM assessment_questions WHERE id = $1", [id]);
      res.status(204).end();
    } catch (err) {
      console.error("Error deleting question:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
