// src/routes/assessment.js

const express = require("express");
const { pool } = require("../db");
const router = express.Router();

/**
 * POST /api/assessment/:type
 * Body:
 * {
 *   userId: number,
 *   answers: [{ questionId: string, questionText: string, category: string, score: 1..5 }]
 * }
 */
router.post("/:type", async (req, res) => {
  console.log("Incoming assessment submission:", req.params, req.body);
  const assessmentType = req.params.type;
  const { userId, answers } = req.body;

  if (!userId || !assessmentType || !Array.isArray(answers)) {
    return res.status(400).json({
      error: "Missing required data: userId, assessmentType, answers[]",
    });
  }
  if (answers.length === 0) {
    return res.status(400).json({ error: "answers[] cannot be empty" });
  }

  // Validate each answer
  for (const [i, a] of answers.entries()) {
    if (!a) return res.status(400).json({ error: `answers[${i}] is empty` });

    const { questionId, questionText, category, score } = a;

    if (typeof questionId !== "string" || questionId.trim() === "") {
      return res
        .status(400)
        .json({ error: `answers[${i}].questionId must be a non-empty string` });
    }
    if (typeof questionText !== "string" || questionText.trim() === "") {
      return res.status(400).json({
        error: `answers[${i}].questionText must be a non-empty string`,
      });
    }
    if (typeof category !== "string" || category.trim() === "") {
      return res
        .status(400)
        .json({ error: `answers[${i}].category must be a non-empty string` });
    }
    const intScore = Number(score);
    if (!Number.isInteger(intScore) || intScore < 1 || intScore > 5) {
      return res.status(400).json({
        error: `answers[${i}].score must be an integer between 1 and 5`,
      });
    }
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Upsert each answer into user_assessment_answers
      const upsertSql = `
  INSERT INTO user_assessment_answers (
    user_id, 
    assessment_type, 
    category, 
    question_id, 
    question_text, 
    score, 
    is_followup
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (user_id, assessment_type, question_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    question_text = EXCLUDED.question_text,
    is_followup = EXCLUDED.is_followup,
    updated_at = now()
`;

      for (const a of answers) {
        await client.query(upsertSql, [
          userId,
          assessmentType,
          a.category,
          a.questionId,
          a.questionText,
          a.score,
          a.is_followup, // 👈 include this now
        ]);
      }

      // Mark assessment completed (global flag for now)
      await client.query(
        `UPDATE users SET has_completed_assessment = true WHERE id = $1`,
        [userId]
      );

      await client.query("COMMIT");
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

/**
 * GET /api/assessment/:type/:userId
 * Returns current answers for a given assessment type
 */
router.get("/:type/:userId", async (req, res) => {
  const { type, userId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT question_id, question_text, category, score, is_followup, updated_at
   FROM user_assessment_answers
   WHERE user_id = $1 AND assessment_type = $2
   ORDER BY category, question_id`,
      [userId, type]
    );

    res.json({ assessmentType: type, userId: Number(userId), answers: rows });
  } catch (err) {
    console.error("Fetch assessment error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
