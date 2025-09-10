// src/routes/assessment.js

const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// POST /api/assessment
router.post("/", async (req, res) => {
  const { userId, scoresByCategory } = req.body;

  if (!userId || typeof scoresByCategory !== "object") {
    return res.status(400).json({ error: "Missing required data" });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const [category, score] of Object.entries(scoresByCategory)) {
        await client.query(
          `
          INSERT INTO user_assessments (user_id, category, score)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, category)
          DO UPDATE SET score = EXCLUDED.score
        `,
          [userId, category, score]
        );
      }

      await client.query(
        `UPDATE users SET has_completed_assessment = true WHERE id = $1`,
        [userId]
      );

      await client.query("COMMIT");
      console.log(`Assessment submitted for user ${userId}:`, scoresByCategory);
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Assessment insert error:", err);
      res.status(500).json({ error: "Database error" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Pool error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
