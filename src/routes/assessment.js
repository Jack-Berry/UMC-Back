// src/routes/assessment.js
const express = require("express");
const { pool } = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// 🔒 Apply auth to all assessment routes
router.use(authenticateToken);

/**
 * ✅ Submit or update an assessment
 * POST /api/assessment/:type
 */
router.post("/:type", async (req, res) => {
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

  for (const [i, a] of answers.entries()) {
    if (!a) return res.status(400).json({ error: `answers[${i}] is empty` });

    const { questionId, questionText, category, score } = a;
    const intScore = Number(score);

    if (!questionId || !questionText || !category) {
      return res.status(400).json({ error: `answers[${i}] is missing fields` });
    }
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

      const upsertSql = `
        INSERT INTO user_assessment_answers (
          user_id, assessment_type, category, question_id, question_text, score, is_followup
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
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
          a.is_followup || false,
        ]);
      }

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
 * ✅ Get active categories
 * GET /api/assessment/categories
 */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT assessment_type, category
       FROM assessment_questions
       WHERE active = true
       ORDER BY assessment_type, category`
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch categories error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * ✅ Get questions for a given assessment type (return tags as [{id,name}])
 * GET /api/assessment/:type/questions
 */
router.get("/:type/questions", async (req, res) => {
  const { type } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
        q.id,
        q.category,
        q.text,
        q.version,
        q.active,
        q.parent_id,
        COALESCE(
          json_agg(json_build_object('id', t.id, 'name', t.name))
          FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM assessment_questions q
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       WHERE q.assessment_type = $1
         AND q.active = true
       GROUP BY q.id
       ORDER BY q.sort_order NULLS LAST, q.id`,
      [type]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: `No questions found for type: ${type}` });
    }

    res.json({ assessmentType: type, questions: rows });
  } catch (err) {
    console.error("Fetch questions error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * ✅ Get a user’s submitted answers for a type
 * GET /api/assessment/:type/:userId
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

/**
 * ✅ Wipe all answers for a user
 * DELETE /api/assessment/all/:userId
 */
router.delete("/all/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    await pool.query(`DELETE FROM user_assessment_answers WHERE user_id = $1`, [
      userId,
    ]);
    await pool.query(
      `UPDATE users SET has_completed_assessment = false WHERE id = $1`,
      [userId]
    );
    res.json({ success: true, message: "All assessments cleared" });
  } catch (err) {
    console.error("Wipe all assessments error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * ✅ Wipe only a specific type of answers
 * DELETE /api/assessment/:type/:userId
 */
router.delete("/:type/:userId", async (req, res) => {
  const { type, userId } = req.params;
  try {
    await pool.query(
      `DELETE FROM user_assessment_answers WHERE user_id = $1 AND assessment_type = $2`,
      [userId, type]
    );
    res.json({ success: true, message: "Assessment type wiped" });
  } catch (err) {
    console.error("Wipe assessment type error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
