// src/routes/adminAssessment.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const { generateQuestionId } = require("../utils/generateQuestionId");
const assessmentData = require("../data/assessmentData");

// ---------- Categories ----------

router.get("/categories", authenticateToken, requireAdmin, async (req, res) => {
  const { type } = req.query;
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
      ORDER BY category, parent_id NULLS FIRST, sort_order NULLS LAST, id
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
    sort_order = null,
  } = req.body;

  if (!assessment_type || !text) {
    return res
      .status(400)
      .json({ error: "assessment_type and text are required" });
  }

  try {
    const client = await pool.connect();
    try {
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
          category || assessment_type,
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
          sort_order = COALESCE($6, sort_order)
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
      res.json({ success: true, id }); // ✅ Always return JSON
    } catch (err) {
      console.error("Error deleting question:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Restore default schema
router.post("/restore-defaults", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Wipe table
    await client.query("DELETE FROM assessment_questions");

    // Restore default schema
    router.post("/restore-defaults", async (req, res) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Wipe table
        await client.query("DELETE FROM assessment_questions");

        // Helper: force 'initial' for any init-* id
        const typeFor = (id, defaultType) =>
          id.startsWith("init-") ? "initial" : defaultType;

        // Reinsert defaults
        for (const category of assessmentData) {
          for (let i = 0; i < category.questions.length; i++) {
            const q = category.questions[i];

            await client.query(
              `INSERT INTO assessment_questions
            (id, assessment_type, category, text, parent_id, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                q.id,
                typeFor(q.id, category.assessment_type), // ✅ 'initial' for init-*, else machine key
                category.category,
                q.text,
                q.parent_id || null,
                i,
              ]
            );

            if (q.followUps?.questions) {
              for (let j = 0; j < q.followUps.questions.length; j++) {
                const fq = q.followUps.questions[j];
                await client.query(
                  `INSERT INTO assessment_questions
                (id, assessment_type, category, text, parent_id, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6)`,
                  [
                    fq.id,
                    typeFor(fq.id, category.assessment_type), // ✅ machine key; 'initial' if ever needed
                    category.category,
                    fq.text,
                    q.id,
                    j,
                  ]
                );
              }
            }
          }
        }

        await client.query("COMMIT");
        res.json({ success: true, restored: true });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error restoring defaults:", err);
        res.status(500).json({ error: "Failed to restore defaults" });
      } finally {
        client.release();
      }
    });

    await client.query("COMMIT");
    res.json({ success: true, restored: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error restoring defaults:", err);
    res.status(500).json({ error: "Failed to restore defaults" });
  } finally {
    client.release();
  }
});

// ---------- Bulk Save ----------

router.patch(
  "/questions/bulk",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { questions } = req.body; // [{id, text, category, parent_id, sort_order}, ...]

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const q of questions) {
        await client.query(
          `
        UPDATE assessment_questions
        SET text = $1,
            category = $2,
            parent_id = $3,
            sort_order = $4
        WHERE id = $5
        `,
          [q.text, q.category, q.parent_id || null, q.sort_order, q.id]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Bulk update failed:", err);
      res.status(500).json({ error: "Bulk update failed" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
